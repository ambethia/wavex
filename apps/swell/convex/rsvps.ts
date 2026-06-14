import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string(), email: v.string(), tier: v.string() },
  handler: async (ctx, args) => {
    if (!args.email.includes("@")) throw new Error("A valid email is required.");
    const existing = await ctx.db
      .query("rsvps")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new Error("This email is already registered.");
    return await ctx.db.insert("rsvps", {
      name: args.name.trim(),
      email: args.email.trim(),
      tier: args.tier,
    });
  },
});
