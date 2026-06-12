import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  talks: defineTable({
    slug: v.string(),
    title: v.string(),
    speaker: v.string(),
    track: v.string(),
    startsAt: v.string(),
    summary: v.string()
  })
    .index("by_slug", ["slug"])
    .index("by_track", ["track"])
});
