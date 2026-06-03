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
