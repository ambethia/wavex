# Agent Guidance for WAVEx

WAVEx is a TypeScript-first framework: `.wx` files compile to Lit. This is the WAVEx pnpm monorepo and git repository (`CLAUDE.md` is a symlink to this file).

## Project map

- `packages/` — `@wavex/core` (parser/AST/diagnostics + shared project model — the single source of truth for `.wx`), `@wavex/compiler`, `@wavex/runtime` (Lit renderer at `@wavex/runtime/lit`), `@wavex/vite-plugin`, the Volar-based `@wavex/lsp`, and the `wavex` CLI.
- `apps/todo/` — Convex-backed realtime TODO demo. `apps/swell/` — Swell Conf, the full-feature validation app.

## Documentation

Documentation lives in the code, not in a separate docs tree:

- **`.wx` language guides** — `packages/core/docs/*.md` is the authority on `.wx` syntax, directives, Convex references, and forms. Read the relevant guide before implementing or changing language behavior.
- **Design intent per package** — each `packages/*/README.md` plus the `@packageDocumentation` header in each package's entry module (architecture decisions, deferrals, open questions).
- **`using-wavex` agent skill** — `.agents/skills/using-wavex/` is the generated API + language reference (committed). Regenerate with `pnpm docs:skill` after changing TSDoc or guides; `pnpm check` includes a drift gate (`pnpm docs:check`) that fails when it's stale.

## Commands

- `pnpm check` at the repo root is the main gate: typecheck, tests, and the docs drift check.
- `pnpm build` builds all packages and the demo apps; `cd apps/todo && pnpm build` verifies just the app.
- `pnpm docs:skill` regenerates the `using-wavex` skill from TSDoc + guides.
- The workspace is standardized on Vite+ (`vp`); `vite`/`vitest` are overridden to Vite+ equivalents at the root.

## Working conventions

- Before implementing WAVEx behavior, read the relevant guide in `packages/core/docs/` and the affected package's README/module docs.
- Keep syntax changes synchronized across parser tests, compiler tests, the language guides, and demos — then run `pnpm docs:skill` and commit the regenerated skill.
- New exported APIs get TSDoc (the generated skill is only as good as the comments); design decisions go in the owning package's README or `@packageDocumentation` header, not a separate design doc.

## Agent skills

Shared agent skills live in `.agents/skills/` (`.claude/skills` is a symlink to it; `skills-lock.json` at the root tracks installed skills — run `npx skills update`/`check` from the repo root, not from an app directory).

- The `convex-*` skills are installed from `get-convex/agent-skills` and committed.
- `using-wavex` is generated from this repo's own source (`pnpm docs:skill`) and **committed** — it is first-party content.
- `using-webawesome` and `using-fontawesome` are generated locally from the vendors' docs sites and are **git-ignored on purpose**: the Web Awesome skill includes Pro-only docs that require a license and must never be committed or published. If they are missing locally, say so rather than answering from memory.

## UI work (Web Awesome / Font Awesome)

- The demo apps build UIs with Web Awesome components (`<wa-*>`) and Font Awesome icons, including Pro packages (registry auth via `.npmrc` env vars `FONTAWESOME_NPM_TOKEN` / `WEBAWESOME_NPM_TOKEN`).
- **Do not fabricate UI patterns from scratch with Web Awesome.** First check `.agents/skills/using-webawesome/patterns/` — categories: `app/`, `blog-news/`, `ecommerce/`, `layouts/`, indexed in `patterns.md` — and use a matching pattern directly or as the starting point/inspiration. Only design something novel when no pattern is close, and reuse the conventions (layout utilities, tokens, component composition) the patterns demonstrate.
- For component APIs, themes, and design tokens, read the relevant files in `.agents/skills/using-webawesome/` (`components/`, `tokens/`, `themes.md`, `layout.md`) instead of guessing attribute or token names.
- For icons, start from the catalog at `.agents/skills/using-fontawesome/docs/_catalog.md` and base answers on those local docs.
