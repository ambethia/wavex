/**
 * Vite+ integration for WAVEx apps: compiles `.wx` modules on demand, serves
 * the generated route table and bootstrap module, and drives HMR.
 *
 * Vite+ is the primary dev/build substrate by design — it provides the module
 * graph, HMR, package integration, and production bundling so WAVEx only owns
 * what is WAVEx-specific: the file-convention route table
 * (`virtual:wavex/routes`), the bootstrap entry (`/@wavex/bootstrap`, which
 * renders the app directly under `<body>` with no framework mount div), and
 * `.wx` hot updates that preserve Convex client state across template edits.
 *
 * The `@wavex/vite-plugin/client` subpath ships ambient module declarations
 * for `*.wx` imports; apps reference it from their tsconfig `types`.
 *
 * @module @wavex/vite-plugin
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes } from "@wavex/core";
import { detectCapabilities, discoverConvexFunctionKinds, type ProjectCapabilities } from "@wavex/core/capabilities";
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
const VIRTUAL_BOOTSTRAP_ID = "virtual:wavex/bootstrap";
const BOOTSTRAP_PUBLIC_ID = "/@wavex/bootstrap";
const RESOLVED_VIRTUAL_BOOTSTRAP_ID = `\0${VIRTUAL_BOOTSTRAP_ID}`;

/**
 * The WAVEx Vite plugin. Compiles `.wx` files to Lit render modules on
 * demand, serves `virtual:wavex/routes` (the file-convention route table with
 * lazy per-route loaders, layouts, and error pages) and the
 * `/@wavex/bootstrap` entry, dedupes Lit, and sends targeted Vite HMR
 * updates for template edits so Convex client state survives `.wx` edits.
 */
export function wavex(options: WavexVitePluginOptions = {}): Plugin {
  let projectRoot = process.cwd();
  let capabilities: ProjectCapabilities | undefined;
  const projectCapabilities = () => (capabilities ??= detectCapabilities(projectRoot));

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
    },
    configureServer(server) {
      const config = resolveDirs(server.config.root);
      server.watcher.add([config.pagesDir, config.componentsDir].filter(existsSync));
      server.middlewares.use((request, _response, next) => {
        const file = fileFromRequestUrl(request.url, server.config.root);
        if (file && isWavexTemplateFile(file, config)) invalidateWavexFile(server, file);
        next();
      });
      const mtimes = snapshotWavexMtimes(config);
      server.watcher.on("change", (file) => {
        if (!isWavexTemplateFile(file, config)) return;
        const mtime = safeMtime(file);
        if (mtime !== undefined) mtimes.set(file, mtime);
        sendWavexHotUpdate(server, file);
      });

      const pollTimer = setInterval(() => {
        for (const file of listWavexTemplateFiles(config)) {
          const mtime = safeMtime(file);
          if (mtime === undefined) continue;
          const previous = mtimes.get(file);
          mtimes.set(file, mtime);
          if (previous !== undefined && mtime > previous) sendWavexHotUpdate(server, file);
        }
      }, 300);
      pollTimer.unref?.();
      server.httpServer?.once("close", () => clearInterval(pollTimer));
    },
    resolveId(id) {
      if (id === VIRTUAL_ROUTES_ID) return RESOLVED_VIRTUAL_ROUTES_ID;
      if (id === VIRTUAL_BOOTSTRAP_ID || id === BOOTSTRAP_PUBLIC_ID) return RESOLVED_VIRTUAL_BOOTSTRAP_ID;
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
      if (id === RESOLVED_VIRTUAL_BOOTSTRAP_ID) return generateBootstrapModule(config, projectRoot, options);
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
          (detected.webAwesome ? [...detected.webAwesome.components] : undefined)
      });

      const error = compiled.ast.diagnostics.find((diagnostic) => diagnostic.severity === "error");
      if (error) {
        this.error({
          id: file,
          message: formatDiagnostic(error),
          loc: { line: error.line, column: error.column - 1 }
        });
      }

      // Capability-driven imports: load only the Web Awesome components this
      // template uses, from whichever package (free/pro) is installed.
      let moduleCode = compiled.code;
      if (detected.webAwesome && compiled.usedWebAwesomeComponents.length > 0) {
        const importLines = compiled.usedWebAwesomeComponents
          .filter((name) => detected.webAwesome!.components.has(name))
          .map((name) => `import "${detected.webAwesome!.packageName}/dist/components/${name}/${name}.js";`)
          .join("\n");
        if (importLines) moduleCode = `${importLines}\n${moduleCode}`;
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
  convexApiFile: string;
}

function resolveDirs(root: string): ResolvedDirs {
  const defaults = createDefaultConfig();
  return {
    pagesDir: resolve(root, defaults.pagesDir),
    componentsDir: resolve(root, defaults.componentsDir),
    styleFile: resolve(root, defaults.sourceDir, "style.css"),
    convexApiFile: resolve(root, defaults.apiDir, "_generated/api.js")
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

function generateBootstrapModule(config: ResolvedDirs, root: string, options: WavexVitePluginOptions = {}): string {
  const styleImport = existsSync(config.styleFile) ? `import ${JSON.stringify(publicImportPath(root, config.styleFile))};` : "";
  const apiImport = existsSync(config.convexApiFile)
    ? `import { api as convexApi } from ${JSON.stringify(publicImportPath(root, config.convexApiFile))};`
    : `const convexApi = undefined;`;

  return [
    `import { mountLit } from "@wavex/runtime/lit";`,
    `import { createClientRouter, createConvexActionClient, createConvexResourceClient, createPostHogCaptureClient } from "@wavex/runtime";`,
    `import { ConvexClient } from "convex/browser";`,
    `import routes from "virtual:wavex/routes";`,
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
    `const convexFunctionKinds = ${JSON.stringify(actionKindMap(root))};`,
    `const app = mountLit(root, () => undefined, {}, {`,
    `  resourceClient: convex ? createConvexResourceClient(convex, { api: convexApi }) : undefined,`,
    `  actionClient: convex ? createConvexActionClient(convex, { api: convexApi }) : undefined,`,
    `  resolveActionKind: (definition) => convexFunctionKinds[definition.modulePath + ":" + definition.functionName],`,
    `  analytics,`,
    `});`,
    ``,
    `const router = createClientRouter({`,
    `  routes,`,
    `  host: app,`,
    `  viewTransitions: ${JSON.stringify(options.viewTransitions ?? true)},`,
    `  onNavigate: (route) => analytics?.capture("$pageview", { $current_url: location.href, path: route.path }),`,
    `});`,
    `globalThis.__wavexHotReplacePage = (file, module) => router.hotReplacePage(file, module);`,
    `void router.navigate(location.pathname + location.search, { replace: true });`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.dispose(() => {`,
    `    delete globalThis.__wavexHotReplacePage;`,
    `    router.dispose();`,
    `    app.dispose();`,
    `    void convex?.close?.();`,
    `  });`,
    `}`,
    ``
  ].filter((line) => line !== "").join("\n");
}

function publicImportPath(root: string, file: string): string {
  return `/${normalizeSlashes(relative(root, file))}`;
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

function fileFromRequestUrl(url: string | undefined, root: string): string | undefined {
  if (!url || !url.includes(".wx")) return undefined;
  try {
    const pathname = decodeURIComponent(new URL(url, "http://wavex.local").pathname);
    return resolve(root, pathname.replace(/^\/+/, ""));
  } catch {
    return undefined;
  }
}

function invalidateWavexFile(server: ViteDevServer, file: string): void {
  server.moduleGraph.onFileChange(file);
  const routesModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ROUTES_ID);
  if (routesModule) server.moduleGraph.invalidateModule(routesModule);
  for (const module of server.moduleGraph.getModulesByFile(file) ?? []) server.moduleGraph.invalidateModule(module);
}

function sendWavexHotUpdate(server: ViteDevServer, file: string): void {
  const modules = [...(server.moduleGraph.getModulesByFile(file) ?? [])];
  const updates = uniqueUpdates(
    modules.flatMap((module) => collectAcceptedUpdates(module, normalizeHotPath(module.url)))
  );

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

interface WavexHotUpdate {
  path: string;
  acceptedPath: string;
}

function collectAcceptedUpdates(
  changedModule: ReturnType<ViteDevServer["moduleGraph"]["getModuleById"]> extends infer Module ? NonNullable<Module> : never,
  acceptedPath: string,
  seen = new Set<unknown>()
): WavexHotUpdate[] {
  if (seen.has(changedModule)) return [];
  seen.add(changedModule);

  const modulePath = normalizeHotPath(changedModule.url);
  if (changedModule.isSelfAccepting) return [{ path: modulePath, acceptedPath: modulePath }];

  const updates: WavexHotUpdate[] = [];
  for (const importer of changedModule.importers) {
    const importerPath = normalizeHotPath(importer.url);
    const acceptsChangedModule = [...importer.acceptedHmrDeps].some(
      (dep) => normalizeHotPath(dep.url) === acceptedPath
    );
    if (acceptsChangedModule) {
      updates.push({ path: importerPath, acceptedPath });
    } else if (importer.isSelfAccepting) {
      updates.push({ path: importerPath, acceptedPath: importerPath });
    } else {
      updates.push(...collectAcceptedUpdates(importer, acceptedPath, seen));
    }
  }
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

function snapshotWavexMtimes(config: ResolvedDirs): Map<string, number> {
  return new Map(listWavexTemplateFiles(config).flatMap((file) => {
    const mtime = safeMtime(file);
    return mtime === undefined ? [] : [[file, mtime]];
  }));
}

function safeMtime(file: string): number | undefined {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}

function isInside(file: string, dir: string): boolean {
  const relativePath = normalizeSlashes(relative(dir, file));
  return relativePath === "" || (!relativePath.startsWith("../") && relativePath !== "..");
}

function isWavexTemplateFile(file: string, config: ResolvedDirs): boolean {
  return file.endsWith(".wx") && (isInside(file, config.pagesDir) || isInside(file, config.componentsDir));
}
