import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes } from "@wavex/core";
import type { Plugin } from "vite";
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
    configResolved(config) {
      projectRoot = config.root;
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
      if (!id.endsWith(".wx")) return undefined;
      const config = resolveDirs(projectRoot, options);
      const localComponents = discoverLocalComponents(config.componentsDir);
      const compiled = compileWavexModule(code, {
        id: normalizeSlashes(relative(projectRoot, id)),
        localComponents,
        webAwesomeComponents: options.webAwesomeComponents
      });

      const error = compiled.ast.diagnostics.find((diagnostic) => diagnostic.severity === "error");
      if (error) {
        this.error({
          id,
          message: formatDiagnostic(error),
          loc: { line: error.line, column: error.column - 1 }
        });
      }

      return transformWithOxc(compiled.code, `${id}.ts`, {
        lang: "ts",
        sourcemap: true,
        target: "es2022"
      });
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
  const defaults = createDefaultConfig(options.appDir ?? "app");
  const appDir = resolve(root, options.appDir ?? defaults.appDir);
  return {
    appDir,
    pagesDir: resolve(root, options.pagesDir ?? defaults.pagesDir),
    componentsDir: resolve(root, options.componentsDir ?? defaults.componentsDir)
  };
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
