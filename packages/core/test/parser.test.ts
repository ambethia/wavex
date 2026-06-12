import { describe, expect, it } from "vitest";
import { createRouteDefinition, matchRoutePath, parseAttributeToken, parseQueryString, parseWavex } from "../src/index.js";

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
    // URL paths are literals, not expressions (a href:/tasks Tasks)
    expect(parseAttributeToken("href:/tasks")).toMatchObject({ kind: "literal", value: "/tasks" });
    expect(parseAttributeToken("href:/schedule?track=systems")).toMatchObject({
      kind: "literal",
      value: "/schedule?track=systems"
    });
    expect(parseAttributeToken("href:route.url")).toMatchObject({ kind: "expression", expression: "route.url" });
  });

  it("rejects colon-form utility tokens with WX005", () => {
    const parsed = parseWavex(`~~~\nmain [stack gap:xl]\n  p Hello\n`);

    expect(parsed.diagnostics).toMatchObject([
      { code: "WX005", severity: "error", line: 2 }
    ]);
    expect(parsed.diagnostics[0]!.message).toContain("gap:xl");
  });

  it("accepts dash-form utility tokens without diagnostics", () => {
    const parsed = parseWavex(`~~~\nmain [stack gap-xl align-items-center]\n`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({ utilities: ["stack", "gap-xl", "align-items-center"] });
  });
});

describe("matchRoutePath", () => {
  const routes = [
    "src/pages/index.wx",
    "src/pages/about.wx",
    "src/pages/talks/index.wx",
    "src/pages/talks/[id].wx",
    "src/pages/talks/new.wx",
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
    expect(matchRoutePath(routes, "/info")).toMatchObject({ route: { path: "/info/*slug" }, params: { slug: "" } });
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
