import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  createClientRouter,
  type ActionClient,
  type ClientRouter,
  type ResolvedActionDefinition,
  type ResolvedResourceDefinition,
  type ResourceClient,
  type ResourceSubscriptionHandlers,
} from "@wavex/runtime";
import { mountLit, type LitMount } from "@wavex/runtime/lit";
import routes from "virtual:wavex/routes";

const talks = [
  {
    _id: "talk-1",
    slug: "realtime-by-default",
    title: "Realtime by Default",
    speaker: "Mara Lin",
    track: "systems",
    startsAt: "09:30",
    summary: "Why realtime should be the baseline for web apps.",
  },
  {
    _id: "talk-2",
    slug: "compile-to-lit",
    title: "Compile to Lit, Stand on Giants",
    speaker: "Theo Okafor",
    track: "frameworks",
    startsAt: "10:30",
    summary: "Build on the platform and the Lit ecosystem.",
  },
];

class SwellTestBackend implements ResourceClient, ActionClient {
  readonly invocations: ResolvedActionDefinition[] = [];

  subscribe<T>(definition: ResolvedResourceDefinition, handlers: ResourceSubscriptionHandlers<T>) {
    const address = `${definition.modulePath}:${definition.functionName}`;
    const args = definition.args as Record<string, string | undefined>;
    let value: unknown;
    switch (address) {
      case "talks:list":
        value = args.track ? talks.filter((talk) => talk.track === args.track) : talks;
        break;
      case "talks:get":
        value = talks.find((talk) => talk.slug === args.slug) ?? null;
        break;
      case "speakers:list":
        value = [];
        break;
      case "speakers:get":
        value = null;
        break;
      case "questions:listByTalk":
        value = [];
        break;
      default:
        throw new Error(`Unexpected test resource ${address}`);
    }
    handlers.next(value as T);
    return () => undefined;
  }

  async invoke(definition: ResolvedActionDefinition): Promise<unknown> {
    this.invocations.push(definition);
    if (`${definition.modulePath}:${definition.functionName}` === "rsvps:create") {
      throw new Error("This email is already registered.");
    }
    return undefined;
  }
}

let app: LitMount | undefined;
let router: ClientRouter | undefined;
let root: HTMLDivElement | undefined;
const originalTitle = document.title;

afterEach(() => {
  router?.dispose();
  router = undefined;
  app?.dispose();
  app = undefined;
  root?.remove();
  root = undefined;
  document.querySelectorAll("[data-wx-head]").forEach((node) => node.remove());
  document.title = originalTitle;
  document.documentElement.removeAttribute("data-wx-navigating");
});

function mountSwell() {
  window.history.replaceState({}, "", "/");
  root = document.createElement("div");
  document.body.append(root);
  const backend = new SwellTestBackend();
  app = mountLit(root, () => undefined, {}, {
    resourceClient: backend,
    actionClient: backend,
    resolveActionKind: (definition) => (definition.modulePath === "ai/summarize" ? "action" : "mutation"),
  });
  router = createClientRouter({ routes, host: app, viewTransitions: false });
  return { backend, router };
}

describe("Swell Conf browser flows", () => {
  it("navigates static, dynamic, catch-all, and history routes with live head updates", async () => {
    const mounted = mountSwell();
    await mounted.router.navigate("/", { replace: true });
    await expect.poll(() => document.title).toBe("Swell Conf");
    await expect.poll(() => root?.textContent).toContain("A one-day conference");

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    await expect.poll(() => document.title).toBe("Schedule | Swell Conf");
    await expect.poll(() => root?.textContent).toContain("Realtime by Default");

    const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.back();
    await popped;
    await expect.poll(() => document.title).toBe("Swell Conf");

    await mounted.router.navigate("/talks/realtime-by-default");
    await expect.poll(() => document.title).toBe("Realtime by Default | Swell Conf");
    await expect.poll(() => root?.textContent).toContain("Live Q&A");

    await mounted.router.navigate("/info/venue");
    await expect.poll(() => document.title).toBe("Info | Swell Conf");
    await expect.poll(() => root?.textContent).toContain("info / venue");
  });

  it("renders a deterministic mutation error through the real RSVP form bridge", async () => {
    const mounted = mountSwell();
    await mounted.router.navigate("/rsvp", { replace: true });

    await page.getByLabelText("Name").fill("Ada Lovelace");
    await page.getByLabelText("Email").fill("ada@example.com");
    await page.getByRole("button", { name: "Register" }).click();

    await expect.poll(() => mounted.backend.invocations.length).toBe(1);
    expect(mounted.backend.invocations[0]?.args).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      tier: "general",
    });
    await expect.poll(() => root?.textContent).toContain("This email is already registered.");
  });
});
