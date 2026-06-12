import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { track: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.track) {
      return await ctx.db
        .query("talks")
        .withIndex("by_track", (q) => q.eq("track", args.track!))
        .collect();
    }
    return await ctx.db.query("talks").collect();
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

const PROGRAM = [
  {
    slug: "realtime-by-default",
    title: "Realtime by Default",
    speaker: "Mara Lin",
    track: "systems",
    startsAt: "09:30",
    summary:
      "Why realtime should be the baseline for web apps, and what it costs to retrofit it later.",
  },
  {
    slug: "compile-to-lit",
    title: "Compile to Lit, Stand on Giants",
    speaker: "Theo Okafor",
    track: "frameworks",
    startsAt: "10:30",
    summary:
      "Building a template language that compiles to lit-html instead of writing yet another reconciler.",
  },
  {
    slug: "indentation-matters",
    title: "Indentation Matters",
    speaker: "Suki Tanaka",
    track: "frameworks",
    startsAt: "11:30",
    summary: "The ergonomics of indentation-based template syntax, from Haml to today.",
  },
  {
    slug: "convex-under-the-hood",
    title: "Convex Under the Hood",
    speaker: "Dana Reyes",
    track: "systems",
    startsAt: "13:30",
    summary: "Subscriptions, OCC, and the consistency model behind reactive backend queries.",
  },
];

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("talks").collect();
    if (existing.length > 0) return { seeded: 0, existing: existing.length };
    for (const talk of PROGRAM) await ctx.db.insert("talks", talk);
    return { seeded: PROGRAM.length, existing: 0 };
  },
});
