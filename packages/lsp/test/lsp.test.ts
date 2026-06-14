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
const typedConvexFixture = resolve(fixturesDir, "typed-convex/src/pages/resources.wx");
const missingConvexResourceFixture = resolve(fixturesDir, "typed-convex/src/pages/missing-resource.wx");
const invalidConvexResourceFixture = resolve(fixturesDir, "typed-convex/src/pages/invalid-resource.wx");
const hyphenConvexResourceFixture = resolve(fixturesDir, "typed-convex/src/pages/hyphen-resource.wx");
const typedConvexServerShim = resolve(fixturesDir, "typed-convex/convex-server.d.ts");

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

  it("types Convex resource bindings from generated api.d.ts and maps diagnostics to .wx expressions", async () => {
    const checker = createChecker([typedConvexFixture, typedConvexServerShim]);
    const diagnostics = await checker.check(typedConvexFixture);

    const resourceTypeError = diagnostics.find((diagnostic) => String(diagnostic.message).includes("toUpperCase"));
    expect(resourceTypeError).toBeDefined();
    expect(resourceTypeError!.source).not.toBe("wavex");
    expect(resourceTypeError!.range.start.line).toBe(3);
    expect(diagnostics.filter((diagnostic) => diagnostic !== resourceTypeError)).toEqual([]);
  });

  it("reports typoed Convex resource references instead of dropping unmapped scaffold diagnostics", async () => {
    const checker = createChecker([missingConvexResourceFixture, typedConvexServerShim]);
    const diagnostics = await checker.check(missingConvexResourceFixture);

    const missingResourceError = diagnostics.find((diagnostic) => String(diagnostic.message).includes("talkz"));
    expect(missingResourceError).toBeDefined();
    expect(missingResourceError!.source).not.toBe("wavex");
    expect(missingResourceError!.range.start.line).toBe(1);
    expect(missingResourceError!.range.start.character).toBe(2);
  });

  it("keeps parser diagnostics for invalid Convex resources when typed Convex imports are available", async () => {
    const checker = createChecker([invalidConvexResourceFixture, typedConvexServerShim]);
    const diagnostics = await checker.check(invalidConvexResourceFixture);

    const syntaxError = diagnostics.find((diagnostic) => diagnostic.code === "WX020");
    expect(syntaxError).toBeDefined();
    expect(syntaxError!.source).toBe("wavex");
  });

  it("reports typoed Convex resource references with string-literal API path segments", async () => {
    const checker = createChecker([hyphenConvexResourceFixture, typedConvexServerShim]);
    const diagnostics = await checker.check(hyphenConvexResourceFixture);

    const missingResourceError = diagnostics.find((diagnostic) => String(diagnostic.message).includes("talks-bad"));
    expect(missingResourceError).toBeDefined();
    expect(missingResourceError!.source).not.toBe("wavex");
    expect(missingResourceError!.range.start.line).toBe(3);
    expect(missingResourceError!.range.start.character).toBe(2);
    expect(diagnostics.filter((diagnostic) => diagnostic.source !== "wavex")).toEqual([missingResourceError]);
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

  it("offers manifest-driven attribute, slot, and utility completions plus hover", () => {
    const details = new Map([
      [
        "button",
        {
          name: "button",
          summary: "Buttons represent actions.",
          attributes: [
            { name: "variant", description: "The button's theme variant.", type: "'brand' | 'neutral'", default: "'neutral'" },
            { name: "size", type: "'s' | 'm' | 'l'" }
          ],
          slots: [{ name: "start", description: "Content before the label." }]
        }
      ]
    ]);
    const plugin = createWavexServicePlugin({
      webAwesomeComponents: ["button"],
      webAwesomeDetails: details,
      utilityClasses: ["stack", "gap-xl", "align-items-center"]
    });
    const instance = plugin.create({} as never);

    const documentFor = (text: string) => ({
      languageId: "wavex",
      getText: () => text,
      offsetAt: () => text.length,
      uri: "file:///x.wx",
      version: 1
    });

    // Attribute + slot completions on a component line
    const attrList = instance.provideCompletionItems?.(
      documentFor("  @button ") as never,
      { line: 0, character: 10 },
      {} as never,
      {} as never
    ) as { items: Array<{ label: string; detail?: string }> };
    expect(attrList.items.map((item) => item.label)).toEqual(expect.arrayContaining(["variant", "size", "slot:start"]));

    // Utility completions inside an unclosed bracket group
    const utilityList = instance.provideCompletionItems?.(
      documentFor("main [stack ga") as never,
      { line: 0, character: 14 },
      {} as never,
      {} as never
    ) as { items: Array<{ label: string }> };
    expect(utilityList.items.map((item) => item.label)).toContain("gap-xl");

    // Hover on the component reference and on an attribute
    const hoverDoc = documentFor("  @button variant:brand Go");
    const componentHover = instance.provideHover?.(
      { ...hoverDoc, offsetAt: () => 4 } as never,
      { line: 0, character: 4 },
      {} as never
    ) as { contents: { value: string } };
    expect(componentHover.contents.value).toContain("<wa-button>");
    expect(componentHover.contents.value).toContain("Buttons represent actions.");

    const attributeHover = instance.provideHover?.(
      { ...hoverDoc, offsetAt: () => 12 } as never,
      { line: 0, character: 12 },
      {} as never
    ) as { contents: { value: string } };
    expect(attributeHover.contents.value).toContain("variant");
    expect(attributeHover.contents.value).toContain("theme variant");
  });
});

describe("virtual code mappings", () => {
  it("anchors same-name attribute expressions to the attribute, not the component name", async () => {
    const { WavexVirtualCode } = await import("../src/index.js");
    const text = "~~~\n+for talk in talks\n  @talk-card talk:\n";
    const snapshot = {
      getText: (start: number, end: number) => text.slice(start, end),
      getLength: () => text.length,
      getChangeRange: () => undefined
    };
    const code = new WavexVirtualCode(snapshot as never);
    const tsCode = code.embeddedCodes[0]!;
    const generated = tsCode.snapshot.getText(0, tsCode.snapshot.getLength());

    // The `talk` reference from `talk:` must map to the attribute position,
    // not the `talk` inside `@talk-card`.
    const attributeOffset = text.indexOf(" talk:") + 1;
    const componentNameOffset = text.indexOf("@talk-card") + 1;
    const talkMappings = tsCode.mappings.filter(
      (mapping) => generated.slice(mapping.generatedOffsets[0]!, mapping.generatedOffsets[0]! + mapping.lengths[0]!) === "talk"
    );
    expect(talkMappings.some((mapping) => mapping.sourceOffsets[0] === attributeOffset)).toBe(true);
    expect(talkMappings.some((mapping) => mapping.sourceOffsets[0] === componentNameOffset)).toBe(false);
  });

  it("anchors repeated attribute and inline expressions to parser sub-ranges", async () => {
    const { WavexVirtualCode } = await import("../src/index.js");
    const text = "~~~\n+if talk\n  @talk-card title:talk.title data-talk:{{ talk }} talk:\n  p talk   {{ talk }}\n  | repeated talk {{ talk }}\n  $talks:get input:{{ talk }}\n";
    const snapshot = {
      getText: (start: number, end: number) => text.slice(start, end),
      getLength: () => text.length,
      getChangeRange: () => undefined
    };
    const code = new WavexVirtualCode(snapshot as never);
    const tsCode = code.embeddedCodes[0]!;
    const generated = tsCode.snapshot.getText(0, tsCode.snapshot.getLength());
    const talkMappings = tsCode.mappings.filter(
      (mapping) => generated.slice(mapping.generatedOffsets[0]!, mapping.generatedOffsets[0]! + mapping.lengths[0]!) === "talk"
    );
    const offsets = talkMappings.map((mapping) => mapping.sourceOffsets[0]);

    expect(offsets).toEqual(expect.arrayContaining([
      text.indexOf("+if talk") + "+if ".length,
      text.indexOf("data-talk:{{ talk }}") + "data-talk:{{ ".length,
      text.indexOf(" talk:") + 1,
      text.indexOf("p talk   {{ talk }}") + "p talk   {{ ".length,
      text.indexOf("| repeated talk {{ talk }}") + "| repeated talk {{ ".length,
      text.indexOf("input:{{ talk }}") + "input:{{ ".length
    ]));
    const titleMapping = tsCode.mappings.find(
      (mapping) => generated.slice(mapping.generatedOffsets[0]!, mapping.generatedOffsets[0]! + mapping.lengths[0]!) === "talk.title"
    );
    expect(titleMapping?.sourceOffsets[0]).toBe(text.indexOf("title:talk.title") + "title:".length);
    expect(offsets).not.toContain(text.indexOf("@talk-card") + 1);
    expect(offsets).not.toContain(text.indexOf("data-talk"));
    expect(offsets).not.toContain(text.indexOf("data-talk") + "data-".length);
    expect(offsets).not.toContain(text.indexOf("p talk") + 2);
    expect(offsets).not.toContain(text.indexOf("repeated talk") + "repeated ".length);
  });

  it("keeps duplicate expression attributes and whitespace-sensitive directive ranges mapped", async () => {
    const { WavexVirtualCode } = await import("../src/index.js");
    const text = "~~~\n+if a  &&  b\n  @talk-card title:{{ talk.title }} label:{{ talk.title }}\n";
    const snapshot = {
      getText: (start: number, end: number) => text.slice(start, end),
      getLength: () => text.length,
      getChangeRange: () => undefined
    };
    const code = new WavexVirtualCode(snapshot as never);
    const tsCode = code.embeddedCodes[0]!;
    const generated = tsCode.snapshot.getText(0, tsCode.snapshot.getLength());
    const mappedText = (mapping: { generatedOffsets: number[]; lengths: number[] }) =>
      generated.slice(mapping.generatedOffsets[0]!, mapping.generatedOffsets[0]! + mapping.lengths[0]!);

    const titleMappings = tsCode.mappings.filter((mapping) => mappedText(mapping) === "talk.title");
    expect(titleMappings.map((mapping) => mapping.sourceOffsets[0])).toEqual([
      text.indexOf("title:{{ talk.title }}") + "title:{{ ".length,
      text.indexOf("label:{{ talk.title }}") + "label:{{ ".length
    ]);

    const ifMapping = tsCode.mappings.find((mapping) => mappedText(mapping) === "a  &&  b");
    expect(ifMapping?.sourceOffsets[0]).toBe(text.indexOf("a  &&  b"));
  });

  it("preserves CRLF prelude bytes in the mapped TypeScript virtual code", async () => {
    const { WavexVirtualCode } = await import("../src/index.js");
    const text = 'type Talk = { title: string }\r\nconst talk = {} as Talk;\r\n~~~\r\nmain\r\n  p {{ talk.title }}\r\n';
    const snapshot = {
      getText: (start: number, end: number) => text.slice(start, end),
      getLength: () => text.length,
      getChangeRange: () => undefined
    };
    const code = new WavexVirtualCode(snapshot as never);
    const tsCode = code.embeddedCodes[0]!;
    const generated = tsCode.snapshot.getText(0, tsCode.snapshot.getLength());
    const sourcePrelude = text.slice(0, text.indexOf("~~~"));
    const preludeMapping = tsCode.mappings.find((mapping) => mapping.sourceOffsets[0] === 0);

    expect(generated.startsWith(sourcePrelude)).toBe(true);
    expect(preludeMapping?.lengths[0]).toBe(sourcePrelude.length);

    const expressionOffset = text.indexOf("talk.title");
    const expressionMapping = tsCode.mappings.find(
      (mapping) => generated.slice(mapping.generatedOffsets[0]!, mapping.generatedOffsets[0]! + mapping.lengths[0]!) === "talk.title"
    );
    expect(expressionMapping?.sourceOffsets[0]).toBe(expressionOffset);
  });
});

describe("template scopes in virtual code", () => {
  it("declares +for items and +error bindings; raw-event handlers count as used", async () => {
    const fixture = resolve(fixturesDir, "scopes.wx");
    const checker = createChecker([fixture]);
    const diagnostics = await checker.check(fixture);

    // No TS6133 (unused faqOpened), no TS2304 (problem/talk undefined).
    const codes = diagnostics.map((diagnostic) => String(diagnostic.code));
    expect(codes).not.toContain("6133");
    expect(codes).not.toContain("2304");
    expect(diagnostics.filter((diagnostic) => diagnostic.source !== "wavex")).toEqual([]);
  });

  it("types +for items from the collection (the proven case, scoped)", async () => {
    const fixture = resolve(fixturesDir, "scopes-bad.wx");
    const checker = createChecker([fixture]);
    const diagnostics = await checker.check(fixture);
    const tsError = diagnostics.find((diagnostic) => String(diagnostic.message).includes("toUpperCase"));
    expect(tsError).toBeDefined();
  });
});
