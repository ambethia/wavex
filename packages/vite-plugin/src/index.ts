import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes } from "@wavex/core";
import type { Plugin, ViteDevServer } from "vite";
import { transformWithOxc } from "vite";

export interface WavexVitePluginOptions {
  appDir?: string;
  pagesDir?: string;
  componentsDir?: string;
  webAwesomeComponents?: readonly string[];
}

const VIRTUAL_ROUTES_ID = "virtual:wavex/routes";
const RESOLVED_VIRTUAL_ROUTES_ID = `\0${VIRTUAL_ROUTES_ID}`;

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
      const config = resolveDirs(server.config.root, options);
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
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ROUTES_ID) return undefined;
      const config = resolveDirs(projectRoot, options);
      const routes = discoverRoutes(config.pagesDir, projectRoot);
      return [
        `export const routes = ${JSON.stringify(routes, null, 2)};`,
        `export default routes;`,
        ""
      ].join("\n");
    },
    async transform(code, id) {
      const file = stripQuery(id);
      if (!file.endsWith(".wx")) return undefined;
      this.addWatchFile(file);
      const config = resolveDirs(projectRoot, options);
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
      const config = resolveDirs(projectRoot, options);
      if (!isWavexTemplateFile(ctx.file, config)) return undefined;

      invalidateWavexFile(ctx.server, ctx.file);
      return [];
    }
  };
}

export default wavex;

interface ResolvedDirs {
  appDir: string;
  pagesDir: string;
  componentsDir: string;
}

function resolveDirs(root: string, options: WavexVitePluginOptions): ResolvedDirs {
  const defaults = createDefaultConfig(options.appDir ?? "src");
  let appDir = resolve(root, options.appDir ?? defaults.appDir);
  let pagesDir = resolve(root, options.pagesDir ?? defaults.pagesDir);
  let componentsDir = resolve(root, options.componentsDir ?? defaults.componentsDir);

  if (!options.appDir && !options.pagesDir && !existsSync(pagesDir) && existsSync(resolve(root, "app/pages"))) {
    appDir = resolve(root, "app");
    pagesDir = resolve(root, "app/pages");
    if (!options.componentsDir) componentsDir = resolve(root, "app/components");
  }

  return { appDir, pagesDir, componentsDir };
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
