/**
 * Vite+ integration for WAVEx apps: compiles `.wx` modules on demand, serves
 * the generated route table and bootstrap module, and drives HMR.
 *
 * Vite+ is the primary dev/build substrate by design — it provides the module
 * graph, HMR, package integration, and production bundling so WAVEx only owns
 * what is WAVEx-specific: the file-convention route table
 * (`virtual:wavex/routes`), generated app metadata
 * (`virtual:wavex/manifest`), the bootstrap entry (`/@wavex/bootstrap`, which
 * renders the app directly under `<body>` with no framework mount div),
 * self-hosted Font Awesome icons (`virtual:wavex/icons` plus the collected
 * SVGs, served in dev and emitted by the build), and `.wx` hot updates that
 * preserve Convex client state across template edits.
 *
 * The `@wavex/vite-plugin/client` subpath ships ambient module declarations
 * for `*.wx` imports; apps reference it from their tsconfig `types`.
 *
 * @module @wavex/vite-plugin
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import {
  createDefaultConfig,
  createRouteDefinition,
  formatDiagnostic,
  formatFileDiagnostic,
  normalizeSlashes,
  type Diagnostic,
  type ParseWavexOptions
} from "@wavex/core";
import {
  collectAppIcons,
  collectTemplateIcons,
  detectCapabilities,
  discoverConvexFunctionKinds,
  findConvexDir,
  isIconSourceFile,
  loadWebAwesomeIconFolder,
  readWebAwesomeDefaultLibraryIcons,
  resolveIconAsset,
  validateIconReferences,
  type FontAwesomeIconSource,
  type IconAsset,
  type IconFolderResolver,
  type IconReference,
  type ProjectCapabilities
} from "@wavex/core/capabilities";
import type { Plugin, ViteDevServer } from "vite";
import { transformWithOxc } from "vite";

/** Options for {@link wavex}. */
export interface WavexVitePluginOptions {
  /** Override the Web Awesome component set; by default it is detected from the installed package. */
  webAwesomeComponents?: readonly string[];
  /**
   * Wrap client navigations in `document.startViewTransition` (default true).
   * Skipped automatically when unsupported or under `prefers-reduced-motion`.
   */
  viewTransitions?: boolean;
}

const VIRTUAL_ROUTES_ID = "virtual:wavex/routes";
const RESOLVED_VIRTUAL_ROUTES_ID = `\0${VIRTUAL_ROUTES_ID}`;
const VIRTUAL_MANIFEST_ID = "virtual:wavex/manifest";
const RESOLVED_VIRTUAL_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;
const VIRTUAL_BOOTSTRAP_ID = "virtual:wavex/bootstrap";
const BOOTSTRAP_PUBLIC_ID = "/@wavex/bootstrap";
const RESOLVED_VIRTUAL_BOOTSTRAP_ID = `\0${VIRTUAL_BOOTSTRAP_ID}`;
const VIRTUAL_ICONS_ID = "virtual:wavex/icons";
const RESOLVED_VIRTUAL_ICONS_ID = `\0${VIRTUAL_ICONS_ID}`;
/** Directory under `build.assetsDir` that serves self-hosted Font Awesome icons (dev and build). */
const ICONS_DIR = "wavex-icons";

/**
 * The WAVEx Vite plugin. Compiles `.wx` files to Lit render modules on
 * demand, serves `virtual:wavex/routes` (the file-convention route table with
 * lazy per-route loaders, layouts, and error pages) and the
 * `/@wavex/bootstrap` entry, dedupes Lit, and sends standard Vite `js-update`
 * HMR updates for template edits so Convex client state survives `.wx` edits.
 */
export function wavex(options: WavexVitePluginOptions = {}): Plugin {
  let projectRoot = process.cwd();
  let base = "/";
  let assetsDir = "assets";
  let command: "build" | "serve" = "serve";
  let ssrBuild = false;
  let capabilities: ProjectCapabilities | undefined;
  let convexFunctionKinds: ReturnType<typeof discoverConvexFunctionKinds> | undefined;
  let iconHostPromise: Promise<IconHost | undefined> | undefined;
  // The app's collected icons; cleared when an app source file changes and rebuilt on demand.
  let iconCollection: IconCollection | undefined;
  const projectCapabilities = () => (capabilities ??= detectCapabilities(projectRoot));
  const projectConvexFunctionKinds = () => (convexFunctionKinds ??= discoverConvexFunctionKinds(projectRoot));
  const iconHost = () => (iconHostPromise ??= createIconHost(projectCapabilities()));
  const parseContext = (): Omit<ParseWavexOptions, "fileName"> => ({
    localComponents: discoverLocalComponents(resolveDirs(projectRoot).componentsDir),
    webAwesomeBooleanAttributes: projectCapabilities().webAwesome?.booleanAttributes
  });
  const collectIcons = (host: IconHost): { collection: IconCollection; fresh: boolean } => {
    if (iconCollection) return { collection: iconCollection, fresh: false };
    iconCollection = collectAppIconAssets(projectRoot, host, parseContext());
    return { collection: iconCollection, fresh: true };
  };

  return {
    name: "wavex",
    enforce: "pre",
    config() {
      return {
        resolve: {
          dedupe: ["lit", "lit-html", "lit-element", "@lit/reactive-element", "@lit/context"]
        },
        optimizeDeps: {
          // Web Awesome components are imported lazily by route modules; if the
          // optimizer discovers them mid-session it forces a full reload and can
          // register the same custom element twice. Serve them as native ESM.
          // The Lit packages must be excluded with them: Web Awesome's bare
          // `lit` imports bypass the optimizer, so a pre-bundled Lit copy for
          // app/runtime imports would be a second module instance ("Multiple
          // versions of Lit loaded").
          exclude: [
            "@web.awesome.me/webawesome-pro",
            "@awesome.me/webawesome",
            "lit",
            "lit-html",
            "lit-element",
            "@lit/reactive-element",
            "@lit/context"
          ]
        }
      };
    },
    configResolved(config) {
      projectRoot = config.root;
      base = config.base ?? "/";
      assetsDir = config.build?.assetsDir ?? "assets";
      command = config.command ?? "serve";
      ssrBuild = Boolean(config.build?.ssr);
    },
    async configureServer(server) {
      const config = resolveDirs(server.config.root);
      const sourceDir = resolve(server.config.root, createDefaultConfig().sourceDir);
      server.watcher.add(
        [config.pagesDir, config.componentsDir, config.convexDir].filter((dir): dir is string => dir !== undefined && existsSync(dir))
      );
      // Any app source edit can add or remove icons (templates, preludes, icon() declarations).
      const forgetIconsFor = (file: string) => {
        if (isInside(file, sourceDir) && isIconSourceFile(file)) iconCollection = undefined;
      };
      server.watcher.on("change", (file) => {
        forgetIconsFor(file);
        if (isConvexSourceFile(file, config)) {
          convexFunctionKinds = undefined;
          sendWavexProjectFullReload(server, config);
          return;
        }
        if (!isWavexTemplateFile(file, config)) return;
        sendWavexHotUpdate(server, file);
      });
      server.watcher.on("add", (file) => {
        forgetIconsFor(file);
        if (isConvexSourceFile(file, config)) {
          convexFunctionKinds = undefined;
          sendWavexProjectFullReload(server, config);
          return;
        }
        if (!isWavexTemplateFile(file, config)) return;
        sendWavexFullReload(server, file);
      });
      server.watcher.on("unlink", (file) => {
        forgetIconsFor(file);
        if (isConvexSourceFile(file, config)) {
          convexFunctionKinds = undefined;
          sendWavexProjectFullReload(server, config);
          return;
        }
        if (!isWavexTemplateFile(file, config)) return;
        sendWavexFullReload(server, file);
      });

      // Self-hosted icons: serve exactly the collected icons, like the build emits them.
      const host = await iconHost();
      if (!host) return;
      const logger = server.config.logger;
      server.middlewares.use(
        iconRequestHandler(`${base}${assetsDir}/${ICONS_DIR}/`, host, () => {
          const { collection, fresh } = collectIcons(host);
          // Template problems reach the overlay through transform errors; declarations only surface here.
          const declarationProblems = collection.problems.filter((problem) => !problem.file.endsWith(".wx"));
          if (fresh && declarationProblems.length > 0) logger.error(formatIconProblems(declarationProblems, projectRoot));
          return collection;
        }, (message) => logger.error(message))
      );
    },
    async buildStart() {
      const host = await iconHost();
      if (!host) return;
      iconCollection = undefined;
      const { collection } = collectIcons(host);
      if (collection.problems.length === 0) return;
      const message = formatIconProblems(collection.problems, projectRoot);
      // A build must not ship an app whose icons cannot be served; dev keeps running and reports.
      if (command === "build") this.error(message);
      else this.warn(message);
    },
    generateBundle() {
      if (command !== "build" || ssrBuild || !iconCollection) return;
      for (const asset of iconCollection.assets.values()) {
        this.emitFile({ type: "asset", fileName: `${assetsDir}/${ICONS_DIR}/${asset.folder}/${asset.name}.svg`, source: readFileSync(asset.file) });
      }
    },
    resolveId(id) {
      if (id === VIRTUAL_ROUTES_ID) return RESOLVED_VIRTUAL_ROUTES_ID;
      if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_VIRTUAL_MANIFEST_ID;
      if (id === VIRTUAL_BOOTSTRAP_ID || id === BOOTSTRAP_PUBLIC_ID) return RESOLVED_VIRTUAL_BOOTSTRAP_ID;
      if (id === VIRTUAL_ICONS_ID) return RESOLVED_VIRTUAL_ICONS_ID;
      return undefined;
    },
    load(id) {
      const config = resolveDirs(projectRoot);
      if (id === RESOLVED_VIRTUAL_ROUTES_ID) {
        const routes = discoverRoutes(config.pagesDir, projectRoot);
        const entries = routes.map((route) => {
          const importPath = `/${route.file}`;
          const layouts = discoverRouteLayouts(route.file, config.pagesDir, projectRoot)
            .map((layout) => `{ file: ${JSON.stringify(layout)}, load: () => import(${JSON.stringify(`/${layout}`)}) }`)
            .join(", ");
          const errors = discoverRouteSpecialFiles(route.file, config.pagesDir, projectRoot, "+error.wx")
            .map((file) => `{ file: ${JSON.stringify(file)}, load: () => import(${JSON.stringify(`/${file}`)}) }`)
            .join(", ");
          return `  { ...${JSON.stringify(route)}, layouts: [${layouts}], errors: [${errors}], load: () => import(${JSON.stringify(importPath)}) }`;
        });
        return [
          `export const routes = [`,
          entries.join(",\n"),
          `];`,
          `export default routes;`,
          ""
        ].join("\n");
      }
      if (id === RESOLVED_VIRTUAL_MANIFEST_ID) return generateManifestModule(projectRoot, options);
      if (id === RESOLVED_VIRTUAL_BOOTSTRAP_ID) return generateBootstrapModule(config, projectRoot, options);
      if (id === RESOLVED_VIRTUAL_ICONS_ID) return iconHost().then((host) => generateIconsModule(host, assetsDir));
      return undefined;
    },
    async transform(code, id) {
      const file = stripQuery(id);
      if (!file.endsWith(".wx")) return undefined;
      this.addWatchFile(file);
      const config = resolveDirs(projectRoot);
      const localComponents = discoverLocalComponents(config.componentsDir);
      const detected = projectCapabilities();
      const compiled = compileWavexModule(code, {
        id: normalizeSlashes(relative(projectRoot, file)),
        localComponents,
        webAwesomeComponents:
          options.webAwesomeComponents ??
          (detected.webAwesome ? [...detected.webAwesome.components] : undefined),
        webAwesomeBooleanAttributes: detected.webAwesome?.booleanAttributes,
        convexFunctionKinds: projectConvexFunctionKinds()
      });
      const host = await iconHost();
      if (host) {
        const found = collectTemplateIcons(compiled.ast, { localComponents });
        compiled.ast.diagnostics.push(...found.diagnostics, ...validateIconReferences(found.icons, host.folderOf, host.sources));
      }

      const warnings = compiled.ast.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
      for (const warning of warnings) {
        this.warn({
          id: file,
          message: formatDiagnostic(warning),
          loc: { line: warning.line, column: warning.column - 1 }
        });
      }

      const errors = compiled.ast.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      if (errors.length > 0) {
        const [firstError] = errors;
        this.error({
          id: file,
          message: errors.map(formatDiagnostic).join("\n"),
          loc: { line: firstError!.line, column: firstError!.column - 1 }
        });
      }

      // Capability-driven imports: load only the Web Awesome components this
      // template uses, from whichever package (free/pro) is installed. With
      // self-hosted icons, the icon path is set before any component loads.
      let moduleCode = compiled.code;
      if (detected.webAwesome && compiled.usedWebAwesomeComponents.length > 0) {
        const componentImports = compiled.usedWebAwesomeComponents
          .filter((name) => detected.webAwesome!.components.has(name))
          .map((name) => `import "${detected.webAwesome!.packageName}/dist/components/${name}/${name}.js";`);
        const importLines = [...(host && componentImports.length > 0 ? [`import "${VIRTUAL_ICONS_ID}";`] : []), ...componentImports];
        if (importLines.length > 0) moduleCode = `${importLines.join("\n")}\n${moduleCode}`;
      }

      // Page modules self-accept so route-level HMR works for dynamically
      // imported pages; the client router swaps the module in place.
      if (isInside(file, config.pagesDir)) {
        const publicPath = `/${normalizeSlashes(relative(projectRoot, file))}`;
        moduleCode += [
          ``,
          `if (import.meta.hot) {`,
          `  import.meta.hot.accept((nextModule) => {`,
          `    if (nextModule) (globalThis as any).__wavexHotReplacePage?.(${JSON.stringify(publicPath)}, nextModule);`,
          `  });`,
          `}`,
          ``
        ].join("\n");
      }

      return transformWithOxc(moduleCode, `${file}.ts`, {
        lang: "ts",
        sourcemap: true,
        target: "es2022"
      });
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith(".wx")) return undefined;
      const config = resolveDirs(projectRoot);
      if (!isWavexTemplateFile(ctx.file, config)) return undefined;

      invalidateWavexFile(ctx.server, ctx.file);
      return [];
    }
  };
}

export default wavex;

interface ResolvedDirs {
  pagesDir: string;
  componentsDir: string;
  styleFile: string;
  /** The app's Convex directory: `<root>/convex`, or the monorepo's (see `findConvexDir`). */
  convexDir?: string;
  convexApiFile?: string;
}

function resolveDirs(root: string): ResolvedDirs {
  const defaults = createDefaultConfig();
  const convexDir = findConvexDir(root);
  return {
    pagesDir: resolve(root, defaults.pagesDir),
    componentsDir: resolve(root, defaults.componentsDir),
    styleFile: resolve(root, defaults.sourceDir, "style.css"),
    convexDir,
    convexApiFile: convexDir ? join(convexDir, "_generated", "api.js") : undefined
  };
}

/** Mutation/action targets for the bootstrap's resolveActionKind (queries are resource-side). */
function actionKindMap(root: string): Record<string, "mutation" | "action"> {
  const kinds: Record<string, "mutation" | "action"> = {};
  for (const [reference, kind] of Object.entries(discoverConvexFunctionKinds(root))) {
    if (kind === "mutation" || kind === "action") kinds[reference] = kind;
  }
  return kinds;
}

function generateManifestModule(root: string, options: WavexVitePluginOptions = {}): string {
  return [
    `export const actionKinds = ${JSON.stringify(actionKindMap(root))};`,
    `export const viewTransitions = ${JSON.stringify(options.viewTransitions ?? true)};`,
    `export const resolveActionKind = (definition) => actionKinds[definition.modulePath + ":" + definition.functionName];`,
    `export default { actionKinds, viewTransitions, resolveActionKind };`,
    ``
  ].join("\n");
}

function generateBootstrapModule(config: ResolvedDirs, root: string, options: WavexVitePluginOptions = {}): string {
  const styleImport = existsSync(config.styleFile) ? `import ${JSON.stringify(publicImportPath(root, config.styleFile))};` : "";
  const apiImport =
    config.convexApiFile && existsSync(config.convexApiFile)
      ? `import { api as convexApi } from ${JSON.stringify(publicImportPath(root, config.convexApiFile))};`
      : `const convexApi = undefined;`;

  return [
    `import { mountLitApp } from "@wavex/runtime/lit";`,
    `import { createConvexActionClient, createConvexResourceClient, createPostHogCaptureClient } from "@wavex/runtime";`,
    `import { ConvexClient } from "convex/browser";`,
    `import routes from "virtual:wavex/routes";`,
    `import { resolveActionKind, viewTransitions } from "virtual:wavex/manifest";`,
    styleImport,
    apiImport,
    ``,
    `// WAVEx owns the document body: no #app wrapper, the app's root element`,
    `// (conventionally <wa-page> from the root layout) renders directly under <body>.`,
    `// Prerendered HTML is an output optimization only; the live app replaces it.`,
    `document.querySelector("[data-wx-prerender]")?.remove();`,
    `const root = document.body;`,
    ``,
    `const convexUrl = import.meta.env.VITE_CONVEX_URL;`,
    `const convex = convexUrl ? new ConvexClient(convexUrl) : undefined;`,
    ``,
    `// Analytics is optional: enabled only when VITE_POSTHOG_KEY is configured.`,
    `const posthogKey = import.meta.env.VITE_POSTHOG_KEY;`,
    `const analytics = posthogKey`,
    `  ? createPostHogCaptureClient({ apiKey: posthogKey, host: import.meta.env.VITE_POSTHOG_HOST })`,
    `  : undefined;`,
    ``,
    `const app = mountLitApp({`,
    `  root,`,
    `  routes,`,
    `  resourceClient: convex ? createConvexResourceClient(convex, { api: convexApi }) : undefined,`,
    `  actionClient: convex ? createConvexActionClient(convex, { api: convexApi }) : undefined,`,
    `  resolveActionKind,`,
    `  analytics,`,
    `  viewTransitions,`,
    `  onNavigate: (route) => analytics?.capture("$pageview", { $current_url: location.href, path: route.path }),`,
    `  onDispose: () => void convex?.close?.(),`,
    `});`,
    `if (import.meta.hot) {`,
    `  import.meta.hot.dispose(() => {`,
    `    app.dispose();`,
    `  });`,
    `}`,
    ``
  ].filter((line) => line !== "").join("\n");
}

/**
 * Import specifier for a project file from a generated module: root-relative
 * inside the Vite root, and Vite's `/@fs/` absolute form outside it (a
 * monorepo's shared `convex/` directory).
 */
function publicImportPath(root: string, file: string): string {
  if (isInside(file, root)) return `/${normalizeSlashes(relative(root, file))}`;
  const absolute = normalizeSlashes(resolve(file));
  return `/@fs${absolute.startsWith("/") ? "" : "/"}${absolute}`;
}

function discoverRoutes(pagesDir: string, root: string) {
  const files = walkWxFiles(pagesDir);
  const relativePagesDir = normalizeSlashes(relative(root, pagesDir));
  return files.flatMap((file) => {
    const relativeFile = normalizeSlashes(relative(root, file));
    const route = createRouteDefinition(relativeFile, relativePagesDir);
    return route ? [route] : [];
  });
}

/** Layout files (+layout.wx) from the pages root down to the route's directory, outermost first. */
function discoverRouteLayouts(routeFile: string, pagesDir: string, root: string): string[] {
  return discoverRouteSpecialFiles(routeFile, pagesDir, root, "+layout.wx");
}

/** Special sibling files (+layout.wx / +error.wx) from the pages root down to the route's directory, outermost first. */
function discoverRouteSpecialFiles(routeFile: string, pagesDir: string, root: string, fileName: string): string[] {
  const relativePagesDir = normalizeSlashes(relative(root, pagesDir));
  const routeRelative = normalizeSlashes(routeFile).startsWith(`${relativePagesDir}/`)
    ? normalizeSlashes(routeFile).slice(relativePagesDir.length + 1)
    : normalizeSlashes(routeFile);
  const directories = routeRelative.split("/").slice(0, -1);

  const found: string[] = [];
  let dir = pagesDir;
  if (existsSync(join(dir, fileName))) found.push(`${relativePagesDir}/${fileName}`);
  let prefix = "";
  for (const segment of directories) {
    dir = join(dir, segment);
    prefix = prefix ? `${prefix}/${segment}` : segment;
    if (existsSync(join(dir, fileName))) found.push(`${relativePagesDir}/${prefix}/${fileName}`);
  }
  return found;
}

function discoverLocalComponents(componentsDir: string): string[] {
  return walkWxFiles(componentsDir).map((file) => {
    const relativeFile = normalizeSlashes(relative(componentsDir, file));
    return relativeFile.replace(/\.wx$/, "");
  });
}

function walkWxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkWxFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".wx")) files.push(path);
  }
  return files.sort();
}

function stripQuery(id: string): string {
  return id.replace(/[?#].*$/, "");
}

function invalidateWavexFile(server: ViteDevServer, file: string): void {
  server.moduleGraph.onFileChange(file);
  invalidateVirtualModules(server);
  for (const module of server.moduleGraph.getModulesByFile(file) ?? []) server.moduleGraph.invalidateModule(module);
}

function invalidateWavexProject(server: ViteDevServer, config: ResolvedDirs): void {
  invalidateVirtualModules(server);
  for (const file of listWavexTemplateFiles(config)) {
    server.moduleGraph.onFileChange(file);
    for (const module of server.moduleGraph.getModulesByFile(file) ?? []) server.moduleGraph.invalidateModule(module);
  }
}

function invalidateVirtualModules(server: ViteDevServer): void {
  for (const id of [RESOLVED_VIRTUAL_ROUTES_ID, RESOLVED_VIRTUAL_MANIFEST_ID, RESOLVED_VIRTUAL_BOOTSTRAP_ID]) {
    const module = server.moduleGraph.getModuleById(id);
    if (module) server.moduleGraph.invalidateModule(module);
  }
}

function sendWavexHotUpdate(server: ViteDevServer, file: string): void {
  const modules = [...(server.moduleGraph.getModulesByFile(file) ?? [])];
  const updates = uniqueUpdates(modules.flatMap((module) => collectSelfAcceptedUpdates(module)));

  invalidateWavexFile(server, file);
  if (updates.length === 0) return;

  server.ws.send({
    type: "update",
    updates: updates.map((update) => ({
      type: "js-update" as const,
      path: update.path,
      acceptedPath: update.acceptedPath,
      timestamp: Date.now()
    }))
  });
}

function sendWavexFullReload(server: ViteDevServer, file: string): void {
  invalidateWavexFile(server, file);
  server.ws.send({ type: "full-reload", path: "*" });
}

function sendWavexProjectFullReload(server: ViteDevServer, config: ResolvedDirs): void {
  invalidateWavexProject(server, config);
  server.ws.send({ type: "full-reload", path: "*" });
}

interface WavexHotUpdate {
  path: string;
  acceptedPath: string;
}

// WAVEx generates page modules as the only HMR boundaries. Component edits must
// therefore update the nearest self-accepting page module; sending the component
// URL as acceptedPath does not match the generated page accept callback.
function collectSelfAcceptedUpdates(
  changedModule: ReturnType<ViteDevServer["moduleGraph"]["getModuleById"]> extends infer Module ? NonNullable<Module> : never,
  seen = new Set<unknown>()
): WavexHotUpdate[] {
  if (seen.has(changedModule)) return [];
  seen.add(changedModule);

  const modulePath = normalizeHotPath(changedModule.url);
  if (changedModule.isSelfAccepting) return [{ path: modulePath, acceptedPath: modulePath }];

  const updates: WavexHotUpdate[] = [];
  for (const importer of changedModule.importers) updates.push(...collectSelfAcceptedUpdates(importer, seen));
  return updates;
}

function uniqueUpdates(updates: WavexHotUpdate[]): WavexHotUpdate[] {
  const seen = new Set<string>();
  return updates.filter((update) => {
    const key = `${update.path}\0${update.acceptedPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHotPath(url: string): string {
  return url.replace(/[?#].*$/, "");
}

function listWavexTemplateFiles(config: ResolvedDirs): string[] {
  return [...walkWxFiles(config.pagesDir), ...walkWxFiles(config.componentsDir)];
}

function isInside(file: string, dir: string): boolean {
  const relativePath = normalizeSlashes(relative(dir, file));
  return relativePath === "" || (!relativePath.startsWith("../") && relativePath !== "..");
}

function isWavexTemplateFile(file: string, config: ResolvedDirs): boolean {
  return file.endsWith(".wx") && (isInside(file, config.pagesDir) || isInside(file, config.componentsDir));
}

function isConvexSourceFile(file: string, config: ResolvedDirs): boolean {
  return config.convexDir !== undefined && file.endsWith(".ts") && !file.endsWith(".d.ts") && isInside(file, config.convexDir);
}

/** Font Awesome self-hosting context: present when Web Awesome and a Font Awesome package with SVG files are installed. */
interface IconHost {
  webAwesomePackageName: string;
  sources: readonly FontAwesomeIconSource[];
  folderOf: IconFolderResolver;
  /** Icons Web Awesome's own components request from the default library (e.g. `<wa-page>`'s `bars`). */
  builtinIcons: ReadonlyArray<Pick<IconReference, "name" | "family" | "variant">>;
}

/** The app's servable icons (keyed `folder/name`) plus icon problems per source file. */
interface IconCollection {
  assets: Map<string, IconAsset>;
  problems: Array<{ file: string; diagnostic: Diagnostic }>;
}

async function createIconHost(capabilities: ProjectCapabilities): Promise<IconHost | undefined> {
  const webAwesome = capabilities.webAwesome;
  const sources = capabilities.fontAwesome.iconSources;
  if (!webAwesome || sources.length === 0) return undefined;
  return {
    webAwesomePackageName: webAwesome.packageName,
    sources,
    folderOf: await loadWebAwesomeIconFolder(webAwesome.packageDir),
    builtinIcons: readWebAwesomeDefaultLibraryIcons(webAwesome.packageDir)
  };
}

function collectAppIconAssets(root: string, host: IconHost, parseOptions: Omit<ParseWavexOptions, "fileName">): IconCollection {
  const assets = new Map<string, IconAsset>();
  const problems: IconCollection["problems"] = [];
  const serve = (icon: Pick<IconReference, "name" | "family" | "variant">) => {
    const asset = resolveIconAsset(icon, host.folderOf, host.sources);
    if (asset) assets.set(`${asset.folder}/${asset.name}`, asset);
  };
  for (const entry of collectAppIcons(root, parseOptions)) {
    const diagnostics = [...entry.diagnostics, ...validateIconReferences(entry.icons, host.folderOf, host.sources)];
    diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
    for (const diagnostic of diagnostics) problems.push({ file: entry.file, diagnostic });
    entry.icons.forEach(serve);
  }
  host.builtinIcons.forEach(serve);
  return { assets, problems };
}

function generateIconsModule(host: IconHost | undefined, assetsDir: string): string {
  if (!host) {
    return [
      `// No installed Font Awesome package ships SVG files, so Web Awesome's default`,
      `// icon library keeps loading icons from the Font Awesome CDN.`,
      `export {};`,
      ``
    ].join("\n");
  }
  return [
    `// Web Awesome's default icon library loads the app's collected Font Awesome icons`,
    `// (${host.sources.map((source) => source.packageName).join(", ")}) from this app instead of the CDN.`,
    `import { setIconPath } from ${JSON.stringify(`${host.webAwesomePackageName}/dist/utilities/base-path.js`)};`,
    `setIconPath(import.meta.env.BASE_URL + ${JSON.stringify(`${assetsDir}/${ICONS_DIR}`)});`,
    ``
  ].join("\n");
}

/** Dev-server handler for `<base><assetsDir>/wavex-icons/<folder>/<name>.svg`: collected icons only, like the build. */
function iconRequestHandler(
  prefix: string,
  host: IconHost,
  currentIcons: () => IconCollection,
  logError: (message: string) => void
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const pathname = (req.url ?? "").replace(/[?#].*$/, "");
    if (!pathname.startsWith(prefix)) {
      next();
      return;
    }
    const match = /^([a-z0-9-]+)\/([a-z0-9-]+)\.svg$/.exec(pathname.slice(prefix.length));
    const asset = match ? currentIcons().assets.get(`${match[1]}/${match[2]}`) : undefined;
    if (!asset) {
      res.statusCode = 404;
      res.end();
      logError(uncollectedIconMessage(pathname, match?.[1], match?.[2], host));
      return;
    }
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-cache");
    res.end(readFileSync(asset.file));
  };
}

function uncollectedIconMessage(pathname: string, folder: string | undefined, name: string | undefined, host: IconHost): string {
  if (!folder || !name) return `[wavex] ${pathname} is not a Font Awesome icon URL WAVEx serves.`;
  const packages = host.sources.map((source) => source.packageName).join(", ");
  const installed = host.sources.some((source) => existsSync(join(source.svgDir, folder, `${name}.svg`)));
  const declaration = folder === "solid" ? `icon("${name}")` : `icon("${name}", { family, variant })`;
  return [
    `[wavex] Icon ${folder}/${name}.svg was requested but the app does not reference it, so WAVEx does not serve it (a build would not include it either).`,
    installed ? "" : ` ${packages} has no ${folder}/${name}.svg.`,
    ` Write the name as a literal (@icon name:${name}), as a string literal in the name:{{ … }} expression,`,
    ` or declare it where TypeScript computes it with ${declaration} from @wavex/runtime.`
  ].join("");
}

function formatIconProblems(problems: IconCollection["problems"], root: string): string {
  return problems.map(({ file, diagnostic }) => formatFileDiagnostic(normalizeSlashes(relative(root, file)), diagnostic)).join("\n");
}
