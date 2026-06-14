import ts from "typescript";
import { describe, expect, it } from "vitest";
import { compileWavexModule } from "../src/index.js";

type GeneratedRender = (context?: Record<string, unknown>) => unknown;

function evaluateGeneratedRender(code: string): GeneratedRender {
  const javascript = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const executable = javascript
    .replace(/^import .*$/gm, "")
    .replace(/^export default render;$/m, "")
    .replace(/\bexport /g, "");
  const html = () => undefined;
  const repeat = <T>(items: readonly T[], renderItem: (item: T, index: number) => unknown) => items.map(renderItem);

  return Function("html", "nothing", "repeat", `${executable}; return render;`)(html, undefined, repeat) as GeneratedRender;
}

describe("compileWavexModule", () => {
  it("emits a Lit render module for basic .wx templates", () => {
    const compiled = compileWavexModule(`~~~\n+head\n  title Tasks | WAVEx\n\n$$tasks:list args:{ status: route.query.status }\n\nmain [stack gap-xl]\n  +for task in tasks\n    @button variant:brand :click:selectTask task:\n      = task.text\n  p This uses \`code\`, *strong*, _em_, and ~mark~.\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("import { html, nothing } from \"lit\"");
    expect(compiled.code).toContain("satisfies readonly ResourceDefinition[]");
    expect(compiled.code).toContain("getArgs(context: RenderContext)");
    expect(compiled.code).toContain("return { ...({ status: route.query.status }) };");
    expect(compiled.code).toContain("repeat(tasks ?? []");
    expect(compiled.code).toContain("<wa-button");
    expect(compiled.code).toContain("class=\"wa-stack wa-gap-xl\"");
    expect(compiled.code).toContain("<code>code</code>");
    expect(compiled.code).toContain("data-wx-click=\"selectTask\"");
  });

  it("diagnoses and omits bare $$ resources that are not public Convex queries", () => {
    const compiled = compileWavexModule(`~~~\n$$tasks:list\n$$tasks:create\n`, {
      id: "src/pages/index.wx",
      convexFunctionKinds: { "tasks:list": "query", "tasks:create": "mutation" }
    });

    expect(compiled.ast.diagnostics).toMatchObject([{ code: "WX102", severity: "error", line: 3, column: 1 }]);
    expect(compiled.code).toContain(`functionName: "list"`);
    expect(compiled.code).not.toContain(`functionName: "create"`);
  });

  it("omits invalid bare $$ resource children when Convex kind diagnostics fire", () => {
    const compiled = compileWavexModule(`~~~\n$$tasks:create\n  +loading\n    p Creating…\n  p Should not render\n`, {
      id: "src/pages/index.wx",
      convexFunctionKinds: { "tasks:create": "mutation" }
    });

    expect(compiled.ast.diagnostics).toMatchObject([{ code: "WX102", severity: "error", line: 2, column: 1 }]);
    expect(compiled.code).not.toContain("Creating");
    expect(compiled.code).not.toContain("Should not render");
  });

  it("omits invalid Convex semantic event bindings when kind diagnostics fire", () => {
    const compiled = compileWavexModule(`~~~\n@button :click:$$tasks:list\n  +pending\n    p Refreshing…\n  +idle\n    p Refresh\n`, {
      id: "src/pages/index.wx",
      convexFunctionKinds: { "tasks:list": "query" }
    });

    expect(compiled.ast.diagnostics).toMatchObject([{ code: "WX102", severity: "error", line: 2, column: 1 }]);
    expect(compiled.code).not.toContain("data-wx-click");
    expect(compiled.code).not.toContain("context.actionStates?.[\"$$tasks:list\"]");
    expect(compiled.code).toContain("Refreshing");
    expect(compiled.code).toContain("Refresh");
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

  it("compiles local components as render-function composition with attrs and slots", () => {
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
    expect(compiled.code).toContain(`(__wxc_page_shell.default ?? __wxc_page_shell.render)({ ...context, attrs:`);
  });

  it("compiles standard boolean attributes without stealing hyphenated inline text", () => {
    const compiled = compileWavexModule(`~~~\nvideo autoplay muted loop\np easy-going folks\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("<video ?autoplay=${true} ?muted=${true} ?loop=${true}></video>");
    expect(compiled.code).toContain("<p>easy-going folks</p>");

    const render = evaluateGeneratedRender(compiled.code);
    expect(() => render({})).not.toThrow();
  });

  it("compiles boolean identifier and numeric attribute values as expressions", () => {
    const compiled = compileWavexModule(`const isDone = false;\n~~~\ninput checked:isDone count:42 value:3.14\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("<input .checked=${isDone} .count=${42} .value=${3.14}>");
    expect(compiled.code).not.toContain('checked="isDone"');

    const render = evaluateGeneratedRender(compiled.code);
    expect(() => render({})).not.toThrow();
  });

  it("compiles colon-bearing prose as inline text instead of a same-name property binding", () => {
    const compiled = compileWavexModule(`const n = 3;\n~~~\np Total: {{ n }}\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("<p>Total: ${n}</p>");
    expect(compiled.code).not.toContain(".Total=${Total}");

    const render = evaluateGeneratedRender(compiled.code);
    expect(() => render({})).not.toThrow();
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

  it("compiles action-state directives inside semantic-event elements", () => {
    const compiled = compileWavexModule(
      `~~~\n@button :click:$$ai/summarize:run data-slug:talk.slug\n  +pending\n    @spinner\n    | Summarizing…\n  +idle\n    | Summarize\n  +mutation-error problem\n    span {{ String(problem) }}\n`,
      { id: "src/pages/index.wx" }
    );

    expect(compiled.code).toContain(`context.actionStates?.["$$ai/summarize:run"]?.status === "pending" ? html`);
    expect(compiled.code).toContain(`!== "pending" ? html`);
    expect(compiled.code).toContain(`((problem: unknown) =>`);
    expect(compiled.code).toContain(`?.error) : nothing}`);
  });

  it("lowers inline Convex action args from semantic events to the runtime args property", () => {
    const compiled = compileWavexModule(
      `~~~\n@button :click:$$ai:summarize({ id: task._id })\n  +pending\n    @spinner\n    | Summarizing…\n  +idle\n    | Summarize\n`,
      { id: "src/pages/index.wx" }
    );

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain('data-wx-click="$$ai:summarize"');
    expect(compiled.code).toContain(" .args=${{ id: task._id }}");
    expect(compiled.code).toContain(`context.actionStates?.["$$ai:summarize"]?.status === "pending" ? html`);
    expect(compiled.code).not.toContain('data-wx-click="$$ai:summarize({ id: task._id })"');
    expect(compiled.code).not.toContain('context.actionStates?.["$$ai:summarize({ id: task._id })"]');
  });

  it("exposes the validation-app context surface for state, action results, resource states, and data args", () => {
    const compiled = compileWavexModule(
      `~~~\n+if state.filter === "open"\n  @button data-task-id:task._id :click:$$tasks:toggle\n    | Toggle\n\n+if actionStates["$$ai/summarize:run"]?.result\n  p {{ actionStates["$$ai/summarize:run"].result }}\n\n+if resourceStates.tasks?.status === "error"\n  p Failed\n`,
      { id: "src/pages/index.wx" }
    );

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("const state = context.state ?? {};");
    expect(compiled.code).toContain("const resourceStates = context.resourceStates ?? {};");
    expect(compiled.code).toContain('${state.filter === "open" ? html`');
    expect(compiled.code).toContain('data-task-id=${task._id}');
    expect(compiled.code).toContain('data-wx-click="$$tasks:toggle"');
    expect(compiled.code).toContain('${actionStates["$$ai/summarize:run"]?.result ? html`');
    expect(compiled.code).toContain('${resourceStates.tasks?.status === "error" ? html`');
  });

  it("compiles attribute args on $$ calls (the wavex-native form)", () => {
    const compiled = compileWavexModule(
      `~~~\n$$talks:get slug:route.params.slug\n$$talks:list as:systemsTalks track:"systems" featured\n$$tasks:search args:{ ...base } query:state.q\n`,
      { id: "src/pages/x.wx" }
    );

    expect(compiled.code).toContain(`return { "slug": route.params.slug };`);
    expect(compiled.code).toContain(`return { "track": "systems", "featured": true };`);
    // args: object spreads first; attribute args win on conflicts
    expect(compiled.code).toContain(`return { ...({ ...base }), "query": state.q };`);
    expect(compiled.code).not.toContain(`"as":`);
  });

  it("exposes navigation as a bare template local", () => {
    const compiled = compileWavexModule(`~~~\n+if navigation.pending\n  @progress-bar indeterminate\n`, {
      id: "src/pages/+layout.wx"
    });

    expect(compiled.code).toContain("const navigation = context.navigation ?? { pending: false };");
    expect(compiled.code).toContain("${navigation.pending ? html`");
  });

  it("honors as: renames for resource bindings", () => {
    const compiled = compileWavexModule(`~~~\n$$talks:list as:upNext args:{ when: "next" }\n  +for talk in upNext\n    p {{ talk.title }}\n`, {
      id: "src/pages/live.wx"
    });

    expect(compiled.code).toContain(`name: "upNext"`);
    expect(compiled.code).toContain(`const upNext = context.resources?.["upNext"]`);
  });

  it("compiles +suspense reveal:together as an all-resources-ready gate", () => {
    const compiled = compileWavexModule(
      `~~~\n+suspense reveal:together\n  $$speakers:get args:{ slug: route.params.slug }\n  $$talks:list\n  p {{ speaker.name }} / {{ (talks ?? []).length }}\n`,
      { id: "src/pages/x.wx" }
    );

    expect(compiled.code).toContain(`context.resourceStates?.["speaker"]`);
    expect(compiled.code).toContain(`context.resourceStates?.["talks"]`);
    expect(compiled.code).toContain(`=== "ready") && (`);
  });

  it("excludes invalid Convex resource bindings from +suspense readiness gates", () => {
    const compiled = compileWavexModule(
      `~~~\n+suspense reveal:together\n  $$tasks:list\n  $$tasks:create\n  p Loaded\n`,
      {
        id: "src/pages/x.wx",
        convexFunctionKinds: { "tasks:list": "query", "tasks:create": "mutation" }
      }
    );

    expect(compiled.ast.diagnostics).toMatchObject([{ code: "WX102", severity: "error", line: 4, column: 3 }]);
    expect(compiled.code).toContain(`context.resourceStates?.["tasks"]`);
    expect(compiled.code).not.toContain(`context.resourceStates?.["create"]`);
    expect(compiled.code).toContain("Loaded");
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
