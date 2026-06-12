#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes, parseWavex } from "@wavex/core";

const [command = "help", ...args] = process.argv.slice(2);

switch (command) {
  case "check":
    check(args[0] ?? process.cwd());
    break;
  case "routes":
    routes(args[0] ?? process.cwd());
    break;
  case "compile":
    compile(args[0]);
    break;
  case "dev":
    proxyVite(["--host", ...args]);
    break;
  case "build":
    proxyVite(["build", ...args]);
    break;
  case "prerender":
    await (await import("./prerender.js")).prerender(args[0] ?? process.cwd());
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    console.error(`Unknown wavex command: ${command}`);
    help();
    process.exitCode = 1;
}

function help() {
  console.log(`wavex

Commands:
  wavex check [root]       Parse .wx files and print diagnostics.
  wavex routes [root]      Print file-based page routes.
  wavex compile <file.wx>  Compile one .wx file to a Lit render module.
  wavex dev [args...]      Proxy to vite dev for now.
  wavex build [args...]    Proxy to vite build for now.
  wavex prerender [root]   Prerender static, resource-free routes into dist/.
`);
}

function check(rootInput: string) {
  const root = resolve(rootInput);
  const files = walkWxFiles(root);
  let errorCount = 0;

  for (const file of files) {
    const parsed = parseWavex(readFileSync(file, "utf8"), { fileName: file });
    for (const diagnostic of parsed.diagnostics) {
      if (diagnostic.severity === "error") errorCount += 1;
      console.log(`${normalizeSlashes(relative(root, file))}: ${formatDiagnostic(diagnostic)}`);
    }
  }

  console.log(`Checked ${files.length} .wx file${files.length === 1 ? "" : "s"}.`);
  if (errorCount > 0) process.exitCode = 1;
}

function routes(rootInput: string) {
  const root = resolve(rootInput);
  const pagesDir = resolve(root, createDefaultConfig().pagesDir);
  const relativePagesDir = normalizeSlashes(relative(root, pagesDir));
  const routeDefs = walkWxFiles(pagesDir)
    .map((file) => createRouteDefinition(normalizeSlashes(relative(root, file)), relativePagesDir))
    .filter((route) => route !== undefined);

  for (const route of routeDefs) console.log(`${route.path}\t${route.file}`);
}

function compile(fileInput: string | undefined) {
  if (!fileInput) {
    console.error("Usage: wavex compile <file.wx>");
    process.exitCode = 1;
    return;
  }
  const file = resolve(fileInput);
  const source = readFileSync(file, "utf8");
  const compiled = compileWavexModule(source, { id: normalizeSlashes(file) });
  for (const diagnostic of compiled.ast.diagnostics) console.error(formatDiagnostic(diagnostic));
  if (compiled.ast.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write(compiled.code);
}

function proxyVite(args: string[]) {
  const result = spawnSync("pnpm", ["exec", "vite", ...args], { stdio: "inherit" });
  if (typeof result.status === "number") process.exitCode = result.status;
  else if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  }
}

function walkWxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkWxFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".wx")) files.push(path);
  }
  return files.sort();
}
