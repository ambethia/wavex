# Agent Guidance for WAVEx

WAVEx is a TypeScript-first framework: `.wx` files compile to Lit. This is the WAVEx pnpm monorepo and git repository (`CLAUDE.md` is a symlink to this file).

## Project map

- `docs/` — design/spec/roadmap notes for WAVEx.
  - `docs/wavex-spec.md` — user-facing `.wx` syntax and app model.
  - `docs/wavex-design.md` — architecture/design decisions and MVP sequence.
  - `docs/roadmap.md` — concrete implementation roadmap and current next slices.
- `packages/` — `@wavex/core` (parser/AST/diagnostics + shared project model — the single source of truth for `.wx`), `@wavex/compiler`, `@wavex/runtime` (Lit renderer at `@wavex/runtime/lit`), `@wavex/vite-plugin`, and the `wavex` CLI. A Volar-based `@wavex/lsp` is planned.
- `apps/todo/` — WAVEx TODO demo app. Currently the main proving ground for Convex-backed resources/mutations.

## Commands

- `pnpm check` at the repo root is the main typecheck/test gate.
- `pnpm build` builds all packages and the demo app; `cd apps/todo && pnpm build` verifies just the app.
- The workspace is standardized on Vite+ (`vp`); `vite`/`vitest` are overridden to Vite+ equivalents at the root.

## Working conventions

- Before implementing WAVEx behavior, read the relevant docs in `docs/`, especially `docs/wavex-spec.md`, `docs/wavex-design.md`, and `docs/roadmap.md`.
- Keep syntax changes synchronized across parser tests, compiler tests, docs, and demos.
- The current roadmap priority is the Convex-backed TODO milestone: resource bridge, mutation/form bridge, and proving the demo app loop end to end.

## Agent skills

Shared agent skills live in `.agents/skills/` (`.claude/skills` is a symlink to it; `skills-lock.json` at the root tracks installed skills — run `npx skills update`/`check` from the repo root, not from an app directory).

- The `convex-*` skills are installed from `get-convex/agent-skills` and committed.
- `using-webawesome` and `using-fontawesome` are generated locally from the vendors' docs sites and are **git-ignored on purpose**: the Web Awesome skill includes Pro-only docs that require a license and must never be committed or published. If they are missing locally, say so rather than answering from memory.

## UI work (Web Awesome / Font Awesome)

- The demo apps build UIs with Web Awesome components (`<wa-*>`) and Font Awesome icons, including Pro packages (registry auth via `.npmrc` env vars `FONTAWESOME_NPM_TOKEN` / `WEBAWESOME_NPM_TOKEN`).
- **Do not fabricate UI patterns from scratch with Web Awesome.** First check `.agents/skills/using-webawesome/patterns/` — categories: `app/`, `blog-news/`, `ecommerce/`, `layouts/`, indexed in `patterns.md` — and use a matching pattern directly or as the starting point/inspiration. Only design something novel when no pattern is close, and reuse the conventions (layout utilities, tokens, component composition) the patterns demonstrate.
- For component APIs, themes, and design tokens, read the relevant files in `.agents/skills/using-webawesome/` (`components/`, `tokens/`, `themes.md`, `layout.md`) instead of guessing attribute or token names.
- For icons, start from the catalog at `.agents/skills/using-fontawesome/docs/_catalog.md` and base answers on those local docs.
