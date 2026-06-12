# WAVEx Completion Goal

Drive `docs/roadmap.md` and both demo apps to completion, end to end, working autonomously slice by slice. Work is not done until it has been validated in a real browser against a live Convex deployment.

## Definition of done

All of the following, verified — not assumed:

1. Every roadmap slice (1–10 in `docs/roadmap.md`) meets its written done criteria, including slice 4 (Web Awesome adoption in the TODO app) and slice 10 (Volar LSP baseline).
2. `apps/todo` is fully Web Awesome (no bespoke widget CSS), and its realtime CRUD loop is proven in a real browser: two tabs open, a mutation in one updates the other without reload; HMR preserves Convex state across a `.wx` edit.
3. The Swell Conf app (`docs/validation-app.md`) exists as an app in `apps/`, built incrementally as slices 5–9 land. Every row of its feature-coverage map is demonstrated by a working screen, browser-validated.
4. `pnpm check` and every app's `pnpm build` pass at HEAD on every commit.
5. The roadmap and docs are updated as slices land; spec, design doc, parser tests, and demos stay synchronized when syntax changes (e.g., the dash-form utility decision enforced in slice 4).

## Operating loop

Each iteration:

1. Read `docs/roadmap.md`. Pick the earliest slice whose done criteria are not met. Slice 10 (LSP) is not gated on 5–9 — interleave it when other work is blocked.
2. Re-read the relevant sections of `docs/wavex-spec.md`, `docs/wavex-design.md`, and `docs/validation-app.md` before implementing.
3. Implement in small, testable steps. Per the roadmap working rules, prefer runtime abstractions testable with fake clients before requiring a live deployment.
4. Run the gates: `pnpm check` at the root, `cd apps/todo && pnpm build` (plus the Swell app's build once it exists).
5. Browser-validate anything user-visible (protocol below) before calling the step done.
6. Update the roadmap (status lines, done criteria) and any affected docs.
7. Commit with a focused message. A slice may span several commits, but never commit failing gates.
8. Repeat. When the definition of done is fully met, run one final end-to-end validation pass over both apps and write a completion report summarizing evidence per slice.

## Real-browser validation protocol

Builds and unit tests are necessary but never sufficient. For each user-visible change:

- Run `npx convex dev` and the app dev server in the background; drive a real Chrome tab (Claude-in-Chrome tools, or the `/verify` / `/run` skills).
- **Realtime:** two tabs; mutate in one; confirm the other updates live.
- **Routes:** visit every route, including dynamic (`/talks/[id]`) and catch-all (`/info/[...slug]`) once they exist; confirm direct-load and client-navigation both work.
- **States:** exercise `+loading`, `+empty`, `+error`, and `+pending` (simulate failures — e.g., stop `convex dev` or use an invalid arg — don't just verify the happy path).
- **Forms:** submit valid and invalid input; confirm mutation args, pending UI, and error UI.
- **Head:** confirm `document.title`/meta change per route; for prerendered routes, check the built HTML output itself.
- **HMR:** edit a `.wx` file mid-session; confirm the page updates without losing Convex client state.
- Capture a screenshot or GIF per validated flow and record what was checked (a short validation log per slice is fine, in the commit message or roadmap).

If browser validation cannot run (no deployment, no browser access), the work is **not done** — record why and move on; never claim validation that didn't happen.

## Guardrails

- Follow `AGENTS.md`: start UI work from `.agents/skills/using-webawesome/patterns/` instead of fabricating markup; never commit the git-ignored `using-webawesome` / `using-fontawesome` skills or any Pro-licensed assets.
- The `@wavex/core` TypeScript parser is the only `.wx` grammar; do not reintroduce Tree-sitter. The LSP is Volar-based.
- Reuse the Lit ecosystem before hand-rolling (`@lit/task`, `@lit-labs/router`, `@lit/context`, `@lit-labs/ssr`), per the design doc.
- Stay inside the documented scope. If the spec is ambiguous, make the smallest spec-consistent decision, record it in the relevant doc in the same commit, and continue.
- Respect the roadmap's explicit deferrals (no SSR beyond the prerender baseline, no Zig/WASM, no per-editor extensions beyond the LSP baseline).

## Blockers

When blocked on something only a human can provide — a new Convex deployment for the Swell app, registry tokens (`FONTAWESOME_NPM_TOKEN` / `WEBAWESOME_NPM_TOKEN`), license questions — add a `## Blocked` note at the top of `docs/roadmap.md` naming exactly what is needed, switch to unblocked work (slice 10 is usually available), and surface the blocker prominently in the session summary.
