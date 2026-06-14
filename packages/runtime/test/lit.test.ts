import { html } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResourceSubscriptionHandlers } from "../src/index.js";

const litRender = vi.hoisted(() => vi.fn());

vi.mock("lit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lit")>();
  return { ...actual, render: litRender };
});

const { mountLit } = await import("../src/lit.js");

describe("mountLit lifecycle", () => {
  beforeEach(() => {
    litRender.mockClear();
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
});

function documentlessRoot(): HTMLElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLElement;
}
