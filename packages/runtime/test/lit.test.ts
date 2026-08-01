import { html } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResourceSubscriptionHandlers } from "../src/index.js";

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
});

function documentlessRoot(): HTMLElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLElement;
}
