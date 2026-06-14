# WAVEx

WAVEx (pronounced *wave-ex*, template files `.wx`, visual mark `~x`) is a
personal, opinionated, TypeScript-first framework for browser-based realtime
apps: **Convex** as the backend/realtime layer, **Web Awesome** as the UI
system, **Font Awesome** for icons (Pro supported when apps bring their own
licensed packages), **PostHog** analytics, and `.wx` templates that compile to
Lit render modules on a Vite+ substrate.

## Core principles

1. **Lean hard into web standards** — HTML, custom elements, forms, slots,
   events, History API; native primitives stay meaningful.
2. **The template is the declaration** — routes, components, icons, queries,
   mutations, and assets are inferred from files and templates.
3. **Client-side by default, realtime after boot** — prerender useful HTML for
   SEO/initial load; hydrate; then start Convex subscriptions.
4. **Opinionated app graph, not generic JS framework soup** — no React/Svelte/
   Vue and no arbitrary frontend npm deps as first-class primitives.
5. **Composable but explicit** — lexical scope, slots, attributes, custom
   events, and explicit directives over provider soup.
6. **Build only what is WAVEx-specific** — the novel pieces are the `.wx` →
   Lit compiler and the Convex/Web Awesome/Font Awesome capability inference;
   stand on the Lit ecosystem (and Vite+) for the rest.
7. **Capability-based, BYO license** — the committed workspace uses public
   packages; Pro packages unlock Pro surfaces only when an app deliberately
   adds its own licensed dependencies. WAVEx never bundles licensed assets, so
   it stays open-sourceable.

## Architecture

```txt
.wx files
  -> @wavex/vite-plugin (compile on demand, routes, bootstrap, HMR)
  -> @wavex/compiler    (.wx -> Lit render module; no neutral IR)
  -> @wavex/runtime     (routing, resources, actions, head, analytics)
  -> @wavex/runtime/lit (Lit DOM patching, keyed lists)
  -> Web Awesome custom elements + official Convex browser client + PostHog
```

Hard constraints: Convex is the backend; Web Awesome / Font Awesome are
first-class with Pro detected from installed packages; static asset hosting is
enough to deploy. Explicit non-goals: full SSR infrastructure (prerender is
the Tier-1 plan), Zig/WASM runtimes, full Markdown, arbitrary frontend deps.

## App shape

One fixed Vite/Convex-aligned layout — framework law, not configuration:

```txt
src/pages/       file-based `.wx` routes (+layout.wx, +error.wx)
src/components/  reusable `.wx` components
convex/          Convex functions and schema
public/          static assets
```

## Documentation

- **`.wx` language guides** — `packages/core/docs/` (the authority on syntax,
  directives, Convex references, forms).
- **Generated reference** — the `using-wavex` agent skill at
  `.agents/skills/using-wavex/` is generated from TSDoc + the guides
  (`pnpm docs:skill`; `pnpm check` fails if it drifts).
- **Per-package design intent** — each `packages/*/README.md` and the
  `@packageDocumentation` headers in each entry module.

## Packages

- `wavex` — CLI (`check`, `routes`, `compile`, `dev`, `build`, `prerender`).
- `@wavex/core` — `.wx` parser/AST/diagnostics + shared project model; the
  single source of truth for the language. Capabilities at
  `@wavex/core/capabilities`.
- `@wavex/compiler` — `.wx` → Lit render module compiler.
- `@wavex/runtime` — browser runtime; Lit renderer at `@wavex/runtime/lit`.
- `@wavex/vite-plugin` — Vite+ integration (`./client` ships `*.wx` ambient
  types).
- `@wavex/lsp` — Volar-based language server over the `@wavex/core` parser.

## Apps

- `apps/todo` — Convex-backed realtime TODO demo (resources, semantic
  mutation events, HMR).
- `apps/swell` — Swell Conf, the full-feature validation app covering the
  language surface across realistic screens.

## Installation and optional commercial packages

A fresh clone installs without Font Awesome or Web Awesome commercial registry
tokens:

```sh
pnpm install
```

The demo apps depend on the public `@awesome.me/webawesome` package and the
free icons bundled with Web Awesome. Do not add personal Font Awesome kit
packages such as `@awesome.me/kit-*` to committed app manifests. If an app needs
Web Awesome Pro or a Font Awesome Pro kit, use your own license, keep registry
authentication in your user-level npm config or environment, and document the
app-specific dependency change alongside that app.

## Commands

```sh
pnpm install
pnpm build        # build all packages and apps
pnpm check        # typecheck + tests + docs drift gate
pnpm docs:skill   # regenerate the using-wavex skill from source
```
