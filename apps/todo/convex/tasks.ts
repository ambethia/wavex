import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").take(100);
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) throw new Error("Task text is required.");
    return await ctx.db.insert("tasks", { text, completed: false });
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    await ctx.db.patch(args.id, { completed: !task.completed });
    return args.id;
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const completedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_completed", (q) => q.eq("completed", true))
      .take(100);

    for (const task of completedTasks) {
      await ctx.db.delete(task._id);
    }

    return completedTasks.length;
  },
});
