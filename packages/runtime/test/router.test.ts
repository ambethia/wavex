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
  const documentListeners = new Map<string, Set<(event: Event) => void>>();
  const windowListeners = new Map<string, Set<(event: Event) => void>>();

  class FakeAnchor {
    target = "";
    href: string;
    private readonly attributes = new Map<string, string>();

    constructor(href: string, attributes: Record<string, string> = {}) {
      this.href = new URL(href, win.location.href).href;
      for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
      this.attributes.set("href", href);
      this.target = attributes.target ?? "";
    }

    hasAttribute(name: string): boolean {
      return this.attributes.has(name);
    }

    getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }
  }

  const documentRef: Record<string, unknown> = {
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const listeners = documentListeners.get(type) ?? new Set();
      listeners.add(listener);
      documentListeners.set(type, listeners);
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => documentListeners.get(type)?.delete(listener),
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

  const location = { href: "http://app.test/", origin: "http://app.test", pathname: "/", search: "", hash: "" };
  const setLocation = (url: string) => {
    const next = new URL(url, location.href);
    location.href = next.href;
    location.origin = next.origin;
    location.pathname = next.pathname;
    location.search = next.search;
    location.hash = next.hash;
  };
  const win = {
    location,
    history: {
      pushState: (_s: unknown, _t: string, url: string) => {
        calls.push({ kind: "pushState", payload: url });
        setLocation(url);
      },
      replaceState: (_s: unknown, _t: string, url: string) => {
        calls.push({ kind: "replaceState", payload: url });
        setLocation(url);
      }
    },
    matchMedia: () => ({ matches: options.reducedMotion ?? false }),
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const listeners = windowListeners.get(type) ?? new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => windowListeners.get(type)?.delete(listener),
    document: documentRef,
    HTMLAnchorElement: FakeAnchor
  } as never;

  const click = (anchor: InstanceType<typeof FakeAnchor>, eventInit: Partial<MouseEvent> = {}) => {
    let prevented = false;
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      composedPath: () => [anchor, documentRef],
      preventDefault: () => {
        prevented = true;
      },
      ...eventInit
    } as MouseEvent;
    documentListeners.get("click")?.forEach((listener) => listener(event));
    return prevented;
  };

  const pop = (url: string) => {
    setLocation(url);
    windowListeners.get("popstate")?.forEach((listener) => listener(new Event("popstate")));
  };

  const host = {
    setPage: (page: { route: { path: string } }) => calls.push({ kind: "setPage", payload: page.route.path }),
    update: () => undefined,
    setNavigation: (navigation: { pending: boolean }) => calls.push({ kind: "setNavigation", payload: navigation.pending })
  };

  return { win, host, calls, attributes, transitions, click, pop, FakeAnchor };
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

  it("does not advance current when an unmatched route commit fails", async () => {
    const env = fakeEnvironment();
    const host = {
      ...env.host,
      setPage: (page: { route: { path: string } }) => {
        if (page.route.path === "/missing") throw new Error("not found commit failed");
        env.host.setPage(page);
      }
    };
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host,
      window: env.win,
      viewTransitions: false
    });

    await router.navigate("/a");
    await expect(router.navigate("/missing")).rejects.toThrow("not found commit failed");

    expect(router.current?.route.path).toBe("/a");
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

  it("intercepts eligible same-origin route links and leaves native-only links alone", async () => {
    const env = fakeEnvironment();
    createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    expect(env.click(new env.FakeAnchor("/a?tab=1"))).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(env.calls.some((call) => call.kind === "pushState" && call.payload === "/a?tab=1")).toBe(true);
    expect(env.calls.some((call) => call.kind === "setPage" && call.payload === "/a")).toBe(true);

    expect(env.click(new env.FakeAnchor("/unmatched"))).toBe(false);
    expect(env.click(new env.FakeAnchor("https://external.test/a"))).toBe(false);
    expect(env.click(new env.FakeAnchor("/a", { target: "_blank" }))).toBe(false);
    expect(env.click(new env.FakeAnchor("/a", { download: "file.txt" }))).toBe(false);
    expect(env.click(new env.FakeAnchor("/a", { rel: "external" }))).toBe(false);
    expect(env.click(new env.FakeAnchor("/a"), { metaKey: true })).toBe(false);
  });

  it("leaves same-document hash anchors to native browser scrolling", async () => {
    const env = fakeEnvironment();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });
    await router.navigate("/a?tab=1");
    env.calls.length = 0;

    expect(env.click(new env.FakeAnchor("#section"))).toBe(false);
    expect(env.click(new env.FakeAnchor("/a?tab=1#"))).toBe(false);
    expect(env.calls).toEqual([]);
  });

  it("preserves hashes for routed link and popstate navigations", async () => {
    const env = fakeEnvironment();
    createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    expect(env.click(new env.FakeAnchor("/a#section"))).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(env.calls).toContainEqual({ kind: "pushState", payload: "/a#section" });

    env.calls.length = 0;
    expect(env.click(new env.FakeAnchor("/a?from=home#"))).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(env.calls).toContainEqual({ kind: "pushState", payload: "/a?from=home#" });

    env.calls.length = 0;
    env.pop("/a?from=back#section");
    await Promise.resolve();
    await Promise.resolve();
    expect(env.calls.some((call) => call.kind === "pushState" || call.kind === "replaceState")).toBe(false);
    expect(env.calls.some((call) => call.kind === "setPage" && call.payload === "/a")).toBe(true);
  });

  it("navigates on popstate without pushing a new history entry", async () => {
    const env = fakeEnvironment();
    createClientRouter({
      routes: [routeOf("a.wx", "/a", async () => ({ default: () => "a" }))],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    env.pop("/a?from=back");
    await Promise.resolve();
    await Promise.resolve();

    expect(env.calls.some((call) => call.kind === "pushState" || call.kind === "replaceState")).toBe(false);
    expect(env.calls.some((call) => call.kind === "setPage" && call.payload === "/a")).toBe(true);
  });

  it("clears pending when an unmatched navigation supersedes an in-flight route", async () => {
    const env = fakeEnvironment();
    const slow = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => slow.promise)],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const first = router.navigate("/a");
    await router.navigate("/missing");

    expect(env.calls.filter((call) => call.kind === "setNavigation").map((call) => call.payload)).toEqual([true, false]);
    expect(env.attributes.has("data-wx-navigating")).toBe(false);
    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([{ kind: "setPage", payload: "/missing" }]);
    expect(router.current?.route.path).toBe("/missing");

    slow.resolve({ default: () => "a" });
    await first;
    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([{ kind: "setPage", payload: "/missing" }]);
  });

  it("does not commit a stale error route after a newer navigation wins", async () => {
    const env = fakeEnvironment();
    const failing = deferred();
    const slowError = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => failing.promise, [{ file: "+error.wx", load: () => slowError.promise }])],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const first = router.navigate("/a");
    failing.reject(new Error("boom"));
    await Promise.resolve();
    await router.navigate("/missing");

    slowError.resolve({ default: () => "error" });
    await first;

    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([{ kind: "setPage", payload: "/missing" }]);
  });

  it("cancels in-flight navigation and clears pending state when disposed", async () => {
    const env = fakeEnvironment();
    const slow = deferred();
    const router = createClientRouter({
      routes: [routeOf("a.wx", "/a", () => slow.promise)],
      host: env.host,
      window: env.win,
      viewTransitions: false
    });

    const pending = router.navigate("/a");
    router.dispose();
    slow.resolve({ default: () => "a" });
    await pending;

    expect(env.calls).toContainEqual({ kind: "setNavigation", payload: false });
    expect(env.attributes.has("data-wx-navigating")).toBe(false);
    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([]);

    expect(env.click(new env.FakeAnchor("/a"))).toBe(false);
    await router.navigate("/a");
    expect(env.calls.filter((call) => call.kind === "setPage")).toEqual([]);
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

  it("propagates errors thrown during a transitioned commit", async () => {
    const env = fakeEnvironment({ startViewTransition: true });
    const host = {
      ...env.host,
      setPage: (page: { route: { path: string } }) => {
        if (page.route.path === "/b") throw new Error("commit failed");
        env.host.setPage(page);
      }
    };
    const router = createClientRouter({
      routes: [
        routeOf("a.wx", "/a", async () => ({ default: () => "a" })),
        routeOf("b.wx", "/b", async () => ({ default: () => "b" }))
      ],
      host,
      window: env.win
    });

    await router.navigate("/a");
    await expect(router.navigate("/b")).rejects.toThrow("commit failed");
    expect(router.current?.route.path).toBe("/a");
  });

  it("does not treat transitioned commit failures as route load errors", async () => {
    const env = fakeEnvironment({ startViewTransition: true });
    let errorRouteLoads = 0;
    const host = {
      ...env.host,
      setPage: (page: { route: { path: string } }) => {
        if (page.route.path === "/b") throw new Error("commit failed");
        env.host.setPage(page);
      }
    };
    const router = createClientRouter({
      routes: [
        routeOf("a.wx", "/a", async () => ({ default: () => "a" })),
        routeOf("b.wx", "/b", async () => ({ default: () => "b" }), [
          {
            file: "+error.wx",
            load: async () => {
              errorRouteLoads += 1;
              return { default: () => "error" };
            }
          }
        ])
      ],
      host,
      window: env.win
    });

    await router.navigate("/a");
    await expect(router.navigate("/b")).rejects.toThrow("commit failed");

    expect(errorRouteLoads).toBe(0);
    expect(router.current?.route.path).toBe("/a");
  });

  it("does not retry synchronous TypeError commit failures as view-transition API fallback", async () => {
    const env = fakeEnvironment({ startViewTransition: true });
    const documentRef = env.win.document as Document & {
      startViewTransition: (update: (() => void) | { update: () => void }) => { updateCallbackDone: Promise<void> };
    };
    documentRef.startViewTransition = (update) => {
      const callback = typeof update === "function" ? update : update.update;
      callback();
      return { updateCallbackDone: Promise.resolve() };
    };
    let commitAttempts = 0;
    const host = {
      ...env.host,
      setPage: (page: { route: { path: string } }) => {
        if (page.route.path === "/b") {
          commitAttempts += 1;
          throw new TypeError("commit failed");
        }
        env.host.setPage(page);
      }
    };
    const router = createClientRouter({
      routes: [
        routeOf("a.wx", "/a", async () => ({ default: () => "a" })),
        routeOf("b.wx", "/b", async () => ({ default: () => "b" }))
      ],
      host,
      window: env.win
    });

    await router.navigate("/a");
    await expect(router.navigate("/b")).rejects.toThrow("commit failed");
    expect(commitAttempts).toBe(1);
    expect(router.current?.route.path).toBe("/a");
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
