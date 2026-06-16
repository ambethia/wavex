import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createRouteDefinition,
  extractAttrsTypeKeys,
  matchRoutePath,
  parseAttributeToken,
  parseQueryString,
  parseWavex,
  singularize
} from "../src/index.js";

describe("singularize", () => {
  it("preserves singular words ending in s and handles common es plurals", () => {
    expect(singularize("address")).toBe("address");
    expect(singularize("houses")).toBe("house");
    expect(singularize("addresses")).toBe("address");
    expect(singularize("boxes")).toBe("box");
    expect(singularize("ADDRESS")).toBe("ADDRESS");
    expect(singularize("COMPANIES")).toBe("COMPANY");
  });
});

describe("extractAttrsTypeKeys", () => {
  it("extracts top-level type Attrs keys without nested type noise", () => {
    expect(
      extractAttrsTypeKeys(`
        type Attrs = {
          readonly talk: { title: string; speaker: { name: string } };
          featured?: boolean;
          render: (talk: { title: string }) => string;
          items: Array<{ id: string }>;
        }
      `)
    ).toEqual(["talk", "featured", "render", "items"]);
  });

  it("extracts interface Attrs keys", () => {
    expect(
      extractAttrsTypeKeys(`
        interface Attrs extends BaseAttrs {
          task: { text: string }
          selected?: boolean
        }
      `)
    ).toEqual(["task", "selected"]);
  });

  it("ignores braces in interface Attrs generic constraints", () => {
    expect(
      extractAttrsTypeKeys(`
        interface Attrs extends BaseAttrs<{ inherited: string; derive: () => { ignored: string } }> {
          task: { text: string }
          selected?: boolean
        }
      `)
    ).toEqual(["task", "selected"]);
  });

  it("ignores Attrs declarations inside comments, strings, and regex literals", () => {
    expect(
      extractAttrsTypeKeys(`
        // type Attrs = { commented: string }
        const example = "interface Attrs { quoted: string }";
        const matcher = /type Attrs = { regex: string }/g;
        const makeMatcher = () => /interface Attrs { arrow: string }/;
        if (example === ")")
          /interface Attrs { conditional: string }/.test(example);
        /*
          interface Attrs {
            blocked: boolean
          }
        */
        type Attrs = {
          actual: string;
        }
      `)
    ).toEqual(["actual"]);
  });
});

describe("parseWavex", () => {
  it("splits the TypeScript prelude and parses core MVP syntax", () => {
    const parsed = parseWavex(`type Task = Doc<"tasks">\n\n~~~\n+head\n  title Tasks | WAVEx\n  meta name:description content:"Manage your tasks"\n\n$$tasks:list\n  +loading\n    @skeleton\n  +for task in tasks key:task._id\n    @task-card task:\n\nmain [stack gap-xl]\n  h1 Tasks\n  @button variant:brand :click:reset Reset\n  p This lives in \`pages/index.wx\` and uses *strong*.\n`);

    expect(parsed.hasWaveSeparator).toBe(true);
    expect(parsed.prelude).toContain("type Task");
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.resources).toMatchObject([
      { name: "tasks", address: { modulePath: "tasks", functionName: "list" } }
    ]);

    const main = parsed.nodes.find((node) => node.kind === "element" && node.tag === "main");
    expect(main).toMatchObject({ utilities: ["stack", "gap-xl"] });
    expect(main?.children.at(1)).toMatchObject({
      kind: "component",
      reference: "button",
      inlineText: "Reset"
    });
  });

  it("normalizes nested Convex module paths", () => {
    const parsed = parseWavex(`~~~\n$$deeply:nested:function\n$$deeply/nested:otherFunction\n`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.resources).toMatchObject([
      { name: "nested", address: { modulePath: "deeply/nested", functionName: "function" } },
      { name: "nested", address: { modulePath: "deeply/nested", functionName: "otherFunction" } }
    ]);
  });

  it("diagnoses a missing wave separator with WX001", () => {
    const parsed = parseWavex("main\n  p Missing separator\n");

    expect(parsed.hasWaveSeparator).toBe(false);
    expect(parsed.diagnostics).toMatchObject([
      { code: "WX001", severity: "error", line: 1, column: 1 }
    ]);
    expect(parsed.diagnostics[0]!.message).toContain("~~~");
  });

  it("diagnoses indentation violations with WX002-WX004", () => {
    const parsed = parseWavex("~~~\n\t@button Tabbed\n p Odd indent\nmain\n    p Skipped level\n");

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX002", severity: "error", line: 2, column: 1 },
      { code: "WX003", severity: "error", line: 3, column: 2 },
      { code: "WX004", severity: "error", line: 5, column: 5 }
    ]);
    expect(parsed.diagnostics).toHaveLength(3);
    expect(parsed.diagnostics[0]!.message).toContain("Tabs are not allowed");
    expect(parsed.diagnostics[1]!.message).toContain("multiples of exactly two spaces");
    expect(parsed.diagnostics[2]!.message).toContain("cannot skip a nesting level");
  });

  it("diagnoses invalid Convex addresses with WX020 without sentinel AST resources", () => {
    const parsed = parseWavex(`~~~\n$$foo//bar:list\n  +loading\n    p Loading should stay under the invalid resource\n$$foo/:list\n$tasks\n$$tasks:list?\n$$tasks:list\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX020", severity: "error", line: 2, column: 1 },
      { code: "WX020", severity: "error", line: 5, column: 1 },
      { code: "WX020", severity: "error", line: 6, column: 1 },
      { code: "WX020", severity: "error", line: 7, column: 1 }
    ]);
    expect(parsed.diagnostics).toHaveLength(4);
    expect(parsed.nodes).toMatchObject([
      { kind: "convex-call", address: { modulePath: "tasks", functionName: "list", raw: "$$tasks:list" } }
    ]);
    expect(parsed.resources).toMatchObject([
      { name: "tasks", address: { modulePath: "tasks", functionName: "list", raw: "$$tasks:list" } }
    ]);
    expect(JSON.stringify({ nodes: parsed.nodes, resources: parsed.resources })).not.toContain("missing");
    for (const diagnostic of parsed.diagnostics) expect(diagnostic.message).toContain("Expected $module:function or $$module:function");
  });

  it("does not promote oddly indented descendants of invalid Convex addresses", () => {
    const parsed = parseWavex("~~~\n$$tasks\n p Odd indentation should stay under the invalid resource\nmain\n");

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX020", severity: "error", line: 2, column: 1 },
      { code: "WX003", severity: "error", line: 3, column: 2 }
    ]);
    expect(parsed.diagnostics).toHaveLength(2);
    expect(parsed.nodes).toMatchObject([{ kind: "element", tag: "main" }]);
    expect(parsed.nodes).toHaveLength(1);
  });

  it("parses attribute value forms", () => {
    expect(parseAttributeToken("required")).toMatchObject({ kind: "boolean", name: "required" });
    expect(parseAttributeToken("task:")).toMatchObject({ kind: "same-name", name: "task" });
    expect(parseAttributeToken("label:\"Full name\"")).toMatchObject({ kind: "literal", value: "Full name" });
    expect(parseAttributeToken("variant:brand")).toMatchObject({ kind: "literal", value: "brand" });
    expect(parseAttributeToken("talkSlug:route.params.slug")).toMatchObject({
      kind: "expression",
      name: "talkSlug",
      expression: "route.params.slug"
    });
    expect(parseAttributeToken("href:https://example.com/tasks?filter=open#list")).toMatchObject({
      kind: "literal",
      value: "https://example.com/tasks?filter=open#list"
    });
    expect(parseAttributeToken("href:tel:+1234567890")).toMatchObject({ kind: "literal", value: "tel:+1234567890" });
    expect(parseAttributeToken("src:data:image/svg+xml;base64,PHN2Zy8+")).toMatchObject({
      kind: "literal",
      value: "data:image/svg+xml;base64,PHN2Zy8+"
    });
    expect(parseAttributeToken("value:task")).toMatchObject({ kind: "literal", value: "task" });
    expect(parseAttributeToken("task:task")).toMatchObject({ kind: "literal", value: "task" });
    expect(parseAttributeToken("checked:isDone")).toMatchObject({ kind: "expression", expression: "isDone" });
    expect(parseAttributeToken("count:42")).toMatchObject({ kind: "expression", expression: "42" });
    expect(parseAttributeToken("value:3.14")).toMatchObject({ kind: "expression", expression: "3.14" });
    expect(parseAttributeToken("mode:api-client")).toMatchObject({ kind: "literal", value: "api-client" });
    expect(parseAttributeToken("status:state-open")).toMatchObject({ kind: "literal", value: "state-open" });
    expect(parseAttributeToken("label:api?")).toMatchObject({ kind: "literal", value: "api?" });
    expect(parseAttributeToken("item:api?.client")).toMatchObject({ kind: "expression", expression: "api?.client" });
    expect(parseAttributeToken("checked:{{ task.isCompleted }}")).toMatchObject({
      kind: "expression",
      expression: "task.isCompleted"
    });
    expect(parseAttributeToken("disabled:count>0")).toMatchObject({ kind: "expression", expression: "count>0" });
    expect(parseAttributeToken("hidden:!isVisible")).toMatchObject({ kind: "expression", expression: "!isVisible" });
    expect(parseAttributeToken("value:maybe??fallback")).toMatchObject({ kind: "expression", expression: "maybe??fallback" });
    expect(parseAttributeToken("value:condition?yes:no")).toMatchObject({ kind: "expression", expression: "condition?yes:no" });
    expect(parseAttributeToken("label:Really?")).toMatchObject({ kind: "literal", value: "Really?" });
    expect(parseAttributeToken("label:Save!")).toMatchObject({ kind: "literal", value: "Save!" });
    expect(parseAttributeToken(":click:$$tasks:create")).toMatchObject({
      kind: "semantic-event",
      event: "click",
      target: "$$tasks:create"
    });
    expect(parseAttributeToken("on:wa-show:opened")).toMatchObject({
      kind: "raw-event",
      event: "wa-show",
      handler: "opened"
    });
    expect(parseAttributeToken(":click:")).toBeUndefined();
    expect(parseAttributeToken("on:wa-show:")).toBeUndefined();
    // URL paths are literals, not expressions (a href:/tasks Tasks)
    expect(parseAttributeToken("href:/tasks")).toMatchObject({ kind: "literal", value: "/tasks" });
    expect(parseAttributeToken("href:/schedule?track=systems")).toMatchObject({
      kind: "literal",
      value: "/schedule?track=systems"
    });
    expect(parseAttributeToken("href:route.url")).toMatchObject({ kind: "expression", expression: "route.url" });
  });

  it("accepts TypeScript expression calls and arrow callbacks in template expression positions", () => {
    const parsed = parseWavex(
      `~~~\n+if tasks && tasks.some((todo) => todo.completed)\n  p {{ (tasks ?? []).filter((todo) => !todo.completed).length }} left\n  = tasks.map((todo) => todo.text).join(", ")\n`
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      kind: "directive",
      name: "if",
      expression: "tasks && tasks.some((todo) => todo.completed)"
    });
  });

  it("does not mistake TypeScript brackets in directive expressions for utility groups", () => {
    const parsed = parseWavex(
      '~~~\n+if actionStates["$$ai/summarize:run"]?.result\n  p Yes\n+if [1, 2].includes(selected)\n  p Also yes\n+for item in [1, 2] key:item\n  p {{ item }}\n'
    );
    expect(parsed.diagnostics).toEqual([]);
    const directive = parsed.nodes[0];
    expect(directive).toMatchObject({
      kind: "directive",
      name: "if",
      expression: 'actionStates["$$ai/summarize:run"]?.result'
    });
    expect(parsed.nodes[1]).toMatchObject({
      kind: "directive",
      name: "if",
      expression: "[1, 2].includes(selected)"
    });
    expect(parsed.nodes[2]).toMatchObject({
      kind: "directive",
      name: "for",
      for: { itemName: "item", collectionExpression: "[1, 2]", keyExpression: "item" }
    });
  });

  it("preserves prose bracket notes after inline text", () => {
    const parsed = parseWavex("~~~\np Read the [draft] note\np Read the [stack] note\n");

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      kind: "element",
      tag: "p",
      utilities: [],
      inlineText: "Read the [draft] note"
    });
    expect(parsed.nodes[1]).toMatchObject({
      kind: "element",
      tag: "p",
      utilities: [],
      inlineText: "Read the [stack] note"
    });
  });

  it("diagnoses likely utility groups in directive expressions", () => {
    const parsed = parseWavex("~~~\n+if [stack gap-xl]\n  p Yes\n+if [gap:xl]\n  p No\n+if [stack gap-xl\n  p Maybe\n");

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX006", severity: "error", line: 2, column: 5 },
      { code: "WX006", severity: "error", line: 4, column: 5 },
      { code: "WX005", severity: "error", line: 6, column: 5 }
    ]);
  });

  it("does not silently drop utility groups from suspense directive text", () => {
    const parsed = parseWavex("~~~\n+suspense [stack gap-xl] Loading\n");

    expect(parsed.nodes[0]).toMatchObject({ kind: "directive", name: "suspense", expression: "[stack gap-xl] Loading" });
    expect(parsed.diagnostics).toMatchObject([
      { code: "WX006", severity: "error", line: 2, column: 11 }
    ]);
  });

  it("treats mustache tokens with inner colons as inline text, not attributes", () => {
    const parsed = parseWavex('~~~\n+head\n  title {{ talk ? `${talk.title} | Swell` : "Talk | Swell" }}\n');
    const head = parsed.nodes.find((node) => node.kind === "directive");
    expect(head?.children[0]).toMatchObject({
      kind: "element",
      tag: "title",
      inlineText: '{{ talk ? `${talk.title} | Swell` : "Talk | Swell" }}'
    });
  });

  it("parses native boolean attributes without treating hyphenated prose as attributes", () => {
    const parsed = parseWavex(`~~~\nvideo autoplay muted loop\np easy-going folks\n`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      kind: "element",
      tag: "video",
      attributes: [
        { kind: "boolean", name: "autoplay" },
        { kind: "boolean", name: "muted" },
        { kind: "boolean", name: "loop" }
      ]
    });
    expect(parsed.nodes[1]).toMatchObject({
      kind: "element",
      tag: "p",
      attributes: [],
      inlineText: "easy-going folks"
    });
  });

  it("parses colon-bearing prose as inline text instead of a same-name attribute", () => {
    const parsed = parseWavex(`~~~\np Total: {{ n }}\n`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      kind: "element",
      tag: "p",
      attributes: [],
      inlineText: "Total: {{ n }}"
    });
  });

  it("diagnoses head-only attributes and utilities after inline text", () => {
    const parsed = parseWavex(`~~~\np Hello [stack gap-xl] id:greeting\n`);

    expect(parsed.nodes[0]).toMatchObject({ kind: "element", utilities: [], inlineText: "Hello [stack gap-xl] id:greeting" });
    expect(parsed.diagnostics).toMatchObject([
      { code: "WX006", severity: "error", line: 2, column: 9 },
      { code: "WX007", severity: "error", line: 2, column: 24 }
    ]);
  });

  it("rejects invalid utility groups with WX005", () => {
    const parsed = parseWavex(`~~~\nmain [stack gap:xl]\nsection [stack gap-xl\np Hello [stack gap-xl\nmain [gap:xl gap:xl]\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX005", severity: "error", line: 2, column: 13 },
      { code: "WX005", severity: "error", line: 3, column: 9 },
      { code: "WX005", severity: "error", line: 4, column: 9 },
      { code: "WX005", severity: "error", line: 5, column: 7 },
      { code: "WX005", severity: "error", line: 5, column: 14 }
    ]);
    expect(parsed.diagnostics[0]!.message).toContain("gap:xl");
    expect(parsed.diagnostics[1]!.message).toContain("missing closing");
    expect(parsed.diagnostics[2]!.message).toContain("missing closing");
  });

  it("diagnoses invalid attribute tokens in directive and Convex heads", () => {
    const parsed = parseWavex(`~~~\n+head Bad:token :click:\n$$tasks:list Bad:token on:wa-show:\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX008", severity: "error", line: 2, column: 7 },
      { code: "WX008", severity: "error", line: 2, column: 17 },
      { code: "WX008", severity: "error", line: 3, column: 14 },
      { code: "WX008", severity: "error", line: 3, column: 24 }
    ]);
  });

  it("diagnoses malformed element/component attribute tokens before inline text", () => {
    const parsed = parseWavex(`~~~\n@button bad.name:value Save\np Total: {{ n }}\n`);

    expect(parsed.nodes[0]).toMatchObject({ kind: "component", inlineText: "bad.name:value Save" });
    expect(parsed.nodes[1]).toMatchObject({ kind: "element", inlineText: "Total: {{ n }}" });
    expect(parsed.diagnostics).toMatchObject([{ code: "WX008", severity: "error", line: 2, column: 9 }]);
    expect(parsed.diagnostics).toHaveLength(1);
  });

  it("diagnoses unknown directives and malformed +for headers", () => {
    const parsed = parseWavex(`~~~\n+maybe nope\n  p Ignored directive\n+for task of tasks\n  p {{ task.text }}\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX009", severity: "error", line: 2, column: 1 },
      { code: "WX010", severity: "error", line: 4, column: 1 }
    ]);
    expect(parsed.nodes[1]).toMatchObject({ kind: "directive", name: "for", for: undefined });
  });

  it("diagnoses utility groups in attribute-only heads without also treating them as attributes", () => {
    const parsed = parseWavex(`~~~\n+head [stack gap-xl]\n$$tasks:list [stack]\n+for item in items key:item [stack]\n+head [stack gap-xl\n$$tasks:list [stack gap-xl\n+for item in items key:item [stack gap-xl\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX006", severity: "error", line: 2, column: 7 },
      { code: "WX006", severity: "error", line: 3, column: 14 },
      { code: "WX006", severity: "error", line: 4, column: 29 },
      { code: "WX005", severity: "error", line: 5, column: 7 },
      { code: "WX005", severity: "error", line: 6, column: 14 },
      { code: "WX005", severity: "error", line: 7, column: 29 }
    ]);
    expect(parsed.diagnostics).toHaveLength(6);
  });

  it("accepts dash-form utility tokens without diagnostics", () => {
    const parsed = parseWavex(`~~~\nmain [stack gap-xl align-items-center]\n`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({ utilities: ["stack", "gap-xl", "align-items-center"] });
  });

  it("records sub-line ranges for attributes, inline text, directive expressions, and expression lines", () => {
    const source = `~~~\n+if status === "ready"\n  @talk-card talk: title:talk.title :click:openTalk Open {{ talk.title }}\n  = formatTitle(talk.title)\n`;
    const parsed = parseWavex(source);
    const directive = parsed.nodes[0];
    const card = directive?.children[0];
    const expression = directive?.children[1];

    expect(directive).toMatchObject({ kind: "directive", expression: 'status === "ready"' });
    expect(source.slice(directive!.expressionRange!.start.offset, directive!.expressionRange!.end.offset)).toBe('status === "ready"');

    expect(card).toMatchObject({ kind: "component", inlineText: "Open {{ talk.title }}" });
    expect(source.slice(card!.inlineTextRange!.start.offset, card!.inlineTextRange!.end.offset)).toBe("Open {{ talk.title }}");
    const titleAttribute = card!.attributes.find((attribute) => attribute.name === "title")!;
    expect(source.slice(titleAttribute.range!.start.offset, titleAttribute.range!.end.offset)).toBe("title:talk.title");
    expect(source.slice(titleAttribute.expressionRange!.start.offset, titleAttribute.expressionRange!.end.offset)).toBe("talk.title");
    const sameNameAttribute = card!.attributes.find((attribute) => attribute.name === "talk")!;
    expect(source.slice(sameNameAttribute.expressionRange!.start.offset, sameNameAttribute.expressionRange!.end.offset)).toBe("talk");

    expect(expression).toMatchObject({ kind: "expression", expression: "formatTitle(talk.title)" });
    expect(source.slice(expression!.expressionRange!.start.offset, expression!.expressionRange!.end.offset)).toBe("formatTitle(talk.title)");
  });

  it("trims trailing whitespace from node ranges and keeps source columns with tabbed indentation", () => {
    const source = "const marker = true\r~~~\rmain [stack]   \r  p Hello\t \r \t@button Bad\rfooter\r\t\t@button Skipped\r";
    const parsed = parseWavex(source);
    const main = parsed.nodes[0];
    const paragraph = main?.children[0];

    expect(parsed.hasWaveSeparator).toBe(true);
    expect(parsed.prelude).toBe("const marker = true\r");
    expect(source.slice(main!.range.start.offset, main!.range.end.offset)).toBe("main [stack]");
    expect(source.slice(paragraph!.range.start.offset, paragraph!.range.end.offset)).toBe("p Hello");
    expect(parsed.diagnostics).toMatchObject([
      { code: "WX002", severity: "error", line: 5, column: 2 },
      { code: "WX003", severity: "error", line: 5, column: 3 },
      { code: "WX002", severity: "error", line: 7, column: 1 },
      { code: "WX004", severity: "error", line: 7, column: 3 }
    ]);
  });

  it("records UTF-16 source ranges across CRLF newlines, tabs, and unicode text", () => {
    const source = 'type Marker = "é"\r\n\r\n~~~\r\nmain [stack]\r\n  p Café 🧪\r\n\t@button Go\r\n';
    const parsed = parseWavex(source);
    const main = parsed.nodes[0];
    const paragraph = main?.children[0];
    const button = main?.children[1];

    expect(main?.range).toEqual({
      start: { line: 4, column: 1, offset: source.indexOf("main [stack]") },
      end: { line: 4, column: "main [stack]".length + 1, offset: source.indexOf("main [stack]") + "main [stack]".length }
    });
    expect(paragraph?.range).toEqual({
      start: { line: 5, column: 3, offset: source.indexOf("p Café 🧪") },
      end: {
        line: 5,
        column: "  p Café 🧪".length + 1,
        offset: source.indexOf("  p Café 🧪") + "  p Café 🧪".length
      }
    });
    expect(button?.range).toEqual({
      start: { line: 6, column: 2, offset: source.indexOf("@button Go") },
      end: {
        line: 6,
        column: "\t@button Go".length + 1,
        offset: source.indexOf("\t@button Go") + "\t@button Go".length
      }
    });
    expect(parsed.prelude).toBe('type Marker = "é"\r\n\r\n');
    expect(parsed.body).toBe('main [stack]\r\n  p Café 🧪\r\n\t@button Go\r\n');
    expect(source.slice(main!.range.start.offset, main!.range.end.offset)).toBe("main [stack]");
    expect(source.slice(paragraph!.range.start.offset, paragraph!.range.end.offset)).toBe("p Café 🧪");
    expect(source.slice(button!.range.start.offset, button!.range.end.offset)).toBe("@button Go");
    expect(parsed.diagnostics).toMatchObject([{ code: "WX002", line: 6, column: 1 }]);
  });
});

describe("validateComponentReferences", () => {
  const webAwesome = { packageName: "@web.awesome.me/webawesome-pro", components: new Set(["button", "card", "icon"]) };

  it("accepts local components, installed WA components, and explicit @wa/", async () => {
    const { validateComponentReferences } = await import("../src/capabilities.js");
    const parsed = parseWavex(`~~~\n@task-card task:\n@button Go\n@wa/card\n@icon name:plus\n`);
    const diagnostics = validateComponentReferences(parsed, {
      localComponents: ["task-card"],
      webAwesome,
      fontAwesome: { kits: ["@awesome.me/kit-x"], packages: [] }
    });
    expect(diagnostics).toEqual([]);
  });

  it("flags unknown components and missing WA capabilities", async () => {
    const { validateComponentReferences } = await import("../src/capabilities.js");
    const parsed = parseWavex(`~~~\n@mystery-widget\n@wa/chart\n`);
    const diagnostics = validateComponentReferences(parsed, {
      localComponents: [],
      webAwesome,
      fontAwesome: { kits: [], packages: [] }
    });
    expect(diagnostics).toMatchObject([
      { code: "WX101", severity: "error" },
      { code: "WX101", severity: "error" }
    ]);
    expect(diagnostics[0]!.message).toContain("@mystery-widget");
    expect(diagnostics[1]!.message).toContain("wa-chart");
  });

  it("downgrades @icon to info when only bundled free icons are available", async () => {
    const { validateComponentReferences } = await import("../src/capabilities.js");
    const parsed = parseWavex(`~~~\n@icon name:plus\n`);
    const diagnostics = validateComponentReferences(parsed, {
      localComponents: [],
      webAwesome,
      fontAwesome: { kits: [], packages: [] }
    });
    expect(diagnostics).toMatchObject([{ code: "WX101", severity: "info" }]);
  });
});

describe("validateConvexReferences", () => {
  it("flags bare mutation/action resources and non-template-callable Convex functions", async () => {
    const { validateConvexReferences } = await import("../src/capabilities.js");
    const parsed = parseWavex(
      `~~~\n$$tasks:list\n$$tasks:create\n$secret:read\n@button :click:$$webhook:receive({ id: String(task._id) }) Handle\n@button :click:$$tasks:list Refresh\n`
    );

    const diagnostics = validateConvexReferences(parsed, {
      functionKinds: {
        "tasks:list": "query",
        "tasks:create": "mutation",
        "secret:read": "internal",
        "webhook:receive": "httpAction"
      }
    });

    expect(diagnostics).toMatchObject([
      { code: "WX102", severity: "error", line: 3, column: 1 },
      { code: "WX102", severity: "error", line: 4, column: 1 },
      { code: "WX102", severity: "error", line: 5, column: 1 },
      { code: "WX102", severity: "error", line: 6, column: 1 }
    ]);
    expect(diagnostics[0]!.message).toContain("Bare $$tasks:create cannot bind a Convex mutation");
    expect(diagnostics[1]!.message).toContain("internal function");
    expect(diagnostics[2]!.message).toContain("httpAction");
    expect(diagnostics[3]!.message).toContain("bind it as a bare resource");
  });

  it("discovers public and reserved Convex function kinds from source files", async () => {
    const { discoverConvexFunctionKinds } = await import("../src/capabilities.js");
    const root = mkdtempSync(join(tmpdir(), "wavex-convex-"));
    mkdirSync(join(root, "convex", "admin"), { recursive: true });
    writeFileSync(
      join(root, "convex", "tasks.ts"),
      `export const list = query({});\nexport const create = mutation({});\nexport const run = action({});\nexport const secret = internalQuery({});\n`
    );
    writeFileSync(join(root, "convex", "admin", "hooks.ts"), `export const receive = httpAction(async () => new Response());\n`);

    expect(discoverConvexFunctionKinds(root)).toMatchObject({
      "tasks:list": "query",
      "tasks:create": "mutation",
      "tasks:run": "action",
      "tasks:secret": "internal",
      "admin/hooks:receive": "httpAction"
    });
  });
});

describe("matchRoutePath", () => {
  const routes = [
    "src/pages/index.wx",
    "src/pages/about.wx",
    "src/pages/talks/index.wx",
    "src/pages/talks/[id].wx",
    "src/pages/talks/new.wx",
    "src/pages/info/index.wx",
    "src/pages/info/[...slug].wx"
  ].map((file) => createRouteDefinition(file)!);

  it("matches static, dynamic, and catch-all routes with createRouteDefinition semantics", () => {
    expect(matchRoutePath(routes, "/")).toMatchObject({ route: { path: "/" }, params: {} });
    expect(matchRoutePath(routes, "/about")).toMatchObject({ route: { path: "/about" } });
    expect(matchRoutePath(routes, "/talks")).toMatchObject({ route: { path: "/talks" } });
    expect(matchRoutePath(routes, "/talks/intro-to-wavex")).toMatchObject({
      route: { path: "/talks/:id" },
      params: { id: "intro-to-wavex" }
    });
    expect(matchRoutePath(routes, "/info/venue/parking")).toMatchObject({
      route: { path: "/info/*slug" },
      params: { slug: "venue/parking" }
    });
    expect(matchRoutePath(routes, "/info")).toMatchObject({ route: { path: "/info" }, params: {} });
  });

  it("prefers sibling index routes over catch-all routes for the directory path regardless of route order", () => {
    const siblingRoutes = [
      "src/pages/info/[...slug].wx",
      "src/pages/info/index.wx"
    ].map((file) => createRouteDefinition(file)!);

    expect(matchRoutePath(siblingRoutes, "/info")).toMatchObject({ route: { path: "/info" }, params: {} });
  });

  it("prefers static segments over params and decodes param values", () => {
    expect(matchRoutePath(routes, "/talks/new")).toMatchObject({ route: { path: "/talks/new" } });
    expect(matchRoutePath(routes, "/talks/caf%C3%A9")).toMatchObject({ params: { id: "café" } });
    expect(matchRoutePath(routes, "/nowhere/at/all")).toBeUndefined();
  });

  it("parses query strings into route context shape", () => {
    expect(parseQueryString("?track=systems&track=web&q=lit")).toEqual({ track: "systems", q: "lit" });
    expect(parseQueryString("")).toEqual({});
  });
});
