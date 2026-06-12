# Agent Guidance for WAVEx Workspace

This directory is a coordination workspace, not a single git repository. The root currently has no `.git` directory, so run git commands inside the nested repos when needed.

## Project map

- `docs/` — root-level design/spec/roadmap notes for WAVEx. These files are outside the nested git repos.
  - `docs/wavex-spec.md` — user-facing `.wx` syntax and app model.
  - `docs/wavex-design.md` — architecture/design decisions and MVP sequence.
  - `docs/roadmap.md` — concrete implementation roadmap and current next slices.
- `wavex/` — main WAVEx TypeScript/pnpm monorepo and git repository.
  - Packages: `@wavex/core` (parser/AST/diagnostics + shared project model — the single source of truth for `.wx`), `@wavex/compiler`, `@wavex/runtime` (Lit renderer at `@wavex/runtime/lit`), `@wavex/vite-plugin`, and the `wavex` CLI. A Volar-based `@wavex/lsp` is planned.
  - Use `cd wavex && pnpm check` for the main typecheck/test gate.
- `wavex/apps/todo/` — WAVEx TODO demo app, part of the `wavex` monorepo (`apps/*` workspace).
  - Currently the main proving ground for Convex-backed resources/mutations.
  - Use `cd wavex/apps/todo && pnpm build` to verify production build (also runs as part of `cd wavex && pnpm build`).
- `todo/` — superseded standalone copy of the demo app (old separate git repository). Do not edit; pending deletion.

## Working conventions

- Before implementing WAVEx behavior, read the relevant docs in `docs/`, especially `docs/wavex-spec.md`, `docs/wavex-design.md`, and `docs/roadmap.md`.
- Do not expect root-level `git status`, `git diff`, or commits to work at this coordination root. Git lives in `wavex/`.
- Run package-manager commands from `wavex/`; the demo app is part of that pnpm workspace.
- Keep syntax changes synchronized across parser tests, compiler tests, docs, and demos.
- The current roadmap priority is the Convex-backed TODO milestone: resource bridge, mutation/form bridge, and proving the demo app loop end to end.
