import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { LanguageClient, TransportKind, type LanguageClientOptions, type ServerOptions } from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.cjs"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ["--inspect=6019"] } }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "wavex" }],
    initializationOptions: {
      typescript: { tsdk: resolveTsdk() }
    },
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.wx")
    }
  };

  client = new LanguageClient("wavex", "WAVEx Language Server", serverOptions, clientOptions);
  await client.start();
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
}

/** Workspace TypeScript first (configurable), since the server type-checks against the project's own TS. */
function resolveTsdk(): string {
  const configured = vscode.workspace.getConfiguration("wavex").get<string>("typescript.tsdk");
  if (configured) return configured;
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const candidate = path.join(folder.uri.fsPath, "node_modules", "typescript", "lib");
    if (fs.existsSync(path.join(candidate, "typescript.js"))) return candidate;
  }
  return "node_modules/typescript/lib";
}
