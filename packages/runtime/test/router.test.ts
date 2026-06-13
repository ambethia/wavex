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

import { createClientRouter, type ClientRoute } from "../src/index.js";

interface Deferred {
  promise: Promise<RoutePageModule>;
  resolve: (module: RoutePageModule) => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<RoutePageModule>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeEnvironment(options: { startViewTransition?: boolean; reducedMotion?: boolean } = {}) {
  const calls: Array<{ kind: string; payload?: unknown }> = [];
  const attributes = new Set<string>();
  const transitions: Array<{ types?: string[] }> = [];

  const documentRef: Record<string, unknown> = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    documentElement: {
      setAttribute: (name: string) => attributes.add(name),
      removeAttribute: (name: string) => attributes.delete(name)
    }
  };
  if (options.startViewTransition) {
    documentRef.startViewTransition = (update: (() => void) | { update: () => void; types?: string[] }) => {
      const callback = typeof update === "function" ? update : update.update;
      transitions.push({ types: typeof update === "function" ? undefined : update.types });
      const updateCallbackDone = Promise.resolve().then(() => callback());
      return { updateCallbackDone };
    };
  }

  const win = {
    location: { href: "http://app.test/", origin: "http://app.test", pathname: "/", search: "" },
    history: {
      pushState: (_s: unknown, _t: string, url: string) => calls.push({ kind: "pushState", payload: url }),
      replaceState: (_s: unknown, _t: string, url: string) => calls.push({ kind: "replaceState", payload: url })
    },
    matchMedia: () => ({ matches: options.reducedMotion ?? false }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    document: documentRef
  } as never;

  const host = {
    setPage: (page: { route: { path: string } }) => calls.push({ kind: "setPage", payload: page.route.path }),
    update: () => undefined,
    setNavigation: (navigation: { pending: boolean }) => calls.push({ kind: "setNavigation", payload: navigation.pending })
  };

  return { win, host, calls, attributes, transitions };
}

function routeOf(file: string, path: string, load: () => Promise<RoutePageModule>, errors: ClientRoute["errors"] = []): ClientRoute {
  return {
    id: file,
    file,
    path,
    segments: path
      .split("/")
      .filter(Boolean)
      .map((value) => ({ kind: "static" as const, value })),
    layouts: [],
    errors,
    load
  };
}

describe("client router navigation lifecycle", () => {
  it("sets pending before load, clears it atomically with the commit, and mirrors data-wx-navigating", async () => {
    const env = fakeEnvironment();
    const slow = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => slow.promise)],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const navigation = router.navigate("/a");
    await Promise.resolve();
    expect(env.calls).toContainEqual({ kind: "setNavigation", payload: true });
    expect(env.attributes.has("data-wx-navigating")).toBe(true);
    expect(env.calls.some((call) => call.kind === "setPage")).toBe(false);

    slow.resolve({ default: () => "a" });
    await navigation;
    const pendingFalse = env.calls.findIndex((call) => call.kind === "setNavigation" && call.payload === false);
    const committed = env.calls.findIndex((call) => call.kind === "setPage");
    expect(pendingFalse).toBeGreaterThan(-1);
    expect(committed).toBeGreaterThan(pendingFalse);
    expect(env.attributes.has("data-wx-navigating")).toBe(false);
  });

  it("supersession: a stale navigation never commits or touches pending state", async () => {
    const env = fakeEnvironment();
    const slowA = deferred();
    const fastB = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => slowA.promise), routeOf("b.wx", "/b", () => fastB.promise)],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const navigationA = router.navigate("/a");
    const navigationB = router.navigate("/b");
    fastB.resolve({ default: () => "b" });
    await navigationB;
    const callsAfterB = env.calls.length;
    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([{ kind: "setPage", payload: "/b" }]);

    slowA.resolve({ default: () => "a" });
    await navigationA;
    expect(env.calls.length).toBe(callsAfterB); // no further calls from the stale navigation
  });

  it("clears pending on load failure without +error.wx and rejects", async () => {
    const env = fakeEnvironment();
    const failing = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => failing.promise)],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const navigation = router.navigate("/a");
    failing.reject(new Error("boom"));
    await expect(navigation).rejects.toThrow("boom");
    expect(env.calls.at(-1)).toEqual({ kind: "setNavigation", payload: false });
    expect(env.attributes.has("data-wx-navigating")).toBe(false);
  });

  it("never sets pending for unmatched (notFound) paths", async () => {
    const env = fakeEnvironment();
    const router = createClientRouter({ routes: [], host: env.host, window: env.win, viewTransitions: false });
    await router.navigate("/nowhere");
    expect(env.calls.some((call) => call.kind === "setNavigation" && call.payload === true)).toBe(false);
  });

  it("works with hosts that do not implement setNavigation", async () => {
    const env = fakeEnvironment();
    const host = { setPage: () => undefined, update: () => undefined };
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host,
      window: env.win,
      viewTransitions: false
    });
    await expect(router.navigate("/a")).resolves.toBeUndefined();
  });
});

describe("client router view transitions", () => {
  it("skips the first navigation, transitions later ones with direction types, and respects opt-out", async () => {
    const env = fakeEnvironment({ startViewTransition: true });
    const router = createClientRouter({
      routes: [
        routeOf("a.wx", "/a", async () => ({ default: () => "a" })),
        routeOf("b.wx", "/b", async () => ({ default: () => "b" }))
      ],
      host: env.host,
      window: env.win
    });

    await router.navigate("/a");
    expect(env.transitions.length).toBe(0); // initial load: no old page to transition from

    await router.navigate("/b");
    expect(env.transitions.length).toBe(1);
    expect(env.transitions[0]!.types).toEqual(["wavex-navigation", "forward"]);
    expect(env.calls.filter((call) => call.kind === "setPage").map((call) => call.payload)).toEqual(["/a", "/b"]);
  });

  it("skips transitions under prefers-reduced-motion and when disabled", async () => {
    for (const options of [{ reducedMotion: true }, { disabled: true }]) {
      const env = fakeEnvironment({ startViewTransition: true, reducedMotion: "reducedMotion" in options });
      const router = createClientRouter({
        routes: [
          routeOf("a.wx", "/a", async () => ({ default: () => "a" })),
          routeOf("b.wx", "/b", async () => ({ default: () => "b" }))
        ],
        host: env.host,
        window: env.win,
        viewTransitions: !("disabled" in options)
      });
      await router.navigate("/a");
      await router.navigate("/b");
      expect(env.transitions.length).toBe(0);
      expect(env.calls.filter((call) => call.kind === "setPage").length).toBe(2);
    }
  });

  it("never transitions HMR hot replacement", async () => {
    const env = fakeEnvironment({ startViewTransition: true });
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host: env.host,
      window: env.win
    });
    await router.navigate("/a");
    router.hotReplacePage("a.wx", { default: () => "a2" });
    expect(env.transitions.length).toBe(0);
    expect(env.calls.filter((call) => call.kind === "setPage").length).toBe(2);
  });
});
