# @wavex/compiler

Compiles parsed `.wx` files into Lit render modules.

`compileWavexModule(source)` parses with `@wavex/core` and emits a TypeScript
module that preserves the file's prelude and exports a `render(context)`
function built on Lit `html`/`repeat`, a `resources` array of inferred Convex
query definitions, and `headEntries(context)` for `+head` content. Problems
are reported on `result.ast.diagnostics`, never thrown.

## Design notes

- **Compile directly to Lit, no neutral IR** (decided 2026-06). WAVEx owns the
  generated render shape; Lit owns DOM patching and keyed list identity. The
  Lit adapter lives at `@wavex/runtime/lit`.
- **Component lookup order**: local `src/components/` templates first, then
  Web Awesome. Local components intentionally shadow Web Awesome without
  warning (an app's `card.wx` can wrap `<wa-card>`); `@wa/name` and
  `@components/name` are the explicit bypass forms.
- **Utilities are dumb on purpose**: `[stack gap-xl]` is plain `wa-` prefix
  expansion (`wa-stack wa-gap-xl`) — no mapping table, no `name:value` utility
  grammar.
- **Render stays side-effect free**: bare `$$module:fn` lines lower to query
  resource definitions; mutations/actions only lower behind explicit triggers
  (`:click:`, `:submit:`).
- **Typed component inputs**: a component declaring `type Attrs = { … }` in
  its prelude gets each attribute destructured as a bare typed local in
  template scope.
