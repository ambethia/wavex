# Swell Conf — Full-Feature Validation App

> Status: planned, not started. Do not begin implementation until the TODO app has exhausted what it can usefully highlight (roadmap slices 1–4, including the Web Awesome adoption pass). This app is the validation target for roadmap slices 5–9.

## Why this app

The TODO app proves the core loop: one page, one query resource, semantic form/click mutations. It cannot credibly exercise routing, layouts, content routes, suspense, actions, error handling, head management, or analytics without becoming contrived.

**Swell Conf** is a companion app for a small fictional one-day conference about realtime web apps. The category is real (every conference has one), the scope is bounded (one event, no multi-tenancy), and it naturally combines the two surfaces WAVEx exists to fuse:

- A **static, prerenderable marketing site**: landing page, speakers, venue/FAQ content.
- A **realtime app**: live Q&A with upvotes, announcements, a "happening now" board.

It requires no auth, no payments, and no file uploads for the core build, so it stays inside the MVP spec surface.

## App shape

```txt
src/pages/
  +layout.wx              # site shell: nav, announcement banner, footer
  +error.wx               # root error route
  index.wx                # landing page (static, prerender target)
  rsvp.wx                 # registration form + ticket tiers
  live.wx                 # happening-now board (realtime)
  schedule.wx             # full program, filterable by ?track=
  speakers/
    index.wx              # speaker grid
    [id].wx               # speaker detail
  talks/
    +layout.wx            # talks section shell (named slots)
    +error.wx             # talks-scoped error route
    [id].wx               # talk detail + live Q&A
  info/
    [...slug].wx          # venue, FAQ, code of conduct, travel (content pages)
src/components/
  site-nav.wx             # shadows nothing; custom handler :click:openMenu
  page-shell.wx           # named slot composition
  badge.wx                # intentionally shadows @wa/badge (lookup-order proof)
  talks/card.wx           # nested component path (@talks/card)
  speakers/card.wx
convex/
  talks.ts                # list, get, search
  speakers.ts             # list, get
  questions.ts            # listByTalk (paginated), create, upvote
  rsvps.ts                # create
  announcements.ts        # list
  ai/summarize.ts         # action (nested module path: $$ai/summarize:run)
  schema.ts, seed data
```

## Feature coverage map

Every spec feature gets a non-contrived home:

| Spec feature | Where it lives |
| --- | --- |
| Static, dynamic, catch-all routes | `/schedule`, `/talks/[id]`, `/info/[...slug]` |
| Query params | `/schedule?track=…` filter chips |
| Nested layouts + named slots | root `+layout.wx`, `talks/+layout.wx`, `@page-shell` with `slot:title` |
| `+error.wx` (root and scoped) | root + `talks/` |
| `+boundary` | around the AI summary widget on talk pages |
| Dynamic `+head` | talk/speaker pages (`title {{ talk.title }} | Swell Conf`, meta description from talk summary) |
| Prerender baseline | landing + `info/` content pages |
| `$$` query resources, `args:` | `$$talks:get args:{ id: route.params.id }` |
| Binding inference + `as:` collision | `/live` uses `$$talks:list as:upNext args:{ when: "next" }` alongside the full list |
| Singular/plural inference | `$$speakers:get` → `speaker`, `$$questions:listByTalk` → `questions` |
| Nested Convex module paths | `$$ai/summarize:run` |
| Paginated query | Q&A thread (`pagination` pattern) |
| Mutations via forms | RSVP form, ask-a-question form (named controls → args) |
| Mutations via clicks | question upvote |
| Actions + `+pending`/`+idle` | "Summarize this talk" AI button |
| `+loading` / `+empty` / `+error err` / `+mutation-error` | Q&A thread, schedule, search; upvote/RSVP failures |
| `+suspense reveal:together` | talk page combining `$$talks:get` + `$$questions:listByTalk` |
| `refresh:background` | `/live` board stays visible while refreshing |
| `+for` inferred + explicit `key:` | Convex docs infer `_id`; schedule time-slot groups use explicit `key:slot.slug` |
| Raw `on:` events | RSVP confirmation `@dialog on:wa-show:…`, question draft `on:input:updateDraft` |
| Custom non-Convex handlers | `:click:openMenu` mobile nav |
| `:track:` + implicit analytics | `:track:question_upvoted`, `:track:rsvp_submitted`; pageviews via routing (PostHog slice) |
| Local component shadowing + `@wa/` escape | `@badge` shadows Web Awesome; somewhere uses explicit `@wa/badge` |
| Utility shorthand | layout throughout (`[stack gap-xl]`, `[grid gap-m]`, `[cluster …]`) |
| Inline prose spans | `info/` content pages (heavy `` `code` ``/`*strong*`/`_em_`/`~mark~` use) |
| TS prelude | time-slot formatting, track grouping helpers, `Doc<"talks">` types |
| `@icon` incl. families | UI icons + brand icons for speaker social links (exercises FA Pro detection) |

Web Awesome patterns from `.agents/skills/using-webawesome/patterns/` map directly: `comments` (Q&A), `leaderboard` (top-voted questions), `empty-state`, `faq`, `pricing` (ticket tiers on `/rsvp`), `activity-log` (`/live`), `grid-list` (speakers), `pagination`, `description-list` (talk metadata), `action-panel`.

## What it intentionally does not need

- **Auth** — questions/RSVPs take a display-name/email field. (Stretch: add Convex auth later via the `convex-setup-auth` skill.)
- **Payments** — ticket tiers link out; no checkout.
- **`httpAction` / SSR beyond the prerender baseline** — per spec exclusions.

Stretch ideas once slices 5–9 land: presence ("12 people viewing"), a Convex scheduled function flipping talks to "live now", real LLM behind `ai/summarize`.

## Sequencing against the roadmap

The app is the forcing function for the post-TODO slices, in order:

1. Slice 5 (multi-route runtime): landing + schedule + talk detail navigation.
2. Slice 6 (components/layouts): site shell, section layouts, local components.
3. Slice 7 (head/prerender): dynamic talk metadata, prerendered info pages.
4. Slice 8 (WA/FA capability detection): Pro icons and patterns used here.
5. Slice 9 (boundaries/PostHog): Q&A error states, tracked events, pageviews.

Build it incrementally as each slice lands rather than all at once at the end — each slice's done criteria can point at a concrete Swell Conf screen.

## Alternatives considered

- **Live auction/marketplace** — excellent realtime story, but drags in payments/trust concerns and most of the app is one screen.
- **Surf-session log ("Swell" the tracker)** — on-theme, but single-user-ish and needs external data APIs to feel alive.
- **Helpdesk/shared inbox** — good shape, but needs auth and roles from day one, which the MVP spec excludes.
