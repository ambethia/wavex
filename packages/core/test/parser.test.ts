import { describe, expect, it } from "vitest";
import { parseAttributeToken, parseWavex } from "../src/index.js";

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

  it("parses attribute value forms", () => {
    expect(parseAttributeToken("required")).toMatchObject({ kind: "boolean", name: "required" });
    expect(parseAttributeToken("task:")).toMatchObject({ kind: "same-name", name: "task" });
    expect(parseAttributeToken("label:\"Full name\"")).toMatchObject({ kind: "literal", value: "Full name" });
    expect(parseAttributeToken("checked:{{ task.isCompleted }}")).toMatchObject({
      kind: "expression",
      expression: "task.isCompleted"
    });
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
  });
});
