import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { compileWavexModule } from "@wavex/compiler";
import { createDefaultConfig, createRouteDefinition, formatDiagnostic, normalizeSlashes, parseWavex } from "@wavex/core";

export type ViteCommand = "dev" | "build";
export type ViteRunner = (args: string[]) => void;

export async function runCli(argv: readonly string[] = process.argv.slice(2), viteRunner: ViteRunner = proxyVite) {
  const [command = "help", ...args] = argv;

  switch (command) {
    case "check":
      await check(args[0] ?? process.cwd());
      break;
    case "routes":
      routes(args[0] ?? process.cwd());
      break;
    case "compile":
      compile(args[0]);
      break;
    case "dev":
      viteRunner(viteArgsForWavexCommand("dev", args));
      break;
    case "build":
      viteRunner(viteArgsForWavexCommand("build", args));
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
}

export function viteArgsForWavexCommand(command: ViteCommand, args: readonly string[]): string[] {
  switch (command) {
    case "dev":
      return [...args];
    case "build":
      return ["build", ...args];
  }
}

function help() {
  console.log(`wavex

Commands:
  wavex check [root]       Parse .wx files and print diagnostics.
  wavex routes [root]      Print file-based page routes.
  wavex compile <file.wx>  Compile one .wx file to a Lit render module.
  wavex dev [args...]      Proxy to vite dev; pass --host explicitly to expose it.
  wavex build [args...]    Proxy to vite build for now.
  wavex prerender [root]   Prerender static, resource-free routes into dist/.
`);
}

async function check(rootInput: string) {
  const root = resolve(rootInput);
  const files = walkWxFiles(root);
  let errorCount = 0;

  // Capability context: the app root holds node_modules and src/components.
  const { detectCapabilities, discoverLocalComponents, validateComponentReferences } = await import("@wavex/core/capabilities");
  const appRoot = resolveWavexAppRoot(root);
  const capabilities = detectCapabilities(appRoot);
  const localComponents = discoverLocalComponents(appRoot);

  for (const file of files) {
    const parsed = parseWavex(readFileSync(file, "utf8"), { fileName: file });
    const capabilityDiagnostics = validateComponentReferences(parsed, {
      localComponents,
      webAwesome: capabilities.webAwesome,
      fontAwesome: capabilities.fontAwesome
    });
    for (const diagnostic of [...parsed.diagnostics, ...capabilityDiagnostics]) {
      if (diagnostic.severity === "error") errorCount += 1;
      console.log(`${normalizeSlashes(relative(root, file))}: ${formatDiagnostic(diagnostic)}`);
    }
  }

  const summary = capabilities.webAwesome
    ? `Web Awesome: ${capabilities.webAwesome.packageName} (${capabilities.webAwesome.components.size} components)`
    : "Web Awesome: not installed";
  const fa = capabilities.fontAwesome;
  const faSummary =
    fa.kits.length > 0 || fa.packages.length > 0
      ? `Font Awesome: ${[...fa.kits, ...fa.packages].join(", ")}`
      : "Font Awesome: none installed";
  console.log(`Checked ${files.length} .wx file${files.length === 1 ? "" : "s"}. ${summary}; ${faSummary}.`);
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
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
    return;
  }
  if (typeof result.status === "number") {
    process.exitCode = result.status;
    return;
  }
  if (result.signal) console.error(`vite terminated by signal ${result.signal}`);
  else console.error("vite exited without a status");
  process.exitCode = 1;
}

function resolveWavexAppRoot(scanRoot: string): string {
  let current = scanRoot;
  while (true) {
    if (isWavexAppRoot(current)) return current;
    if (isWavexSourceRoot(current)) return dirname(current);

    const parent = dirname(current);
    if (parent === current) return scanRoot;
    current = parent;
  }
}

function isWavexAppRoot(dir: string): boolean {
  return existsSync(join(dir, createDefaultConfig().pagesDir)) || existsSync(join(dir, createDefaultConfig().componentsDir));
}

function isWavexSourceRoot(dir: string): boolean {
  return basename(dir) === createDefaultConfig().sourceDir && (existsSync(join(dir, "pages")) || existsSync(join(dir, "components")));
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
