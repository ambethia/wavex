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

  it("leaves resource-state directives inert outside a $$ block", () => {
    const compiled = compileWavexModule(`~~~\nmain\n  +loading\n    p Should render unconditionally\n`, {
      id: "src/pages/index.wx"
    });

    expect(compiled.code).not.toContain(`=== "loading" ? html`);
    expect(compiled.code).toContain("Should render unconditionally");
  });
});
