import { describe, expect, it } from "vitest";
import { compileWavexModule } from "../src/index.js";

describe("compileWavexModule", () => {
  it("emits a Lit render module for basic .wx templates", () => {
    const compiled = compileWavexModule(`~~~\n+head\n  title Tasks | WAVEx\n\n$$tasks:list args:{ status: route.query.status }\n\nmain [stack gap-xl]\n  +for task in tasks\n    @button variant:brand :click:selectTask task:\n      = task.text\n  p This uses \`code\`, *strong*, _em_, and ~mark~.\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("import { html, nothing } from \"lit\"");
    expect(compiled.code).toContain("satisfies readonly ResourceDefinition[]");
    expect(compiled.code).toContain("getArgs(context: RenderContext)");
    expect(compiled.code).toContain("return { status: route.query.status };");
    expect(compiled.code).toContain("repeat(tasks ?? []");
    expect(compiled.code).toContain("<wa-button");
    expect(compiled.code).toContain("class=\"wa-stack wa-gap-xl\"");
    expect(compiled.code).toContain("<code>code</code>");
    expect(compiled.code).toContain("data-wx-click=\"selectTask\"");
  });

  it("compiles resource-state directives conditionally inside $$ blocks", () => {
    const compiled = compileWavexModule(
      `~~~\n$$tasks:list\n  +loading\n    p Loading…\n  +empty\n    p No tasks yet.\n  +error problem\n    p {{ String(problem) }}\n  +for task in tasks\n    p {{ task.text }}\n`,
      { id: "src/pages/index.wx" }
    );

    expect(compiled.ast.diagnostics).toEqual([]);
    // +loading renders only while the resource status is loading
    expect(compiled.code).toContain(`(context.resourceStates?.["tasks"]?.status ?? (context.resources?.["tasks"] === undefined ? "loading" : "ready")) === "loading" ? html`);
    // +empty requires ready status and an empty/null value
    expect(compiled.code).toContain(`=== "ready" &&`);
    expect(compiled.code).toContain(`Array.isArray(context.resources?.["tasks"])`);
    // +error binds the declared identifier to the resource error
    expect(compiled.code).toContain(`((problem: unknown) => html`);
    expect(compiled.code).toContain(`(context.resourceStates?.["tasks"]?.error)`);
  });

  it("compiles +head into structured headEntries", () => {
    const compiled = compileWavexModule(
      `~~~\n+head\n  title {{ talk.title }} | Swell\n  meta name:description content:talk.summary\n  link rel:canonical href:"https://swell.example/talks"\n`,
      { id: "src/pages/talks/[slug].wx" }
    );

    expect(compiled.code).toContain(`export function headEntries(context: RenderContext = {}): HeadEntry[]`);
    expect(compiled.code).toContain('{ tag: "title", text: `${talk.title} | Swell` }');
    expect(compiled.code).toContain('{ tag: "meta", attributes: { "name": "description", "content": String(talk.summary) } }');
    expect(compiled.code).toContain('{ tag: "link", attributes: { "rel": "canonical", "href": "https://swell.example/talks" } }');
  });

  it("compiles local components as render-function composition with props and slots", () => {
    const compiled = compileWavexModule(
      `~~~\n@page-shell layout:"wide"\n  h1 slot:title Tasks\n  @tasks/item task: required\n  p Body content\n`,
      { id: "src/pages/index.wx", localComponents: ["page-shell", "tasks/item"] }
    );

    expect(compiled.code).toContain(`import * as __wxc_page_shell from "/src/components/page-shell.wx";`);
    expect(compiled.code).toContain(`import * as __wxc_tasks_item from "/src/components/tasks/item.wx";`);
    // Props flow through, including same-name shorthand and booleans
    expect(compiled.code).toContain(`"layout": "wide"`);
    expect(compiled.code).toContain(`"task": task`);
    expect(compiled.code).toContain(`"required": true`);
    // slot:title child fills a named slot and loses the slot attribute
    expect(compiled.code).toContain(`"title": html\`<h1>Tasks</h1>\``);
    // remaining children fill the default slot
    expect(compiled.code).toContain(`"default": html\``);
    expect(compiled.code).toContain(`(__wxc_page_shell.default ?? __wxc_page_shell.render)({ ...context, props:`);
  });

  it("compiles bare slot elements to semantic projection with fallback", () => {
    const compiled = compileWavexModule(`~~~\nmain\n  slot\n  slot name:title\n    h2 Default title\n`, {
      id: "src/components/page-shell.wx"
    });

    expect(compiled.code).toContain(`\${context.slots?.["default"] ?? nothing}`);
    expect(compiled.code).toContain(`\${context.slots?.["title"] ?? html\`<h2>Default title</h2>\`}`);
  });

  it("keeps slot: attributes native for Web Awesome components", () => {
    const compiled = compileWavexModule(`~~~\n@page\n  header slot:header Site\n`, { id: "src/pages/index.wx" });

    expect(compiled.code).toContain(`<wa-page`);
    expect(compiled.code).toContain(`slot="header"`);
  });

  it("resolves @wa/ explicitly even when a local component shadows the name", () => {
    const compiled = compileWavexModule(`~~~\n@badge Local\n@wa/badge Native\n`, {
      id: "src/pages/index.wx",
      localComponents: ["badge"]
    });

    expect(compiled.code).toContain(`__wxc_badge.default ?? __wxc_badge.render`);
    expect(compiled.code).toContain(`<wa-badge`);
  });

  it("compiles +boundary to a try/catch around eager template evaluation", () => {
    const compiled = compileWavexModule(
      `~~~\n+boundary\n  +error problem\n    p\n      | Failed: {{ String(problem) }}\n  section\n    p {{ data.mustExist }}\n`,
      { id: "src/pages/index.wx" }
    );

    expect(compiled.code).toContain("try { return html`");
    expect(compiled.code).toContain("catch (__wxBoundaryError)");
    expect(compiled.code).toContain("((problem: unknown) =>");
    expect(compiled.code).toContain("Failed:");
    // boundary content excludes the +error fallback from the try body
    const tryBody = compiled.code.split("try { return html`")[1]!.split("`;")[0]!;
    expect(tryBody).toContain("data.mustExist");
    expect(tryBody).not.toContain("Failed:");
  });

  it("leaves resource-state directives inert outside a $$ block", () => {
    const compiled = compileWavexModule(`~~~\nmain\n  +loading\n    p Should render unconditionally\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.code).not.toContain(`=== "loading" ? html`);
    expect(compiled.code).toContain("Should render unconditionally");
  });
});
