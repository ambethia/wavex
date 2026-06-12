# GOAL.md Completion Report

> Date: 2026-06-12. All roadmap slices (1–10) complete and browser-validated per the
> real-browser validation protocol in `GOAL.md`. Browser evidence was gathered with
> Playwright-driven Chromium against live Convex dev deployments (the Claude-in-Chrome
> extension was unavailable in this environment); screenshots and per-suite logs land in
> `/tmp/wx-validation/` on each run.

## Final gate state

- `pnpm check`: 43/43 tests across core (parser, routing, capabilities), compiler,
  runtime (resources, actions, router), and the Volar LSP integration suite.
- `apps/todo` and `apps/swell` production builds pass; `wavex prerender` emits `/`
  and `/rsvp` for Swell with declarative shadow DOM, title, and meta.
- `wavex check` passes on both apps with capability summaries
  (`@web.awesome.me/webawesome-pro`, 82 components; FA kit detected).

## Browser-validated evidence per slice

| Slice | Suite | Result |
| --- | --- | --- |
| 3 — Convex TODO flow | CRUD + two-tab realtime + HMR | 14/14 + 3/3 |
| 4 — Web Awesome adoption | wa-page body root, custom elements, utilities, FormData, icons | in slice-4 suite (14/14) |
| 5 — Multi-route runtime | direct loads, client nav, query filters, params, catch-all, popstate, deep links | 12/12 |
| 6 — Components/layouts | layout persistence canary, local components, nested layout, layout HMR | 7/7 |
| 7 — Head/prerender | per-route titles/meta, resource-driven title, stale-meta removal, prerender boot | 5/5 |
| 8 — Capability detection | both apps on generated imports only; WX101 fixture fails check | re-ran suites green |
| 9 — Boundaries/PostHog | boundary catch, +error.wx route, intercepted capture endpoint events | 4/4 + 5/5 |
| 10 — Volar LSP | typed-template proven case, WX005 surfacing, completions, semantic tokens | in-process kit tests |
| Swell coverage map | speakers, as: collision, +suspense, Q&A realtime, AI action, RSVP, raw events | 12/12 |

## Definition-of-done checklist

1. **Slices 1–10 done criteria** — met; each slice's status block in `docs/roadmap.md`
   records what was validated and what was fixed along the way.
2. **TODO app fully Web Awesome** — no bespoke widget CSS (~35 lines of theming);
   two-tab realtime mutation loop and `.wx`-edit HMR with preserved Convex state proven.
3. **Swell Conf app** — built incrementally across slices 5–9 on its own Convex
   deployment; the feature-coverage map is demonstrated by working screens (deviations
   listed in `docs/validation-app.md`).
4. **Green gates at HEAD** — every commit in the run kept `pnpm check` and both builds
   passing.
5. **Docs synchronized** — roadmap statuses updated per slice; spec/design fixes landed
   with the code that motivated them.

## Bugs found by browser validation (would not have surfaced from unit tests alone)

- wa-checkbox's internal label double-fires `click`, double-toggling mutations →
  semantic `change` delegation.
- `href:/path` literals compiled as JS regex literals → URL-path literal rule.
- Lazy Web Awesome imports triggered mid-session dep re-optimization full reloads and
  duplicate custom-element registration → optimizeDeps exclusion.
- `{{ … }}` interpolations containing `:` parsed as attributes, emptying dynamic titles.
- Member-access brackets in directive expressions (`actionStates["…"]`) were stripped
  as utility groups.
- Action lifecycle states never rerendered the page (pending/error/result UI dead) →
  dispatch-wrapped rerenders.

## Known scope notes

- Prerender replaces (not hydrates) on boot, per the roadmap's output-optimization
  framing.
- The LSP baseline proves typed templates in-process; editor-distribution packaging and
  project-fed completion sets are follow-ups noted in the roadmap.
- Validation-app deviations (cursor pagination, dialog-vs-details raw-event demo) are
  recorded in `docs/validation-app.md`.
