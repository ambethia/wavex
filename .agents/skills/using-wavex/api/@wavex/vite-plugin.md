# @wavex/vite-plugin

Vite+ integration for WAVEx apps.

The `wavex()` plugin compiles `.wx` files to Lit render modules on demand and
owns the WAVEx-specific dev/build surface:

- `virtual:wavex/routes` — the file-convention route table with lazy
  per-route loaders, layout chains, and `+error.wx` modules.
- `virtual:wavex/manifest` — importable, typed build metadata: discovered
  Convex mutation/action kinds, their resolver, and the configured View
  Transition default. Custom entries use this instead of duplicating plugin
  discovery logic.
- `/@wavex/bootstrap` — the boot module. `index.html` carries no framework
  mount div; the bootstrap renders the app directly under `<body>` so the
  app's root element (conventionally `<wa-page>` from the root layout) is the
  first element in the body. Prerendered HTML emits the same shape.
- Standard Vite `js-update` HMR for `.wx` edits, allowing page/component render
  hot swaps to preserve Convex client state without inventing a WAVEx-specific
  HMR event protocol.
- Lit dedupe and Web Awesome dep-optimizer exclusions, so custom elements are
  served as native ESM and never registered twice.

The `@wavex/vite-plugin/client` subpath ships ambient `*.wx` module
declarations plus types for both virtual modules; apps reference it from
tsconfig `types`.

## App-owned entry modules

The default bootstrap remains the zero-configuration path. An app that owns
authentication or another startup lifecycle can instead point the module
script in `index.html` at `/src/main.ts` and compose the same runtime pieces:

```ts
import "./style.css";
import { ConvexClient } from "convex/browser";
import {
  createConvexActionClient,
  createConvexResourceClient
} from "@wavex/runtime";
import { mountLitApp } from "@wavex/runtime/lit";
import routes from "virtual:wavex/routes";
import { resolveActionKind, viewTransitions } from "virtual:wavex/manifest";
import { api } from "../convex/_generated/api";
import { session } from "./auth/session";

document.querySelector("[data-wx-prerender]")?.remove();

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);
convex.setAuth(({ forceRefreshToken }) =>
  session.fetchConvexToken({ forceRefreshToken })
);

const app = mountLitApp({
  root: document.body,
  routes,
  initialContext: { state: { auth: session.current } },
  resourceClient: createConvexResourceClient(convex, { api }),
  actionClient: createConvexActionClient(convex, { api }),
  resolveActionKind,
  viewTransitions,
  onDispose: () => {
    unsubscribeAuth();
    void convex.close();
  }
});

const unsubscribeAuth = session.subscribe((auth) => {
  app.update({ state: { ...app.mount.context.state, auth } });
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
```

Here `session` is deliberately an app API: it can be backed by passkeys,
one-time codes, cookies, or anything else. WAVEx only carries `state.auth` into
templates and rerenders when the app replaces it. Convex authentication stays
at the official `ConvexClient.setAuth` boundary; authorization remains a
backend concern.

## Design notes

- Vite+ is the primary substrate by design: module resolution, HMR, package
  integration, and production bundling are not WAVEx problems.
- **Open question:** the exact HMR contract for colocated TypeScript state
  preservation (snapshot/restore hooks) is not settled; today template edits
  preserve Convex state and prelude changes reload the module.
- **Deferral:** prerendering is a static HTML optimization for resource-free
  routes (see the `wavex` CLI); build-time Convex data and edge SSR are later
  tiers.

Vite+ integration for WAVEx apps: compiles `.wx` modules on demand, serves
the generated route table and bootstrap module, and drives HMR.

Vite+ is the primary dev/build substrate by design — it provides the module
graph, HMR, package integration, and production bundling so WAVEx only owns
what is WAVEx-specific: the file-convention route table
(`virtual:wavex/routes`), generated app metadata
(`virtual:wavex/manifest`), the bootstrap entry (`/@wavex/bootstrap`, which
renders the app directly under `<body>` with no framework mount div), and
`.wx` hot updates that preserve Convex client state across template edits.

The `@wavex/vite-plugin/client` subpath ships ambient module declarations
for `*.wx` imports; apps reference it from their tsconfig `types`.

## Interfaces

### WavexVitePluginOptions

Defined in: [packages/vite-plugin/src/index.ts:27](packages/vite-plugin/src/index.ts#L27)

Options for [wavex](#wavex).

#### Properties

##### viewTransitions?

```ts
optional viewTransitions?: boolean;
```

Defined in: [packages/vite-plugin/src/index.ts:34](packages/vite-plugin/src/index.ts#L34)

Wrap client navigations in `document.startViewTransition` (default true).
Skipped automatically when unsupported or under `prefers-reduced-motion`.

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: readonly string[];
```

Defined in: [packages/vite-plugin/src/index.ts:29](packages/vite-plugin/src/index.ts#L29)

Override the Web Awesome component set; by default it is detected from the installed package.

## Functions

### wavex()

```ts
function wavex(options?): Plugin;
```

Defined in: [packages/vite-plugin/src/index.ts:52](packages/vite-plugin/src/index.ts#L52)

The WAVEx Vite plugin. Compiles `.wx` files to Lit render modules on
demand, serves `virtual:wavex/routes` (the file-convention route table with
lazy per-route loaders, layouts, and error pages) and the
`/@wavex/bootstrap` entry, dedupes Lit, and sends standard Vite `js-update`
HMR updates for template edits so Convex client state survives `.wx` edits.

#### Parameters

##### options?

[`WavexVitePluginOptions`](#wavexvitepluginoptions) = `{}`

#### Returns

`Plugin`

## References

### default

Renames and re-exports [wavex](#wavex)
