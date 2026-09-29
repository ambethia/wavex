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
  subscriptions). Every `update()` (navigation, resource changes, local
  handlers, `app.update({ state })`) re-evaluates each definition's `when`
  gate (compiled from the enclosing `+if`s) and args: a closed gate
  unsubscribes and clears the binding and state, changed args resubscribe,
  and passes repeat while a cleared binding can change another gate. A
  definition with `pageSize` (`paginate:N`) keeps a cursor stack and
  subscribes to one page at a time; `turnPage` moves it, `hasPreviousPage` /
  `hasNextPage` report the position, a new list (args/page size) or a closed
  gate starts on the first page, and a Convex `SplitRequired` page is ended at
  its `splitCursor` so no item is silently dropped. Late values from a
  replaced subscription are ignored by subscription identity, not key.
- `createSemanticActionDispatcher` + `installSemanticEventDelegation` —
  `:event:target` attributes compile to `data-wx-*` attributes; one delegated
  listener per event type dispatches them. Non-Convex targets first invoke the
  prelude function attached to the element by the compiler, then fall through
  to an app-level dispatcher; unresolved targets report a configurable
  diagnostic. Convex targets retain full pending/error lifecycle and form
  reset on success; without an action client they go to the app dispatcher or
  the same unhandled diagnostic instead of reporting success. `name.nextPage` /
  `name.previousPage` targets go to the resource controller's `turnPage`
  (`parsePageTarget` from `@wavex/core` is the one grammar for them). All paths
  capture analytics automatically (`:track:` overrides the event name).
- `createClientRouter` — progressive enhancement over native links: History
  API, lazy route-module loading, layout composition through semantic slots,
  and atomic page swaps via the `RouterPageHost` seam. Navigation lifecycle is
  exposed declaratively (`navigation.pending` in template context plus
  `data-wx-navigating` on `<html>`), and commits wrap in
  `document.startViewTransition` by default — pending state clears inside the
  transition's update callback, atomically with the swap, so progress UI is
  never baked into either snapshot. Push/replace navigation resets to the top
  (or the `#fragment` target; `scroll: false` keeps the offset); back/forward
  navigation restores its saved offset on the frame after the atomic page
  swap. The initial load restores a reload's offset (persisted on `pagehide`)
  or its fragment, and native `history.scrollRestoration` is set to `manual`
  while the router is active. `scrollRestoration: false` opts out, while custom
  `getPosition`/`scrollTo` seams support non-window scroll containers.
- `mountLitApp` (from `@wavex/runtime/lit`) — composes a Lit mount and the
  client router for an app-owned entry module. The caller supplies initial
  context, resource/action clients, analytics and router options, then receives
  the live mount, router, initial-navigation promise and an idempotent disposer.
  Client lifecycles remain app-owned through `onDispose`.
- `applyHead` — reconciles `document.title` and `data-wx-head`-managed nodes;
  prerendered head output emits the same shape so served and hydrated
  documents agree.
- Analytics is a minimal PostHog capture bridge (no official client
  dependency); apps opt in with `VITE_POSTHOG_KEY`.
- `icon(name, { family, variant })` is an identity function that marks a Font
  Awesome icon name computed in TypeScript, so the Vite plugin and `wavex
  check` can collect, validate, and self-host it (the runtime does nothing
  with it).

## Design notes

- Reuse the Lit ecosystem before hand-rolling (`@lit/task`,
  `@lit-labs/router`, `@lit/context`, `@lit-labs/ssr` are the reference
  points for future work).
- **Open question:** the first-class state API for colocated TypeScript
  (`state(0)`-style cells) is not designed yet. App integrations can put
  client-only state in the render context and replace it with
  `app.update({ state: ... })` without remounting; this intentionally does not
  prescribe an auth or general state-management model. Apps type that state by
  augmenting `Register` (`interface Register { state: … }`); `AppState` then
  types `RenderContext.state`, `mountLitApp`'s initial context, `app.update`,
  and every template's `state` in the editor and `wavex check`.
- **Deferral:** no SSR runtime beyond the prerender baseline; an edge SSR
  adapter is a possible later tier, not a default.
- **Pagination is Previous/Next, one live page at a time.** Each page is an
  ordinary query subscription through the `ResourceClient` seam (args plus
  `paginationOpts`), so Convex keeps the page's range stable and live and no
  experimental Convex pagination client is involved. Accumulating pages into
  one "load more" list is not provided.
- **Authentication stays app-owned.** WAVEx never calls `setAuth`; an app
  passes its authenticated Convex client as `resourceClient`/`actionClient`
  and gates signed-in resources on its own state (update state before
  clearing auth on sign-out, so gated queries unsubscribe first).
