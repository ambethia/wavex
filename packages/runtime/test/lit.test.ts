import { html } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConvexActionClient, createConvexResourceClient, type ResourceSubscriptionHandlers } from "../src/index.js";

const litRender = vi.hoisted(() => vi.fn());
const routerNavigate = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const routerDispose = vi.hoisted(() => vi.fn());
const createClientRouter = vi.hoisted(() =>
  vi.fn(() => ({ navigate: routerNavigate, hotReplacePage: vi.fn(), dispose: routerDispose }))
);

vi.mock("lit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lit")>();
  return { ...actual, render: litRender };
});
vi.mock("../src/router.js", () => ({ createClientRouter }));

const { mountLit, mountLitApp } = await import("../src/lit.js");

describe("mountLit lifecycle", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __wavexHotReplacePage?: unknown }).__wavexHotReplacePage;
    litRender.mockClear();
    createClientRouter.mockClear();
    routerNavigate.mockClear();
    routerDispose.mockClear();
  });

  it("does not rerender from a queued resource update after dispose", async () => {
    let handlers!: ResourceSubscriptionHandlers;
    const root = documentlessRoot();
    const mount = mountLit(root, (context) => html`value:${context?.resources?.item ?? "none"}`, {}, {
      resources: [{ name: "item", modulePath: "items", functionName: "get" }],
      resourceClient: {
        subscribe(_definition, nextHandlers) {
          handlers = nextHandlers;
        }
      }
    });

    expect(litRender).toHaveBeenCalledTimes(1);

    handlers.next("fresh");
    mount.dispose();
    expect(litRender).toHaveBeenCalledTimes(2);
    expect(litRender.mock.calls.at(-1)?.[0]).toBeUndefined();

    await Promise.resolve();

    expect(litRender).toHaveBeenCalledTimes(2);
    expect(mount.context.resources?.item).toBe("fresh");
  });

  it("ignores public updates after dispose instead of remounting", () => {
    const root = documentlessRoot();
    const mount = mountLit(root, () => html`first`);

    mount.dispose();
    mount.setRender(() => html`second`);
    mount.setResources([{ name: "item", modulePath: "items", functionName: "get" }]);
    mount.setNavigation({ pending: true });
    mount.update();

    expect(litRender).toHaveBeenCalledTimes(2);
    expect(litRender.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it("composes an app-owned context, router, initial navigation, and idempotent lifecycle", async () => {
    const root = documentlessRoot();
    const onDispose = vi.fn();
    const win = { location: { pathname: "/account", search: "?tab=security" } } as Window;
    const routes = [];
    const app = mountLitApp({
      root,
      routes,
      window: win,
      initialContext: { state: { auth: { status: "loading" } } },
      viewTransitions: false,
      onDispose
    });

    expect(app.mount.context.state?.auth).toEqual({ status: "loading" });
    expect(createClientRouter).toHaveBeenCalledWith(
      expect.objectContaining({ routes, host: app.mount, window: win, viewTransitions: false })
    );
    expect(routerNavigate).toHaveBeenCalledWith("/account?tab=security", { replace: true });
    expect((globalThis as typeof globalThis & { __wavexHotReplacePage?: unknown }).__wavexHotReplacePage).toBeTypeOf("function");
    await app.ready;

    app.update({ state: { auth: { status: "authenticated", userId: "user-1" } } });
    expect(app.mount.context.state?.auth).toEqual({ status: "authenticated", userId: "user-1" });

    app.dispose();
    app.dispose();
    expect(routerDispose).toHaveBeenCalledTimes(1);
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect((globalThis as typeof globalThis & { __wavexHotReplacePage?: unknown }).__wavexHotReplacePage).toBeUndefined();
  });

  it("runs local semantic handlers and rerenders without an action client", async () => {
    const root = documentlessRoot();
    let count = 0;
    const mount = mountLit(root, () => html`count:${count}`);
    const domEvent = {} as Event;

    await mount.context.dispatch?.({
      type: "click",
      target: "increment",
      event: domEvent,
      element: {
        __wavexSemanticHandlers: {
          increment: () => {
            count += 1;
          }
        }
      } as unknown as Element,
      context: mount.context
    });

    expect(count).toBe(1);
    expect(litRender).toHaveBeenCalledTimes(3);
    mount.dispose();
  });
});

/**
 * The slice of `ConvexClient` WAVEx uses, with Convex's auth semantics: live
 * subscriptions re-run when auth changes, and signed-in-only functions fail
 * without an identity (like `authComponent.getAuthUser`).
 */
class FakeAuthConvex {
  identity: string | null = null;
  readonly log: string[] = [];
  private readonly live = new Set<{ name: string; args: Record<string, unknown>; callback: (result: unknown) => unknown; onError?: (error: Error) => unknown }>();

  setAuth(identity: string | null) {
    this.identity = identity;
    for (const subscription of this.live) this.run(subscription);
  }

  onUpdate(query: unknown, args: Record<string, unknown>, callback: (result: unknown) => unknown, onError?: (error: Error) => unknown) {
    const subscription = { name: (query as { name: string }).name, args, callback, onError };
    this.live.add(subscription);
    this.run(subscription);
    return () => {
      this.live.delete(subscription);
    };
  }

  async mutation(reference: unknown, args: Record<string, unknown>) {
    this.log.push(`mutation ${(reference as { name: string }).name} ${JSON.stringify(args)} as ${this.identity ?? "anonymous"}`);
    if (!this.identity) throw new Error("Unauthenticated");
    return null;
  }

  async action(reference: unknown) {
    throw new Error(`unexpected action ${(reference as { name: string }).name}`);
  }

  private run(subscription: { name: string; args: Record<string, unknown>; callback: (result: unknown) => unknown; onError?: (error: Error) => unknown }) {
    this.log.push(`run ${subscription.name} ${JSON.stringify(subscription.args)} as ${this.identity ?? "anonymous"}`);
    if (!this.identity) {
      subscription.onError?.(new Error("Unauthenticated"));
      return;
    }
    const { cursor } = subscription.args.paginationOpts as { cursor: string | null };
    subscription.callback(
      cursor === null ? { page: [`${this.identity}:p1`], isDone: false, continueCursor: "c1" } : { page: [`${this.identity}:p2`], isDone: true, continueCursor: "end" }
    );
  }
}

describe("app-owned authenticated Convex client", () => {
  it("subscribes signed-in resources only while state says signed in, and runs actions through the same client", async () => {
    const root = documentlessRoot();
    const convex = new FakeAuthConvex();
    const api = { pledges: { list: { name: "pledges:list" } }, work: { report: { name: "work:report" } } };
    const app = mountLitApp({
      root,
      routes: [],
      window: { location: { pathname: "/", search: "" } } as Window,
      initialContext: { state: { auth: { user: null as string | null } } },
      resourceClient: createConvexResourceClient(convex, { api }),
      actionClient: createConvexActionClient(convex, { api }),
      resolveActionKind: () => "mutation",
      viewTransitions: false
    });
    // What the router commits for a page whose `$$pledges:list paginate:20` sits inside `+if state.auth.user`.
    app.mount.setPage({
      render: () => html`page`,
      route: { path: "/", params: {}, query: {} },
      resources: [
        { name: "pledges", modulePath: "pledges", functionName: "list", raw: "$$pledges:list", kind: "query", pageSize: 20, when: (context) => Boolean(context.state?.auth.user) }
      ]
    });
    const click = (target: string, element: Partial<Element> = {}) =>
      app.mount.context.dispatch?.({
        type: "click",
        target,
        event: {} as Event,
        element: { getAttributeNames: () => [], getAttribute: () => null, ...element } as unknown as Element,
        context: app.mount.context
      });

    expect(convex.log).toEqual([]);

    // Sign-in: the app confirms Convex auth (setAuth's onChange), then publishes it in state.
    convex.setAuth("user-1");
    app.update({ state: { auth: { user: "user-1" } } });
    expect(app.mount.context.resources?.pledges).toEqual(["user-1:p1"]);

    await click("pledges.nextPage");
    expect(app.mount.context.resources?.pledges).toEqual(["user-1:p2"]);
    expect(app.mount.context.resourceStates?.pledges).toMatchObject({ status: "ready", hasPreviousPage: true, hasNextPage: false });

    await click("$$work:report", { args: { id: "item-1", resolved: true } } as Partial<Element>);
    expect(app.mount.context.actionStates?.["$$work:report"]).toMatchObject({ status: "idle" });

    // Sign-out: close the gate first, then clear the client's auth, so nothing re-runs signed out.
    app.update({ state: { auth: { user: null } } });
    convex.setAuth(null);
    expect(app.mount.context.resourceStates).toEqual({});

    // Signing in as someone else starts that user's list on its first page.
    convex.setAuth("user-2");
    app.update({ state: { auth: { user: "user-2" } } });
    expect(app.mount.context.resources?.pledges).toEqual(["user-2:p1"]);

    expect(convex.log).toEqual([
      'run pledges:list {"paginationOpts":{"cursor":null,"numItems":20}} as user-1',
      'run pledges:list {"paginationOpts":{"cursor":"c1","numItems":20}} as user-1',
      'mutation work:report {"id":"item-1","resolved":true} as user-1',
      'run pledges:list {"paginationOpts":{"cursor":null,"numItems":20}} as user-2'
    ]);
    app.dispose();
  });
});

function documentlessRoot(): HTMLElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLElement;
}
