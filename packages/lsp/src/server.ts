import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from "@volar/language-server/node.js";
import {
  detectCapabilities,
  discoverConvexFunctionKinds,
  discoverLocalComponents
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
    [...createTypeScriptServices(tsdk.typescript), createWavexServicePlugin(projectServiceOptions(params))]
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);

/** Completion sources from the first workspace folder: local components, installed Web Awesome, Convex functions. */
function projectServiceOptions(params: {
  workspaceFolders?: { uri: string }[] | null;
  rootUri?: string | null;
}): WavexServiceOptions {
  const rootUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
  if (!rootUri) return {};
  try {
    const root = URI.parse(rootUri).fsPath;
    const capabilities = detectCapabilities(root);
    return {
      localComponents: discoverLocalComponents(root),
      webAwesomeComponents: capabilities.webAwesome ? [...capabilities.webAwesome.components].sort() : [],
      convexFunctions: Object.keys(discoverConvexFunctionKinds(root)).sort()
    };
  } catch {
    return {};
  }
}
