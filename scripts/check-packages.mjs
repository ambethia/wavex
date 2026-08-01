import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = [
  "packages/core",
  "packages/compiler",
  "packages/runtime",
  "packages/vite-plugin",
  "packages/lsp",
  "packages/wavex"
];
const requiredFiles = new Map([
  ["@wavex/core", ["dist/index.js", "dist/index.d.ts", "dist/capabilities.js"]],
  ["@wavex/compiler", ["dist/index.js", "dist/index.d.ts"]],
  ["@wavex/runtime", ["dist/index.js", "dist/lit.js"]],
  ["@wavex/vite-plugin", ["dist/index.js", "client.d.ts"]],
  ["@wavex/lsp", ["dist/index.js", "dist/server.js", "bin/wavex-language-server.js"]],
  ["wavex", ["dist/index.js", "dist/cli.js"]]
]);

const outputFlag = process.argv.indexOf("--output");
const retainedOutput = outputFlag === -1 ? undefined : process.argv[outputFlag + 1];
if (outputFlag !== -1 && !retainedOutput) {
  throw new Error("--output requires a destination directory");
}

const scratch = await mkdtemp(join(tmpdir(), "wavex-package-check-"));
const packDirectory = retainedOutput ? resolve(root, retainedOutput) : join(scratch, "packs");
const consumerDirectory = join(scratch, "consumer");
await mkdir(packDirectory, { recursive: true });
await mkdir(consumerDirectory, { recursive: true });

function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

try {
  const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const packed = [];

  for (const packageDirectory of packageDirectories) {
    const output = run("pnpm", ["--dir", packageDirectory, "pack", "--pack-destination", packDirectory, "--json"]);
    const result = JSON.parse(output);
    const manifest = JSON.parse(await readFile(join(root, packageDirectory, "package.json"), "utf8"));
    const paths = new Set(result.files.map((file) => file.path));

    if (manifest.private) throw new Error(`${manifest.name} is unexpectedly private`);
    if (result.version !== rootManifest.version) {
      throw new Error(`${result.name} is ${result.version}; expected ${rootManifest.version}`);
    }
    if (manifest.license !== "MIT" || !paths.has("LICENSE")) {
      throw new Error(`${result.name} must ship its MIT license`);
    }
    if ([...paths].some((path) => path.endsWith(".tsbuildinfo") || path.startsWith("src/") || path.startsWith("test/"))) {
      throw new Error(`${result.name} contains source, tests, or TypeScript build state`);
    }
    for (const required of requiredFiles.get(result.name) ?? []) {
      if (!paths.has(required)) throw new Error(`${result.name} is missing ${required}`);
    }
    packed.push(result);
  }

  const dependencies = Object.fromEntries(packed.map((entry) => [entry.name, `file:${entry.filename}`]));
  Object.assign(dependencies, {
    lit: "3.3.3",
    typescript: "6.0.3",
    vite: "npm:@voidzero-dev/vite-plus-core@0.1.24",
    "vite-plus": "0.1.24"
  });
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "wavex-package-smoke",
        private: true,
        type: "module",
        dependencies,
        pnpm: { overrides: Object.fromEntries(packed.map((entry) => [entry.name, `file:${entry.filename}`])) }
      },
      null,
      2
    )}\n`
  );

  run("pnpm", ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumerDirectory);
  run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        'await import("@wavex/core")',
        'await import("@wavex/core/capabilities")',
        'await import("@wavex/compiler")',
        'await import("@wavex/runtime")',
        'await import("@wavex/runtime/lit")',
        'await import("@wavex/vite-plugin")',
        'await import("@wavex/lsp")',
        'await import("wavex")'
      ].join(";")
    ],
    consumerDirectory
  );
  const help = run("pnpm", ["exec", "wavex", "--help"], consumerDirectory);
  if (!help.includes("wavex check")) throw new Error("the packed wavex CLI did not run");

  console.log(`package:check passed — ${packed.length} tarballs install and load together.`);
  if (retainedOutput) console.log(`Artifacts: ${packDirectory}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
