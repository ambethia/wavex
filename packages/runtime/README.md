# @wavex/runtime

Browser runtime for WAVEx apps: routing, resource lifecycle, the Convex
bridge, mutation/action state, head management, error boundaries, and
analytics. The Lit renderer adapter is the `@wavex/runtime/lit` subpath.

## Architecture

WAVEx owns resources, routing, actions, head, and analytics; the renderer
backend owns low-level DOM patching and keyed list identity. Apps are
client-side by default — prerendered HTML is an output optimization, and
Convex realtime subscriptions start after boot.

Key seams (all structurally typed, so tests run on fake clients without a
live deployment):

- `ResourceClient` / `ActionClient` — the realtime/dispatch boundary. The real
  implementations (`createConvexResourceClient`, `createConvexActionClient`)
  wrap the official Convex browser client and resolve `module:fn` addresses
  through the generated `api` object when available.
- `createResourceController` — keeps subscriptions in sync with the wanted
  definitions; navigation tears down only what changed (route-scoped
  subscriptions).
- `createSemanticActionDispatcher` + `installSemanticEventDelegation` —
  `:event:target` attributes compile to `data-wx-*` attributes; one delegated
  listener per event type dispatches them with full pending/error lifecycle,
  form reset on success, and automatic analytics capture (`:track:` overrides
  the event name).
- `createClientRouter` — progressive enhancement over native links: History
  API, lazy route-module loading, layout composition through semantic slots,
  and atomic page swaps via the `RouterPageHost` seam. Navigation lifecycle is
  exposed declaratively (`navigation.pending` in template context plus
  `data-wx-navigating` on `<html>`), and commits wrap in
  `document.startViewTransition` by default — pending state clears inside the
  transition's update callback, atomically with the swap, so progress UI is
  never baked into either snapshot. Known follow-up: no scroll management yet
  (no `scrollTo(0,0)` on push; popstate restoration races the deferred swap by
  one frame).
- `applyHead` — reconciles `document.title` and `data-wx-head`-managed nodes;
  prerendered head output emits the same shape so served and hydrated
  documents agree.
- Analytics is a minimal PostHog capture bridge (no official client
  dependency); apps opt in with `VITE_POSTHOG_KEY`.

## Design notes

- Reuse the Lit ecosystem before hand-rolling (`@lit/task`,
  `@lit-labs/router`, `@lit/context`, `@lit-labs/ssr` are the reference
  points for future work).
- **Open question:** the first-class state API for colocated TypeScript
  (`state(0)`-style cells) is not designed yet; today templates work with
  resource state, action state, and exported handlers.
- **Deferral:** no SSR runtime beyond the prerender baseline; an edge SSR
  adapter is a possible later tier, not a default.
