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
- Targeted Vite HMR updates for `.wx` edits, so the client can hot swap a
  page/component render without losing Convex client state.
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

Vite+ integration for WAVEx apps: compiles `.wx` modules on demand, serves
the generated route table and bootstrap module, and drives HMR.

Vite+ is the primary dev/build substrate by design — it provides the module
graph, HMR, package integration, and production bundling so WAVEx only owns
what is WAVEx-specific: the file-convention route table
(`virtual:wavex/routes`), the bootstrap entry (`/@wavex/bootstrap`, which
renders the app directly under `<body>` with no framework mount div), and
`.wx` hot updates that preserve Convex client state across template edits.

The `@wavex/vite-plugin/client` subpath ships ambient module declarations
for `*.wx` imports; apps reference it from their tsconfig `types`.

## Interfaces

### WavexVitePluginOptions

Defined in: [packages/vite-plugin/src/index.ts:26](packages/vite-plugin/src/index.ts#L26)

Options for [wavex](#wavex).

#### Properties

##### viewTransitions?

```ts
optional viewTransitions?: boolean;
```

Defined in: [packages/vite-plugin/src/index.ts:33](packages/vite-plugin/src/index.ts#L33)

Wrap client navigations in `document.startViewTransition` (default true).
Skipped automatically when unsupported or under `prefers-reduced-motion`.

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: readonly string[];
```

Defined in: [packages/vite-plugin/src/index.ts:28](packages/vite-plugin/src/index.ts#L28)

Override the Web Awesome component set; by default it is detected from the installed package.

## Functions

### wavex()

```ts
function wavex(options?): Plugin;
```

Defined in: [packages/vite-plugin/src/index.ts:49](packages/vite-plugin/src/index.ts#L49)

The WAVEx Vite plugin. Compiles `.wx` files to Lit render modules on
demand, serves `virtual:wavex/routes` (the file-convention route table with
lazy per-route loaders, layouts, and error pages) and the
`/@wavex/bootstrap` entry, dedupes Lit, and sends targeted Vite HMR
updates for template edits so Convex client state survives `.wx` edits.

#### Parameters

##### options?

[`WavexVitePluginOptions`](#wavexvitepluginoptions) = `{}`

#### Returns

`Plugin`

## References

### default

Renames and re-exports [wavex](#wavex)
