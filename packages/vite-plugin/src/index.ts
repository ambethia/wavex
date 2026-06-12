import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes } from "@wavex/core";
import type { Plugin, ViteDevServer } from "vite";
import { transformWithOxc } from "vite";

export interface WavexVitePluginOptions {
  webAwesomeComponents?: readonly string[];
}

const VIRTUAL_ROUTES_ID = "virtual:wavex/routes";
const RESOLVED_VIRTUAL_ROUTES_ID = `\0${VIRTUAL_ROUTES_ID}`;
const VIRTUAL_BOOTSTRAP_ID = "virtual:wavex/bootstrap";
const BOOTSTRAP_PUBLIC_ID = "/@wavex/bootstrap";
const RESOLVED_VIRTUAL_BOOTSTRAP_ID = `\0${VIRTUAL_BOOTSTRAP_ID}`;

export function wavex(options: WavexVitePluginOptions = {}): Plugin {
  let projectRoot = process.cwd();

  return {
    name: "wavex",
    enforce: "pre",
    config() {
      return {
        resolve: {
          dedupe: ["lit", "lit-html", "@lit/reactive-element"]
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
        return [
          `export const routes = ${JSON.stringify(routes, null, 2)};`,
          `export default routes;`,
          ""
        ].join("\n");
      }
      if (id === RESOLVED_VIRTUAL_BOOTSTRAP_ID) return generateBootstrapModule(config, projectRoot);
      return undefined;
    },
    async transform(code, id) {
      const file = stripQuery(id);
      if (!file.endsWith(".wx")) return undefined;
      this.addWatchFile(file);
      const config = resolveDirs(projectRoot);
      const localComponents = discoverLocalComponents(config.componentsDir);
      const compiled = compileWavexModule(code, {
        id: normalizeSlashes(relative(projectRoot, file)),
        localComponents,
        webAwesomeComponents: options.webAwesomeComponents
      });

      const error = compiled.ast.diagnostics.find((diagnostic) => diagnostic.severity === "error");
      if (error) {
        this.error({
          id: file,
          message: formatDiagnostic(error),
          loc: { line: error.line, column: error.column - 1 }
        });
      }

      return transformWithOxc(compiled.code, `${file}.ts`, {
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

function generateBootstrapModule(config: ResolvedDirs, root: string): string {
  const pageImportPath = publicImportPath(root, join(config.pagesDir, "index.wx"));
  const styleImport = existsSync(config.styleFile) ? `import ${JSON.stringify(publicImportPath(root, config.styleFile))};` : "";
  const apiImport = existsSync(config.convexApiFile)
    ? `import { api as convexApi } from ${JSON.stringify(publicImportPath(root, config.convexApiFile))};`
    : `const convexApi = undefined;`;

  return [
    `import { mountLitPage } from "@wavex/runtime/lit";`,
    `import { createConvexActionClient, createConvexResourceClient } from "@wavex/runtime";`,
    `import { ConvexClient } from "convex/browser";`,
    `import * as page from ${JSON.stringify(pageImportPath)};`,
    styleImport,
    apiImport,
    ``,
    `const root = document.querySelector("#app");`,
    `if (!root) throw new Error("Missing #app mount node");`,
    ``,
    `const convexUrl = import.meta.env.VITE_CONVEX_URL;`,
    `const hasResources = (page.resources?.length ?? 0) > 0;`,
    `const convex = convexUrl ? new ConvexClient(convexUrl) : undefined;`,
    `if (hasResources && !convex) throw new Error("Missing VITE_CONVEX_URL for WAVEx Convex resources");`,
    ``,
    `const app = mountLitPage(root, page, {}, {`,
    `  resourceClient: convex ? createConvexResourceClient(convex, { api: convexApi }) : undefined,`,
    `  actionClient: convex ? createConvexActionClient(convex, { api: convexApi }) : undefined,`,
    `});`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept(${JSON.stringify(pageImportPath)}, (nextModule) => {`,
    `    if (!nextModule?.default) return;`,
    `    app.setRender(nextModule.default);`,
    `    app.setResources(nextModule.resources ?? []);`,
    `  });`,
    `  import.meta.hot.dispose(() => {`,
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

  const updates: WavexHotUpdate[] = [];
  for (const importer of changedModule.importers) {
    const importerPath = normalizeHotPath(importer.url);
    const acceptsChangedModule = [...importer.acceptedHmrDeps].some(
      (dep) => normalizeHotPath(dep.url) === acceptedPath
    );
    if (acceptsChangedModule || importer.isSelfAccepting) {
      updates.push({ path: importerPath, acceptedPath });
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
