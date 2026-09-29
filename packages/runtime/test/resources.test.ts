import { describe, expect, it } from "vitest";
import {
  createConvexResourceClient,
  createRenderContext,
  createResourceController,
  type ResourceClient,
  type ResourceSubscriptionHandlers
} from "../src/index.js";

class FakeResourceClient implements ResourceClient {
  subscriptions: Array<{
    definition: Parameters<ResourceClient["subscribe"]>[0];
    handlers: ResourceSubscriptionHandlers;
    disposed: boolean;
  }> = [];

  subscribe(definition: Parameters<ResourceClient["subscribe"]>[0], handlers: ResourceSubscriptionHandlers) {
    const subscription = { definition, handlers, disposed: false };
    this.subscriptions.push(subscription);
    return () => {
      subscription.disposed = true;
    };
  }
}

describe("resource controller", () => {
  it("subscribes to resources and writes updates into render context", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    const changes: string[] = [];

    const controller = createResourceController(
      context,
      [{ name: "tasks", modulePath: "tasks", functionName: "list", raw: "$$tasks:list" }],
      { client, onChange: () => changes.push("change") }
    );

    expect(context.resourceStates?.tasks?.status).toBe("loading");
    expect(client.subscriptions).toHaveLength(1);
    expect(client.subscriptions[0].definition).toMatchObject({
      name: "tasks",
      modulePath: "tasks",
      functionName: "list",
      args: {}
    });

    client.subscriptions[0].handlers.next([{ text: "Ship resources" }]);
    expect(context.resources?.tasks).toEqual([{ text: "Ship resources" }]);
    expect(context.resourceStates?.tasks).toMatchObject({ status: "ready", value: [{ text: "Ship resources" }] });
    expect(changes).toEqual(["change"]);

    controller.dispose();
    expect(client.subscriptions[0].disposed).toBe(true);
  });

  it("resubscribes when resource args change and clears removed resources", () => {
    const context = createRenderContext({ route: { path: "/", params: {}, query: { status: "open" } } });
    const client = new FakeResourceClient();
    const controller = createResourceController(
      context,
      [
        {
          name: "tasks",
          modulePath: "tasks",
          functionName: "list",
          getArgs: (ctx) => ({ status: ctx.route?.query.status })
        }
      ],
      { client }
    );

    expect(client.subscriptions[0].definition.args).toEqual({ status: "open" });

    context.route = { path: "/", params: {}, query: { status: "closed" } };
    controller.update();

    expect(client.subscriptions).toHaveLength(2);
    expect(client.subscriptions[0].disposed).toBe(true);
    expect(client.subscriptions[1].definition.args).toEqual({ status: "closed" });

    client.subscriptions[1].handlers.next(["done"]);
    expect(context.resources?.tasks).toEqual(["done"]);

    controller.update([]);
    expect(client.subscriptions[1].disposed).toBe(true);
    expect(context.resources?.tasks).toBeUndefined();
    expect(context.resourceStates?.tasks).toBeUndefined();
  });

  it("tracks resource errors", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    createResourceController(context, [{ name: "tasks", modulePath: "tasks", functionName: "list" }], { client });
    const error = new Error("nope");

    client.subscriptions[0].handlers.error(error);

    expect(context.resourceStates?.tasks).toMatchObject({ status: "error", error });
  });
});

describe("createConvexResourceClient", () => {
  it("resolves nested Convex API references and passes object args", () => {
    const queryRef = { ref: "deeply nested list" };
    const calls: Array<{ query: unknown; args: Record<string, unknown> }> = [];
    const client = createConvexResourceClient(
      {
        onUpdate(query, args, callback) {
          calls.push({ query, args });
          callback(["task"]);
          return () => undefined;
        }
      },
      { api: { deeply: { nested: { list: queryRef } } } }
    );
    const values: unknown[] = [];

    client.subscribe(
      { name: "tasks", modulePath: "deeply/nested", functionName: "list", kind: "query", args: { status: "open" } },
      { next: (value) => values.push(value), error: () => undefined }
    );

    expect(calls).toEqual([{ query: queryRef, args: { status: "open" } }]);
    expect(values).toEqual([["task"]]);
  });
});

describe("resource gates (+if conditions)", () => {
  it("subscribes only while the gate holds and clears the binding when it closes", () => {
    const context = createRenderContext({ state: { user: null as { id: string } | null } });
    const client = new FakeResourceClient();
    const changes: string[] = [];
    const controller = createResourceController(
      context,
      [{ name: "pledges", modulePath: "pledges", functionName: "list", when: (ctx) => Boolean(ctx.state?.user) }],
      { client, onChange: () => changes.push("change") }
    );

    expect(client.subscriptions).toHaveLength(0);
    expect(context.resourceStates?.pledges).toBeUndefined();

    context.state = { user: { id: "user-1" } };
    controller.update();
    expect(client.subscriptions).toHaveLength(1);
    expect(context.resourceStates?.pledges?.status).toBe("loading");
    client.subscriptions[0]!.handlers.next(["pledge"]);
    expect(context.resources?.pledges).toEqual(["pledge"]);

    context.state = { user: null };
    controller.update();
    expect(client.subscriptions[0]!.disposed).toBe(true);
    expect(context.resources).not.toHaveProperty("pledges");
    expect(context.resourceStates).not.toHaveProperty("pledges");

    // Reopening starts fresh instead of showing the signed-out value.
    context.state = { user: { id: "user-2" } };
    controller.update();
    expect(client.subscriptions).toHaveLength(2);
    expect(context.resourceStates?.pledges).toMatchObject({ status: "loading", value: undefined });
    expect(changes).toEqual(["change"]);
  });

  it("resolves args only while the gate is open, so they may rely on its narrowing", () => {
    const context = createRenderContext({ state: { detail: null as { id: string } | null } });
    const client = new FakeResourceClient();
    const controller = createResourceController(
      context,
      [
        {
          name: "pledgeDetail",
          modulePath: "pledges",
          functionName: "detail",
          when: (ctx) => Boolean(ctx.state?.detail),
          getArgs: (ctx) => ({ id: ctx.state!.detail.id })
        }
      ],
      { client }
    );

    expect(context.resourceStates).toEqual({});
    context.state = { detail: { id: "pledge-1" } };
    controller.update();
    context.state = { detail: { id: "pledge-2" } };
    controller.update();
    expect(client.subscriptions.map((subscription) => [subscription.definition.args, subscription.disposed])).toEqual([
      [{ id: "pledge-1" }, true],
      [{ id: "pledge-2" }, false]
    ]);
  });

  it("keeps a throwing gate or args visible as an error without requesting rerenders from update()", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    const changes: string[] = [];
    let fail = false;
    const controller = createResourceController(
      context,
      [
        {
          name: "talk",
          modulePath: "talks",
          functionName: "get",
          getArgs: () => {
            if (fail) throw new TypeError("Cannot read properties of null (reading 'slug')");
            return { slug: "keynote" };
          }
        },
        { name: "broken", modulePath: "talks", functionName: "list", when: () => { throw new Error("gate failed"); } }
      ],
      { client, onChange: () => changes.push("change") }
    );

    expect(context.resourceStates?.broken).toMatchObject({ status: "error", error: new Error("gate failed") });
    client.subscriptions[0]!.handlers.next({ title: "Keynote" });
    fail = true;
    controller.update();

    expect(client.subscriptions[0]!.disposed).toBe(true);
    expect(context.resourceStates?.talk).toMatchObject({ status: "error", value: { title: "Keynote" } });
    expect(String(context.resourceStates?.talk?.error)).toContain("reading 'slug'");
    expect(changes).toEqual(["change"]);
  });

  it("re-evaluates gates that read a binding cleared later in the same update", () => {
    const context = createRenderContext({ state: { open: true } });
    const client = new FakeResourceClient();
    const controller = createResourceController(
      context,
      [
        {
          name: "questions",
          modulePath: "questions",
          functionName: "listByTalk",
          when: (ctx) => Boolean(ctx.resources?.talk),
          getArgs: (ctx) => ({ talkSlug: (ctx.resources!.talk as { slug: string }).slug })
        },
        { name: "talk", modulePath: "talks", functionName: "get", when: (ctx) => Boolean(ctx.state?.open) }
      ],
      { client }
    );
    client.subscriptions[0]!.handlers.next({ slug: "keynote" });
    controller.update();
    expect(client.subscriptions.map((subscription) => subscription.definition.name)).toEqual(["talk", "questions"]);

    context.state = { open: false };
    controller.update();

    expect(client.subscriptions.every((subscription) => subscription.disposed)).toBe(true);
    expect(context.resources).toEqual({});
    expect(context.resourceStates).toEqual({});
  });

  it("ignores late values from a subscription replaced under the same key", () => {
    const context = createRenderContext({ route: { path: "/", params: {}, query: { status: "open" } } });
    const client = new FakeResourceClient();
    const controller = createResourceController(
      context,
      [{ name: "tasks", modulePath: "tasks", functionName: "list", getArgs: (ctx) => ({ status: ctx.route?.query.status }) }],
      { client }
    );
    context.route = { path: "/", params: {}, query: { status: "done" } };
    controller.update();
    context.route = { path: "/", params: {}, query: { status: "open" } };
    controller.update();

    const [firstOpen, , secondOpen] = client.subscriptions;
    firstOpen!.handlers.next(["stale open"]);
    expect(context.resources?.tasks).toBeUndefined();
    secondOpen!.handlers.next(["fresh open"]);
    expect(context.resources?.tasks).toEqual(["fresh open"]);
  });
});

describe("paginated resources", () => {
  const pledgeList = { name: "pledges", modulePath: "pledges", functionName: "list", raw: "$$pledges:list", pageSize: 2 } as const;
  const page = (items: string[], continueCursor: string, isDone = false) => ({ page: items, isDone, continueCursor });

  it("binds one page at a time and moves through the cursor stack", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    const changes: string[] = [];
    const controller = createResourceController(context, [pledgeList], { client, onChange: () => changes.push("change") });

    expect(client.subscriptions[0]!.definition.args).toEqual({ paginationOpts: { cursor: null, numItems: 2 } });
    expect(context.resourceStates?.pledges).toMatchObject({ status: "loading", hasPreviousPage: false, hasNextPage: false });

    client.subscriptions[0]!.handlers.next(page(["a", "b"], "after-b"));
    expect(context.resources?.pledges).toEqual(["a", "b"]);
    expect(context.resourceStates?.pledges).toMatchObject({ status: "ready", hasPreviousPage: false, hasNextPage: true });

    expect(controller.turnPage("pledges", "next")).toBe(true);
    expect(client.subscriptions[0]!.disposed).toBe(true);
    expect(client.subscriptions[1]!.definition.args).toEqual({ paginationOpts: { cursor: "after-b", numItems: 2 } });
    // The previous page stays visible while the next one loads; there is no next page to move to yet.
    expect(context.resourceStates?.pledges).toMatchObject({ status: "loading", value: ["a", "b"], hasPreviousPage: true, hasNextPage: false });
    expect(controller.turnPage("pledges", "next")).toBe(true);
    expect(client.subscriptions).toHaveLength(2);

    client.subscriptions[1]!.handlers.next(page(["c"], "end", true));
    expect(context.resources?.pledges).toEqual(["c"]);
    expect(context.resourceStates?.pledges).toMatchObject({ status: "ready", hasPreviousPage: true, hasNextPage: false });

    expect(controller.turnPage("pledges", "previous")).toBe(true);
    expect(client.subscriptions[2]!.definition.args).toEqual({ paginationOpts: { cursor: null, numItems: 2 } });
    // A late value from the page the user left does not overwrite the current one.
    client.subscriptions[1]!.handlers.next(page(["late"], "end", true));
    client.subscriptions[2]!.handlers.next(page(["a", "b"], "after-b"));
    expect(context.resources?.pledges).toEqual(["a", "b"]);
    expect(controller.turnPage("pledges", "previous")).toBe(true);
    expect(client.subscriptions).toHaveLength(3);
    expect(changes).toEqual(["change", "change", "change", "change", "change"]);

    expect(controller.turnPage("talks", "next")).toBe(false);
  });

  it("returns to the first page when args change or the gate closes", () => {
    const context = createRenderContext({ state: { signedIn: true, required: true } });
    const client = new FakeResourceClient();
    const controller = createResourceController(
      context,
      [
        {
          name: "surveys",
          modulePath: "work",
          functionName: "list",
          pageSize: 20,
          when: (ctx) => Boolean(ctx.state?.signedIn),
          getArgs: (ctx) => ({ required: ctx.state?.required })
        }
      ],
      { client }
    );
    client.subscriptions[0]!.handlers.next(page(["s1"], "c1"));
    controller.turnPage("surveys", "next");
    expect(client.subscriptions[1]!.definition.args).toEqual({ required: true, paginationOpts: { cursor: "c1", numItems: 20 } });

    context.state = { signedIn: true, required: false };
    controller.update();
    expect(client.subscriptions[2]!.definition.args).toEqual({ required: false, paginationOpts: { cursor: null, numItems: 20 } });
    expect(context.resourceStates?.surveys).toMatchObject({ hasPreviousPage: false });
    client.subscriptions[2]!.handlers.next(page(["o1"], "c2"));
    controller.turnPage("surveys", "next");

    context.state = { signedIn: false, required: false };
    controller.update();
    expect(controller.turnPage("surveys", "previous")).toBe(true);
    context.state = { signedIn: true, required: false };
    controller.update();
    expect(client.subscriptions.at(-1)!.definition.args).toEqual({ required: false, paginationOpts: { cursor: null, numItems: 20 } });
    expect(client.subscriptions.filter((subscription) => !subscription.disposed)).toHaveLength(1);
  });

  it("splits a page Convex could not read completely so its remaining items start the next page", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    const controller = createResourceController(context, [pledgeList], { client });
    client.subscriptions[0]!.handlers.next(page(["a", "b"], "after-b"));

    // The live first page grows until Convex reports it incomplete.
    client.subscriptions[0]!.handlers.next({ page: ["a", "a2"], isDone: false, continueCursor: "after-b", splitCursor: "after-a2", pageStatus: "SplitRequired" });
    expect(client.subscriptions[0]!.disposed).toBe(true);
    expect(client.subscriptions[1]!.definition.args).toEqual({ paginationOpts: { cursor: null, numItems: 2, endCursor: "after-a2" } });
    expect(context.resourceStates?.pledges).toMatchObject({ status: "loading", value: ["a", "b"], hasNextPage: false });

    client.subscriptions[1]!.handlers.next(page(["a", "a2"], "after-a2"));
    expect(context.resources?.pledges).toEqual(["a", "a2"]);
    controller.turnPage("pledges", "next");
    expect(client.subscriptions[2]!.definition.args).toEqual({ paginationOpts: { cursor: "after-a2", numItems: 2 } });

    // A split Convex cannot narrow further is an error, not a silently short page.
    client.subscriptions[2]!.handlers.next({ page: ["b"], isDone: false, continueCursor: "x", splitCursor: null, pageStatus: "SplitRequired" });
    expect(context.resourceStates?.pledges).toMatchObject({ status: "error", hasPreviousPage: true, hasNextPage: false });
    expect(String(context.resourceStates?.pledges?.error)).toContain("read too much data");
  });

  it("reports a non-paginated query result as an error", () => {
    const context = createRenderContext();
    const client = new FakeResourceClient();
    createResourceController(context, [pledgeList], { client });

    client.subscriptions[0]!.handlers.next(["a", "b"]);

    expect(context.resourceStates?.pledges).toMatchObject({ status: "error", hasNextPage: false });
    expect(String(context.resourceStates?.pledges?.error)).toContain("$$pledges:list has paginate:, so it must be a Convex paginated query");
  });
});
