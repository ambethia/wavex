/**
 * Standalone `wavex-language-server` entry point: wires the WAVEx Volar
 * language and service plugins into `@volar/language-server` with a real
 * TypeScript project, for editors that speak LSP directly.
 *
 * Import from `@wavex/lsp/server` (or run the `wavex-language-server` bin).
 *
 * @module server
 */
import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from "@volar/language-server/node.js";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { createWavexLanguagePlugin } from "./language.js";
import { optionsForDocument } from "./project-context.js";
import { createWavexServicePlugin } from "./service.js";

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

