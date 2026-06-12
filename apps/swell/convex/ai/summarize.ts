import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

/**
 * A nested-module Convex action ($$ai/summarize:run). Stands in for an LLM
 * call; actions are the right place for external fetches.
 */
export const run = action({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const talk = await ctx.runQuery(api.talks.get, { slug: args.slug });
    if (!talk) throw new Error(`No talk found for "${args.slug}"`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const words = talk.summary.split(/\s+/);
    return `tl;dr: ${words.slice(0, 8).join(" ")}… — ${talk.speaker} at ${talk.startsAt} (${talk.track} track)`;
  },
});
