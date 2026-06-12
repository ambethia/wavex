import { build } from "esbuild";

// The client bundle (loaded by VS Code) and the server bundle (spawned as a
// node process). typescript stays external: Volar loads the workspace tsdk
// from disk at runtime.
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.cjs",
  format: "cjs",
  platform: "node",
  target: "node18",
  external: ["vscode"],
  sourcemap: true
});

await build({
  entryPoints: ["node_modules/@wavex/lsp/dist/server.js"],
  bundle: true,
  outfile: "dist/server.cjs",
  format: "cjs",
  platform: "node",
  target: "node18",
  external: ["typescript"],
  sourcemap: true
});

console.log("built dist/extension.cjs and dist/server.cjs");
