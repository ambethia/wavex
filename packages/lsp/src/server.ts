/**
 * Standalone `wavex-language-server` entry point: wires the WAVEx Volar
 * language and service plugins into `@volar/language-server` with a real
 * TypeScript project, for editors that speak LSP directly.
 *
 * Import from `@wavex/lsp/server` (or run the `wavex-language-server` bin).
 *
 * @module server
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from "@volar/language-server/node.js";
import {
  detectCapabilities,
  discoverConvexFunctionKinds,
  discoverLocalComponents,
  readManifestComponentDetails,
  readUtilityClasses
} from "@wavex/core/capabilities";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";
import { createWavexLanguagePlugin } from "./language.js";
import { createWavexServicePlugin, type WavexServiceOptions } from "./service.js";

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(
    (params.initializationOptions as { typescript?: { tsdk?: string } } | undefined)?.typescript?.tsdk ??
      "node_modules/typescript/lib",
    params.locale
  );

  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [createWavexLanguagePlugin()]
    })),
    [...createTypeScriptServices(tsdk.typescript), createWavexServicePlugin(optionsForDocument)]
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);

const optionsCache = new Map<string, WavexServiceOptions>();

/**
 * Per-document project context: walk up from the .wx file to the nearest
 * directory with a package.json (the app root in a monorepo), then derive
 * completion sources — local components, the installed Web Awesome manifest,
 * and Convex function references.
 */
function optionsForDocument(documentUri: string): WavexServiceOptions {
  try {
    const uri = URI.parse(documentUri);
    if (uri.scheme !== "file") return {};
    const root = findAppRoot(dirname(uri.fsPath));
    if (!root) return {};

    const cached = optionsCache.get(root);
    if (cached) return { ...cached, ...discoverConvexServiceOptions(root) };

    const capabilities = detectCapabilities(root);
    const options: WavexServiceOptions = {
      localComponents: discoverLocalComponents(root),
      webAwesomeComponents: capabilities.webAwesome ? [...capabilities.webAwesome.components].sort() : [],
      webAwesomeDetails: capabilities.webAwesome
        ? readManifestComponentDetails(join(capabilities.webAwesome.packageDir, "dist", "custom-elements.json"))
        : undefined,
      utilityClasses: capabilities.webAwesome ? readUtilityClasses(capabilities.webAwesome.packageDir) : [],
      ...discoverConvexServiceOptions(root)
    };
    optionsCache.set(root, options);
    return options;
  } catch {
    return {};
  }
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
