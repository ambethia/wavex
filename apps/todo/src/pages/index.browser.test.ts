import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type {
  ActionClient,
  ResolvedActionDefinition,
  ResolvedResourceDefinition,
  ResourceClient,
  ResourceSubscriptionHandlers,
} from "@wavex/runtime";
import { mountLitPage, type LitMount } from "@wavex/runtime/lit";
import todoPage, { resources } from "./index.wx";

interface Todo {
  _id: string;
  text: string;
  completed: boolean;
}

class TodoTestBackend implements ResourceClient, ActionClient {
  private readonly subscribers = new Set<ResourceSubscriptionHandlers<unknown>>();
  private tasks: Todo[] = [];
  private nextId = 1;

  subscribe<T>(definition: ResolvedResourceDefinition, handlers: ResourceSubscriptionHandlers<T>) {
    if (`${definition.modulePath}:${definition.functionName}` !== "tasks:list") {
      throw new Error(`Unexpected test resource ${definition.modulePath}:${definition.functionName}`);
    }
    const subscriber = handlers as ResourceSubscriptionHandlers<unknown>;
    this.subscribers.add(subscriber);
    handlers.next(this.snapshot() as T);
    return () => this.subscribers.delete(subscriber);
  }

  async invoke(definition: ResolvedActionDefinition): Promise<unknown> {
    const args = definition.args as Record<string, string>;
    switch (`${definition.modulePath}:${definition.functionName}`) {
      case "tasks:create": {
        const task = { _id: `task-${this.nextId++}`, text: String(args.text).trim(), completed: false };
        this.tasks.unshift(task);
        this.publish();
        return task._id;
      }
      case "tasks:toggle": {
        const task = this.tasks.find((candidate) => candidate._id === args.id);
        if (task) task.completed = !task.completed;
        this.publish();
        return task?._id;
      }
      case "tasks:deleteTask": {
        this.tasks = this.tasks.filter((task) => task._id !== args.id);
        this.publish();
        return args.id;
      }
      default:
        throw new Error(`Unexpected test action ${definition.modulePath}:${definition.functionName}`);
    }
  }

  private snapshot(): Todo[] {
    return this.tasks.map((task) => ({ ...task }));
  }

  private publish(): void {
    const snapshot = this.snapshot();
    for (const subscriber of this.subscribers) subscriber.next(snapshot);
  }
}

let mount: LitMount | undefined;
let root: HTMLDivElement | undefined;

afterEach(() => {
  mount?.dispose();
  mount = undefined;
  root?.remove();
  root = undefined;
});

describe("WAVEx Todo browser flow", () => {
  it("creates, toggles, and deletes a task through compiled semantic events", async () => {
    root = document.createElement("div");
    document.body.append(root);
    const backend = new TodoTestBackend();
    mount = mountLitPage(root, { default: todoPage, resources }, {}, {
      resourceClient: backend,
      actionClient: backend,
      resolveActionKind: () => "mutation",
    });

    await expect.poll(() => root?.textContent).toContain("No todos yet");

    await page.getByLabelText("New todo").fill("Ship the alpha");
    await page.getByRole("button", { name: "Add todo" }).click();
    await expect.poll(() => root?.textContent).toContain("Ship the alpha");

    const checkboxControl = root.querySelector("wa-checkbox")?.shadowRoot?.querySelector<HTMLElement>('[part="control"]');
    expect(checkboxControl).toBeTruthy();
    await userEvent.click(checkboxControl!);
    await expect.poll(() => root?.querySelector(".todo-text")?.classList.contains("is-complete")).toBe(true);

    const deleteControl = root
      .querySelector('wa-button[aria-label="Delete todo"]')
      ?.shadowRoot?.querySelector<HTMLElement>("button");
    expect(deleteControl).toBeTruthy();
    await userEvent.click(deleteControl!);
    await expect.poll(() => root?.textContent).not.toContain("Ship the alpha");
    await expect.poll(() => root?.textContent).toContain("No todos yet");
  });
});
