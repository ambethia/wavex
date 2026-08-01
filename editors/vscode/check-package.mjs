import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const scratch = await mkdtemp(join(tmpdir(), "wavex-vsix-check-"));
const vsix = join(scratch, "wavex-vscode.vsix");

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"]
  });
}

try {
  run("pnpm", ["build"]);
  run("pnpm", ["exec", "vsce", "package", "--pre-release", "--no-dependencies", "--out", vsix]);
  const entries = run("unzip", ["-Z1", vsix]).trim().split("\n");
  const required = [
    "extension/package.json",
    "extension/LICENSE.txt",
    "extension/readme.md",
    "extension/changelog.md",
    "extension/language-configuration.json",
    "extension/syntaxes/wavex.tmLanguage.json",
    "extension/dist/extension.cjs",
    "extension/dist/server.cjs"
  ];
  for (const path of required) {
    if (!entries.includes(path)) throw new Error(`VSIX is missing ${path}`);
  }

  const forbidden = entries.filter(
    (path) =>
      path.endsWith(".map") ||
      path.endsWith(".tsbuildinfo") ||
      path.includes("/.gitignore") ||
      path.includes("/src/") ||
      path.endsWith("/build.mjs") ||
      path.endsWith("/tsconfig.json")
  );
  if (forbidden.length > 0) throw new Error(`VSIX contains development files: ${forbidden.join(", ")}`);

  const manifestText = run("unzip", ["-p", vsix, "extension.vsixmanifest"]);
  if (!manifestText.includes('Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true"')) {
    throw new Error("VSIX is not marked as a prerelease");
  }

  for (const bundle of ["extension/dist/extension.cjs", "extension/dist/server.cjs"]) {
    const output = join(scratch, bundle.split("/").at(-1));
    const content = run("unzip", ["-p", vsix, bundle]);
    await writeFile(output, content);
    run(process.execPath, ["--check", output]);
  }

  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  console.log(`package:check passed — ${manifest.displayName} ${manifest.version} prerelease VSIX is clean.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
