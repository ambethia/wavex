import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function readProjectFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("documentation drift guards", () => {
  it("documents .wx HMR as standard Vite js-update events", () => {
    const vitePluginReadme = readProjectFile("packages/vite-plugin/README.md");
    const vitePluginSource = readProjectFile("packages/vite-plugin/src/index.ts");

    expect(vitePluginReadme).toContain("Standard Vite `js-update` HMR");
    expect(vitePluginSource).toContain("standard Vite `js-update`\n * HMR updates");
    expect(`${vitePluginReadme}\n${vitePluginSource}`).not.toMatch(/wavex:update|targeted Vite HMR/i);
  });

  it("documents syntax highlighting as TextMate grammar, not LSP semantic tokens", () => {
    const grammarPath = "editors/vscode/syntaxes/wavex.tmLanguage.json";
    const vscodePackage = JSON.parse(readProjectFile("editors/vscode/package.json")) as {
      contributes?: { grammars?: Array<{ language?: string; path?: string }> };
    };
    const lspReadme = readProjectFile("packages/lsp/README.md");
    const lspSource = readProjectFile("packages/lsp/src/index.ts");
    const coreReadme = readProjectFile("packages/core/README.md");
    const vscodeReadme = readProjectFile("editors/vscode/README.md");
    const docs = [lspReadme, lspSource, coreReadme, vscodeReadme].join("\n");

    expect(existsSync(join(repoRoot, grammarPath))).toBe(true);
    expect(vscodePackage.contributes?.grammars).toContainEqual(expect.objectContaining({ language: "wavex", path: "./syntaxes/wavex.tmLanguage.json" }));
    expect(docs).toContain("TextMate grammar");
    expect(docs).not.toMatch(/semantic tokens/i);
  });

  it("does not claim JSON CLI output or overstate static prerendering", () => {
    const wavexReadme = readProjectFile("packages/wavex/README.md");
    const vitePluginReadme = readProjectFile("packages/vite-plugin/README.md");

    expect(wavexReadme).toContain("deterministic text output");
    expect(wavexReadme).toContain("static HTML output optimization");
    expect(vitePluginReadme).toContain("static HTML optimization for resource-free");
    expect(`${wavexReadme}\n${vitePluginReadme}`).not.toMatch(
      /JSON-friendly|JSON output|Tier-1 SEO|Tier-1 prerender/i
    );
  });

  it("documents Convex Doc and Id as explicit imports while only api is injected", () => {
    const overview = readProjectFile("packages/core/docs/language-overview.md");

    expect(overview).toContain('import type { Doc } from "../../convex/_generated/dataModel"');
    expect(overview).toContain("Convex `Doc` and `Id` types are ordinary TypeScript imports");
    expect(overview).toContain("The Convex `api` object is injected");
    expect(overview).not.toMatch(/ambient types such as `Doc/);
  });
});
