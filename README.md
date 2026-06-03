# WAVEx

WAVEx is a TypeScript-first framework experiment for `.wx` templates, Vite, Lit, Convex, Web Awesome, Font Awesome, and PostHog.

This workspace follows the implementation direction in `../docs/wavex-design.md` and user-facing syntax in `../docs/wavex-spec.md`.

## Default app shape

WAVEx uses one fixed Vite/Convex-aligned app shape:

```txt
src/pages/       file-based `.wx` routes
src/components/  reusable `.wx` components
convex/          Convex functions and schema
public/          Vite static assets
```

The Vite plugin and CLI treat those paths as framework law. Projects cannot override the page/component roots.

## Packages

- `wavex` — CLI entrypoint.
- `@wavex/core` — shared config, route/resource naming, and utility helpers.
- `@wavex/language-core` — `.wx` parse model and diagnostics.
- `@wavex/compiler` — `.wx` to Lit-backed render module compiler.
- `@wavex/runtime` — browser runtime primitives.
- `@wavex/renderer-lit` — Lit renderer adapter.
- `@wavex/vite-plugin` — Vite plugin for `.wx` modules and route metadata.

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm check
```
