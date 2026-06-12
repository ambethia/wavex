import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from "@volar/language-server/node.js";
import { createWavexLanguagePlugin } from "./language.js";
import { createWavexServicePlugin } from "./service.js";
import { create as createTypeScriptServices } from "volar-service-typescript";

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
    [...createTypeScriptServices(tsdk.typescript), createWavexServicePlugin()]
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
