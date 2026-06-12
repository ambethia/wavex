/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("tasks", () => {
  it("lists, creates, toggles, deletes, and clears completed tasks", async () => {
    const t = convexTest(schema, modules);

    expect(await t.query(api.tasks.list)).toEqual([]);

    const firstId = await t.mutation(api.tasks.create, { text: "  Eat breakfast  " });
    const secondId = await t.mutation(api.tasks.create, { text: "Ship WAVEx" });

    let tasks = await t.query(api.tasks.list);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ _id: secondId, text: "Ship WAVEx", completed: false });
    expect(tasks[1]).toMatchObject({ _id: firstId, text: "Eat breakfast", completed: false });

    await t.mutation(api.tasks.toggle, { id: firstId });
    tasks = await t.query(api.tasks.list);
    expect(tasks.find((task) => task._id === firstId)).toMatchObject({ completed: true });

    await t.mutation(api.tasks.deleteTask, { id: secondId });
    tasks = await t.query(api.tasks.list);
    expect(tasks.map((task) => task._id)).toEqual([firstId]);

    await t.mutation(api.tasks.clearCompleted);
    expect(await t.query(api.tasks.list)).toEqual([]);
  });
});
