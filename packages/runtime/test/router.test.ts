import { describe, expect, it } from "vitest";
import { composeLayoutRender, type RenderContext, type RoutePageModule } from "../src/index.js";

describe("composeLayoutRender", () => {
  const page: RoutePageModule = {
    default: (context?: RenderContext) => `page(${context?.route?.path ?? "?"})`,
    resources: [{ name: "talks", modulePath: "talks", functionName: "list" }]
  };

  it("returns the page render untouched with no layouts", () => {
    const composed = composeLayoutRender([], page);
    expect(composed.render({ route: { path: "/x", params: {}, query: {} } })).toBe("page(/x)");
    expect(composed.resources).toMatchObject([{ name: "talks" }]);
  });

  it("wraps layouts outermost-first and projects inner content through slots.default", () => {
    const outer: RoutePageModule = {
      default: (context?: RenderContext) => `outer[${String(context?.slots?.default)}]`,
      resources: [{ name: "announcements", modulePath: "announcements", functionName: "list" }]
    };
    const inner: RoutePageModule = {
      default: (context?: RenderContext) => `inner[${String(context?.slots?.default)}]`
    };

    const composed = composeLayoutRender([outer, inner], page);
    expect(composed.render({ route: { path: "/talks", params: {}, query: {} } })).toBe("outer[inner[page(/talks)]]");
    // Page and layout resources merge
    expect(composed.resources.map((resource) => resource.name).sort()).toEqual(["announcements", "talks"]);
  });

  it("preserves the page context for layouts (route stays visible)", () => {
    const layout: RoutePageModule = {
      default: (context?: RenderContext) => `layout(${context?.route?.path})[${String(context?.slots?.default)}]`
    };
    const composed = composeLayoutRender([layout], page);
    expect(composed.render({ route: { path: "/a", params: {}, query: {} } })).toBe("layout(/a)[page(/a)]");
  });
});
