import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixtureRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

describe("@wavex/vite-plugin/client types", () => {
  it("declares the named exports emitted by compiled .wx modules", () => {
    const root = fixtureRoot("wavex-client-dts-");
    const runtimeTypes = join(root, "node_modules/@wavex/runtime/index.d.ts");
    mkdirSync(join(root, "node_modules/@wavex/runtime"), { recursive: true });
    writeFileSync(join(root, "node_modules/@wavex/runtime/package.json"), JSON.stringify({ name: "@wavex/runtime", types: "index.d.ts" }));
    writeFileSync(
      runtimeTypes,
      [
        "export interface HeadEntry { tag: 'title' | 'meta' | 'link' }",
        "export interface RenderContext { attrs?: Record<string, unknown> }",
        "export type RenderFunction<Result = unknown> = (context?: RenderContext) => Result;",
        "export interface ResourceDefinition { name: string; modulePath: string; functionName: string }"
      ].join("\n")
    );

    const sourceFile = join(root, "uses-wx.ts");
    writeFileSync(
      sourceFile,
      [
        'import defaultRender, { headEntries, render, resources, wxFile } from "./page.wx";',
        'import type { RenderFunction, ResourceDefinition } from "@wavex/runtime";',
        "const defaultRenderCheck: RenderFunction = defaultRender;",
        "const namedRenderCheck: RenderFunction = render;",
        "const resourceCheck: readonly ResourceDefinition[] = resources;",
        "const idCheck: string = wxFile.id;",
        "const componentCheck: readonly string[] = wxFile.localComponents;",
        "headEntries({ attrs: {} });",
        "void defaultRenderCheck; void namedRenderCheck; void resourceCheck; void idCheck; void componentCheck;"
      ].join("\n")
    );

    const program = ts.createProgram({
      rootNames: [join(import.meta.dirname, "../client.d.ts"), sourceFile],
      options: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
        paths: { "@wavex/runtime": [runtimeTypes] },
        types: [],
        ignoreDeprecations: "6.0"
      }
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
    ).toEqual([]);
  });
});
