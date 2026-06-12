import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTypeScriptInferredChecker } from "@volar/kit";
import ts from "typescript";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { createWavexLanguagePlugin, createWavexServicePlugin } from "../src/index.js";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const talkFixture = resolve(fixturesDir, "talk.wx");
const badUtilityFixture = resolve(fixturesDir, "bad-utility.wx");

function createChecker(files: string[]) {
  return createTypeScriptInferredChecker(
    [createWavexLanguagePlugin()],
    [...createTypeScriptServices(ts), createWavexServicePlugin()],
    () => files,
    {
      strict: true,
      skipLibCheck: true,
      noEmit: true
    }
  );
}

describe("@wavex/lsp", () => {
  it("type-checks template expressions against prelude types with source-mapped ranges", async () => {
    const checker = createChecker([talkFixture]);
    const diagnostics = await checker.check(talkFixture);

    // The proven case: format({ title: "Broken" }) is missing `minutes`.
    const tsError = diagnostics.find((diagnostic) => String(diagnostic.message).includes("minutes"));
    expect(tsError).toBeDefined();
    // Mapped back to the .wx source: the broken expression is on line 11 (0-based 10).
    expect(tsError!.range.start.line).toBe(10);

    // The healthy expression and the prelude produce no errors of their own.
    const otherTsErrors = diagnostics.filter(
      (diagnostic) => diagnostic !== tsError && diagnostic.source !== "wavex"
    );
    expect(otherTsErrors).toEqual([]);
  });

  it("surfaces parser diagnostics (WX005) through the wavex service plugin", async () => {
    const checker = createChecker([badUtilityFixture]);
    const diagnostics = await checker.check(badUtilityFixture);

    const wx005 = diagnostics.find((diagnostic) => diagnostic.code === "WX005");
    expect(wx005).toBeDefined();
    expect(wx005!.source).toBe("wavex");
    expect(String(wx005!.message)).toContain("gap:xl");
    expect(wx005!.range.start.line).toBe(2);
  });

  it("offers component, directive, and Convex completions", async () => {
    const plugin = createWavexServicePlugin({
      localComponents: ["talk-card", "site-nav"],
      webAwesomeComponents: ["button", "card"],
      convexFunctions: ["talks:list", "talks:get"]
    });
    const instance = plugin.create({} as never);

    const completionsAt = (text: string) => {
      const document = {
        languageId: "wavex",
        getText: () => text,
        offsetAt: () => text.length,
        positionAt: () => ({ line: 0, character: text.length }),
        uri: "file:///x.wx",
        version: 1,
        lineCount: text.split("\n").length
      };
      return instance.provideCompletionItems?.(
        document as never,
        { line: 0, character: text.length },
        {} as never,
        {} as never
      );
    };

    const componentItems = (completionsAt("  @") as { items: Array<{ label: string }> }).items.map((item) => item.label);
    expect(componentItems).toContain("@talk-card");
    expect(componentItems).toContain("@button");

    const directiveItems = (completionsAt("  +") as { items: Array<{ label: string }> }).items.map((item) => item.label);
    expect(directiveItems).toContain("+loading");
    expect(directiveItems).toContain("+boundary");

    const convexItems = (completionsAt("$$") as { items: Array<{ label: string }> }).items.map((item) => item.label);
    expect(convexItems).toContain("$$talks:list");
  });

  it("emits semantic tokens for template structure", () => {
    const plugin = createWavexServicePlugin();
    const instance = plugin.create({} as never);
    const text = '~~~\n\nmain [stack gap-xl]\n  @button variant:brand Go\n  +if route.query.x\n    p Text\n\n$$talks:list\n';
    const document = {
      languageId: "wavex",
      getText: () => text,
      uri: "file:///x.wx",
      version: 1
    };
    const legend = { tokenTypes: ["type", "class", "function", "keyword", "property", "variable"], tokenModifiers: [] };
    const tokens = instance.provideDocumentSemanticTokens?.(
      document as never,
      { start: { line: 0, character: 0 }, end: { line: 8, character: 0 } },
      legend as never,
      {} as never
    ) as Array<[number, number, number, number, number]>;

    // element (main), component (@button), directive (+if), element (p), convex call ($$talks:list)
    expect(tokens.length).toBeGreaterThanOrEqual(5);
    const byType = (type: string) => tokens.filter((token) => token[3] === legend.tokenTypes.indexOf(type));
    expect(byType("class").length).toBe(1); // @button
    expect(byType("keyword").length).toBe(1); // +if
    expect(byType("function").length).toBe(1); // $$talks:list
    expect(byType("type").length).toBe(2); // main, p
  });
});
