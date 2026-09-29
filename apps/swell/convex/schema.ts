import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  talks: defineTable({
    slug: v.string(),
    title: v.string(),
    speaker: v.string(),
    track: v.string(),
    startsAt: v.string(),
    summary: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_track", ["track"]),

  speakers: defineTable({
    slug: v.string(),
    name: v.string(),
    bio: v.string(),
    company: v.string(),
  }).index("by_slug", ["slug"]),

  questions: defineTable({
    talkSlug: v.string(),
    author: v.string(),
    text: v.string(),
    votes: v.number(),
  }).index("by_talk_votes", ["talkSlug", "votes"]),

  rsvps: defineTable({
    name: v.string(),
    email: v.string(),
    tier: v.string(),
  }).index("by_email", ["email"]),
});
