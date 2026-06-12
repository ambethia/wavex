import { describe, expect, it } from "vitest";
import {
  createConvexActionClient,
  createRenderContext,
  createSemanticActionDispatcher,
  type ActionClient,
  type ResolvedActionDefinition,
  type WavexActionEvent
} from "../src/index.js";

function fakeActionEvent(input: {
  target: string;
  type?: string;
  element?: Partial<Element> & { args?: unknown };
  preventDefault?: () => void;
}): WavexActionEvent {
  const context = createRenderContext();
  const element = {
    getAttributeNames: () => [],
    getAttribute: () => null,
    ...input.element
  } as Element;

  return {
    type: input.type ?? "click",
    target: input.target,
    event: { preventDefault: input.preventDefault, target: element } as Event,
    element,
    context
  };
}

describe("semantic action dispatcher", () => {
  it("invokes Convex mutation targets with data-* args and tracks pending/idle state", async () => {
    let resolveMutation!: (value: unknown) => void;
    const mutationPromise = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    const calls: ResolvedActionDefinition[] = [];
    const client: ActionClient = {
      async invoke(definition) {
        calls.push(definition);
        return mutationPromise;
      }
    };
    const event = fakeActionEvent({
      target: "$$tasks:toggle",
      element: {
        getAttributeNames: () => ["data-id", "data-wx-click"],
        getAttribute: (name) => (name === "data-id" ? "task-1" : name === "data-wx-click" ? "$$tasks:toggle" : null)
      }
    });
    const dispatch = createSemanticActionDispatcher(event.context, { actionClient: client });

    const dispatched = dispatch(event);

    expect(calls).toMatchObject([
      { target: "$$tasks:toggle", modulePath: "tasks", functionName: "toggle", kind: "mutation", args: { id: "task-1" } }
    ]);
    expect(event.context.actionStates?.["$$tasks:toggle"]).toMatchObject({ status: "pending", pending: true });

    resolveMutation({ ok: true });
    await dispatched;

    expect(event.context.actionStates?.["$$tasks:toggle"]).toMatchObject({
      status: "idle",
      pending: false,
      result: { ok: true }
    });
  });

  it("dispatches change-type semantic events (e.g. wa-checkbox :change:) to mutations", async () => {
    const calls: ResolvedActionDefinition[] = [];
    const client: ActionClient = {
      async invoke(definition) {
        calls.push(definition);
        return undefined;
      }
    };
    const event = fakeActionEvent({
      target: "$$tasks:toggle",
      type: "change",
      element: {
        getAttributeNames: () => ["data-id", "data-wx-change"],
        getAttribute: (name) => (name === "data-id" ? "task-9" : name === "data-wx-change" ? "$$tasks:toggle" : null)
      }
    });
    const dispatch = createSemanticActionDispatcher(event.context, { actionClient: client });

    await dispatch(event);

    expect(calls).toMatchObject([
      { target: "$$tasks:toggle", kind: "mutation", args: { id: "task-9" } }
    ]);
  });

  it("prevents default submit navigation and stores errors", async () => {
    const error = new Error("mutation failed");
    let prevented = false;
    const event = fakeActionEvent({
      type: "submit",
      target: "$$tasks:create",
      preventDefault: () => {
        prevented = true;
      }
    });
    const dispatch = createSemanticActionDispatcher(event.context, {
      actionClient: { invoke: async () => Promise.reject(error) }
    });

    await dispatch(event);

    expect(prevented).toBe(true);
    expect(event.context.actionStates?.["$$tasks:create"]).toMatchObject({
      status: "error",
      pending: false,
      error
    });
  });

  it("delegates non-Convex targets to custom dispatch", async () => {
    const customTargets: string[] = [];
    const event = fakeActionEvent({ target: "reset" });
    const dispatch = createSemanticActionDispatcher(event.context, {
      dispatch: (action) => customTargets.push(action.target)
    });

    await dispatch(event);

    expect(customTargets).toEqual(["reset"]);
  });

  it("normalizes colon-delimited nested Convex targets", async () => {
    const calls: ResolvedActionDefinition[] = [];
    const event = fakeActionEvent({ target: "$$deeply:nested:complete" });
    const dispatch = createSemanticActionDispatcher(event.context, {
      actionClient: { invoke: async (definition) => calls.push(definition) }
    });

    await dispatch(event);

    expect(calls).toMatchObject([{ modulePath: "deeply/nested", functionName: "complete" }]);
  });
});

describe("createConvexActionClient", () => {
  it("routes mutations and actions through the matching Convex client methods", async () => {
    const mutationRef = { ref: "mutation" };
    const actionRef = { ref: "action" };
    const calls: Array<{ method: string; reference: unknown; args: Record<string, unknown> }> = [];
    const client = createConvexActionClient(
      {
        async mutation(reference, args) {
          calls.push({ method: "mutation", reference, args });
          return "mutated";
        },
        async action(reference, args) {
          calls.push({ method: "action", reference, args });
          return "acted";
        }
      },
      { api: { tasks: { create: mutationRef }, ai: { summarize: actionRef } } }
    );

    await expect(
      client.invoke({ target: "$$tasks:create", modulePath: "tasks", functionName: "create", kind: "mutation", args: { text: "x" } })
    ).resolves.toBe("mutated");
    await expect(
      client.invoke({ target: "$$ai:summarize", modulePath: "ai", functionName: "summarize", kind: "action", args: { id: "1" } })
    ).resolves.toBe("acted");

    expect(calls).toEqual([
      { method: "mutation", reference: mutationRef, args: { text: "x" } },
      { method: "action", reference: actionRef, args: { id: "1" } }
    ]);
  });
});
