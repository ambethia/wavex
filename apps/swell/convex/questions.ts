import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByTalk = query({
  args: { talkSlug: v.string() },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_talk", (q) => q.eq("talkSlug", args.talkSlug))
      .collect();
    return questions.sort((a, b) => b.votes - a.votes);
  },
});

export const create = mutation({
  args: { talkSlug: v.string(), author: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    if (args.text.trim().length === 0) throw new Error("Question text is required.");
    return await ctx.db.insert("questions", {
      talkSlug: args.talkSlug,
      author: args.author.trim() || "Anonymous",
      text: args.text.trim(),
      votes: 0,
    });
  },
});

export const upvote = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.id);
    if (!question) throw new Error("Question not found.");
    await ctx.db.patch(args.id, { votes: question.votes + 1 });
  },
});
