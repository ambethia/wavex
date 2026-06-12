import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("speakers").collect();
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("speakers")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

const SPEAKERS = [
  { slug: "mara-lin", name: "Mara Lin", company: "Driftwave", bio: "Mara builds realtime collaboration infrastructure and thinks websockets are still underrated." },
  { slug: "theo-okafor", name: "Theo Okafor", company: "Lit Labs (community)", bio: "Theo maintains template-compiler tooling and has strong opinions about reconcilers." },
  { slug: "suki-tanaka", name: "Suki Tanaka", company: "Indent.dev", bio: "Suki has shipped four indentation-based languages and regrets none of them." },
  { slug: "dana-reyes", name: "Dana Reyes", company: "Convex", bio: "Dana works on reactive database subscriptions and consistency models." },
];

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("speakers").collect();
    if (existing.length > 0) return { seeded: 0 };
    for (const speaker of SPEAKERS) await ctx.db.insert("speakers", speaker);
    return { seeded: SPEAKERS.length };
  },
});
