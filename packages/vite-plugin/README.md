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
- Self-hosted Font Awesome icons. With a Font Awesome kit or SVG package
  installed, the plugin collects the app's icons (literal `@icon` names,
  value-position literals in dynamic names, `icon("…")` declarations from
  `@wavex/runtime`, and Web Awesome's own default-library icons), fails the
  build on unknown ones (WX103/WX104), and serves exactly those SVGs at
  `<base><assetsDir>/wavex-icons/<folder>/<name>.svg`: dev middleware answers
  only collected icons (anything else is a 404 with a logged explanation, so
  dev matches the build) and the build emits them as assets.
  `virtual:wavex/icons` calls Web Awesome's `setIconPath` with that base;
  compiled `.wx` modules import it before their Web Awesome components. The
  collection is rebuilt after app source edits. Without an SVG package the
  module is empty and Web Awesome keeps its Font Awesome CDN default.
- Monorepo-aware Convex discovery: the app's own `convex/`, or the nearest
  ancestor Convex project (`findConvexDir` from `@wavex/core/capabilities`),
  feeds function kinds, the bootstrap's generated `api` import (via `/@fs/`
  when it lives outside the Vite root), and the dev watcher.

The `@wavex/vite-plugin/client` subpath ships ambient `*.wx` module
declarations plus types for the virtual modules; apps reference it from
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
import { session, type AuthState } from "./auth/session";

// Types `state` in every template, initialContext, and app.update.
declare module "@wavex/runtime" {
  interface Register {
    state: { auth: AuthState };
  }
}

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

Compiled `.wx` modules import `virtual:wavex/icons` themselves; an entry that
renders Web Awesome icons outside `.wx` templates imports it first.

Here `session` is deliberately an app API: it can be backed by passkeys,
one-time codes, cookies, or anything else. WAVEx only carries `state.auth` into
templates and rerenders when the app replaces it. Convex authentication stays
at the official `ConvexClient.setAuth` boundary; authorization remains a
backend concern.

Because `resourceClient` and `actionClient` wrap that same authenticated
client, `$$` resources and `:event:$$module:fn` actions run as the signed-in
user. Queries that require a user go inside an `+if` on the published auth
state (`+if state.auth.signedIn`), so they subscribe when `app.update` reports
the sign-in and unsubscribe when it reports the sign-out. On sign-out, call
`app.update` with the signed-out state before clearing the client's auth
(`convex.setAuth(async () => null)`); otherwise Convex re-runs the still-live
queries without a user and they report errors.

## Design notes

- Vite+ is the primary substrate by design: module resolution, HMR, package
  integration, and production bundling are not WAVEx problems.
- **Open question:** the exact HMR contract for colocated TypeScript state
  preservation (snapshot/restore hooks) is not settled; today template edits
  preserve Convex state and prelude changes reload the module.
- **Deferral:** prerendering is a static HTML optimization for resource-free
  routes (see the `wavex` CLI); build-time Convex data and edge SSR are later
  tiers.
