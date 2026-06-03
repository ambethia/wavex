import { describe, expect, it } from "vitest";
import { compileWavexModule } from "../src/index.js";

describe("compileWavexModule", () => {
  it("emits a Lit render module for basic .wx templates", () => {
    const compiled = compileWavexModule(`~~~\n+head\n  title Tasks | WAVEx\n\n$$tasks:list\n\nmain [stack gap-xl]\n  +for task in tasks\n    @button variant:brand :click:selectTask task:\n      = task.text\n  p This uses \`code\`, *strong*, _em_, and ~mark~.\n`, {
      id: "app/pages/index.wx"
    });

    expect(compiled.ast.diagnostics).toEqual([]);
    expect(compiled.code).toContain("import { html, nothing } from \"lit\"");
    expect(compiled.code).toContain("repeat(tasks ?? []");
    expect(compiled.code).toContain("<wa-button");
    expect(compiled.code).toContain("class=\"wa-stack wa-gap-xl\"");
    expect(compiled.code).toContain("<code>code</code>");
    expect(compiled.code).toContain("data-wx-click=\"selectTask\"");
  });
});
