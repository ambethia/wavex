#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url).pathname;
const tempDir = mkdtempSync(join(tmpdir(), "wavex-api-docs-"));
const jsonPath = join(tempDir, "typedoc.json");

try {
  const typedoc = spawnSync(
    process.execPath,
    [join(repoRoot, "node_modules", "typedoc", "bin", "typedoc"), "--json", jsonPath],
    { cwd: repoRoot, encoding: "utf8" }
  );

  if (typedoc.status !== 0) {
    process.stderr.write(typedoc.stdout ?? "");
    process.stderr.write(typedoc.stderr ?? "");
    throw new Error(`typedoc exited with status ${typedoc.status}`);
  }

  const project = JSON.parse(readFileSync(jsonPath, "utf8"));
  const missing = exportedApiReflections(project).filter((reflection) => !hasDocumentation(reflection.node));

  if (missing.length > 0) {
    console.error("Exported API declarations without TSDoc:");
    for (const reflection of missing) console.error(`- ${reflection.path}`);
    console.error("Add a /** ... */ summary so the generated using-wavex skill documents this API.");
    process.exit(1);
  }

  console.log("api-docs:check passed — exported API declarations have TSDoc summaries.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function* walk(node, path = []) {
  yield { node, path };
  for (const child of node.children ?? []) yield* walk(child, [...path, node.name]);
}

function exportedApiReflections(project) {
  const declarationKinds = new Set([
    32, // Variable
    64, // Function
    128, // Class
    256, // Interface
    2097152 // TypeAlias
  ]);

  return [...walk(project)]
    .filter(({ node, path }) => declarationKinds.has(node.kind) && isPublicModuleChild(node, path))
    .map(({ node, path }) => ({ node, path: [...path, node.name].slice(1).join(".") }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function isPublicModuleChild(node, path) {
  if (node.flags?.isPrivate || node.flags?.isProtected || node.flags?.isExternal) return false;
  const parentName = path.at(-1);
  const packageName = path.find((part) => part.startsWith("@wavex/") || part === "wavex");
  if (!packageName) return false;
  return parentName === packageName || parentName === "capabilities" || parentName === "lit" || parentName === "server";
}

function hasDocumentation(node) {
  return hasComment(node.comment) || (node.signatures ?? []).some((signature) => hasComment(signature.comment));
}

function hasComment(comment) {
  return Boolean(
    comment &&
      ((comment.summary ?? []).some((part) => part.text?.trim()) ||
        (comment.blockTags ?? []).some((tag) => (tag.content ?? []).some((part) => part.text?.trim())))
  );
}
