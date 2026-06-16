import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  detectCapabilities,
  discoverConvexFunctionKinds,
  discoverLocalComponents,
  readManifestComponentDetails,
  readUtilityClasses
} from "@wavex/core/capabilities";
import { URI } from "vscode-uri";
import type { WavexServiceOptions } from "./service.js";

/**
 * Resolve the WAVEx service context for one source document.
 *
 * The resolver deliberately reads project capabilities on every request instead
 * of caching per app root. Editors ask for this context after file-system
 * changes (new local components, installed Web Awesome manifests, generated
 * Convex functions); a stale cache makes completions and diagnostics lie until
 * the language server restarts.
 */
export function optionsForDocument(documentUri: string): WavexServiceOptions {
  const uri = URI.parse(documentUri);
  if (uri.scheme !== "file") return {};
  const root = findAppRoot(dirname(uri.fsPath));
  if (!root) return {};

  const capabilities = detectCapabilities(root);
  return {
    localComponents: discoverLocalComponents(root),
    webAwesomeComponents: capabilities.webAwesome ? [...capabilities.webAwesome.components].sort() : [],
    webAwesomeDetails: capabilities.webAwesome
      ? readManifestComponentDetails(join(capabilities.webAwesome.packageDir, "dist", "custom-elements.json"))
      : undefined,
    utilityClasses: capabilities.webAwesome ? readUtilityClasses(capabilities.webAwesome.packageDir) : [],
    ...discoverConvexServiceOptions(root)
  };
}

function discoverConvexServiceOptions(root: string): Pick<WavexServiceOptions, "convexFunctions" | "convexFunctionKinds"> {
  const convexFunctionKinds = discoverConvexFunctionKinds(root);
  return {
    convexFunctions: Object.keys(convexFunctionKinds)
      .filter((reference) => {
        const kind = convexFunctionKinds[reference];
        return kind === "query" || kind === "mutation" || kind === "action";
      })
      .sort(),
    convexFunctionKinds
  };
}

function findAppRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (let depth = 0; depth < 30; depth += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}
