# @wavex/vite-plugin

Vite+ integration for WAVEx apps.

The `wavex()` plugin compiles `.wx` files to Lit render modules on demand and
owns the WAVEx-specific dev/build surface:

- `virtual:wavex/routes` — the file-convention route table with lazy
  per-route loaders, layout chains, and `+error.wx` modules.
- `/@wavex/bootstrap` — the boot module. `index.html` carries no framework
  mount div; the bootstrap renders the app directly under `<body>` so the
  app's root element (conventionally `<wa-page>` from the root layout) is the
  first element in the body. Prerendered HTML emits the same shape.
- Standard Vite `js-update` HMR for `.wx` edits, so the client can hot swap a
  page/component render without losing Convex client state without inventing a
  WAVEx-specific HMR event protocol.
- Lit dedupe and Web Awesome dep-optimizer exclusions, so custom elements are
  served as native ESM and never registered twice.

The `@wavex/vite-plugin/client` subpath ships ambient `*.wx` module
declarations; apps reference it from tsconfig `types`.

## Design notes

- Vite+ is the primary substrate by design: module resolution, HMR, package
  integration, and production bundling are not WAVEx problems.
- **Open question:** the exact HMR contract for colocated TypeScript state
  preservation (snapshot/restore hooks) is not settled; today template edits
  preserve Convex state and prelude changes reload the module.
- **Deferral:** prerendering is the Tier-1 SEO/initial-load plan (see the
  `wavex` CLI); build-time Convex data and edge SSR are later tiers.
