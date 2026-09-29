# @wavex/core

Parser, AST, diagnostics, and the shared project model for `.wx` files — the
single source of truth for the WAVEx language.

## What lives here

- **`@wavex/core`** — `parseWavex` (the only `.wx` parser definition), the
  template AST with node and sub-line token source ranges, structured diagnostics (including each
  `$$` resource's enclosing `+if` conditions and `paginate:` page size, and
  the reserved `name.nextPage` / `name.previousPage` page targets), and the project
  model: the fixed app layout (`WavexConfig`), file-based route derivation and
  matching, Convex resource binding-name inference, `@` component reference
  resolution, and `[utility]` → `wa-` class expansion.
- **`@wavex/core/capabilities`** — Node-side detection of installed Web
  Awesome / Font Awesome packages, local `.wx` components, and Convex function
  kinds, plus capability diagnostics for templates that use something the app
  doesn't have installed, and Font Awesome icon collection (template literals,
  value-position literals in dynamic names, `icon()` declarations) validated
  against the installed kit or SVG package.
- **`docs/`** — the hand-curated `.wx` language guides (syntax, directives,
  Convex references, forms). These are the authority on the language surface
  and ship in the generated `using-wavex` agent skill.

## Design notes

- **Single parser, no second grammar.** The TypeScript parser here is consumed
  by both the compiler and the Volar LSP. An earlier Tree-sitter grammar and
  Zed extension were deleted rather than maintained as a second, drift-prone
  definition; do not reintroduce them. Editor highlighting may use a cosmetic,
  drift-tolerant TextMate grammar, but `@wavex/core` remains the only parser.
- **Diagnostics, not exceptions.** Parsing collects `Diagnostic` values and
  always yields a best-effort AST, so the LSP and compiler can report every
  problem in a file with positions.
- **Parse context is explicit.** Whether a bare word on an `@component` head is
  a boolean attribute or inline text depends on the installed Web Awesome
  manifest (`with-caret` is a `wa-button` boolean). The parser never reads the
  file system; the compiler, Vite plugin, CLI, and LSP each pass the same
  `ParseWavexOptions` built from `detectCapabilities` and local component
  discovery, so they parse an app identically.
- **Directory structure is framework law.** Routes in `src/pages`, components
  in `src/components`, Convex in `convex`, static assets in `public`. There is
  deliberately no configuration to move these. The only lookup is Convex's
  location: `findConvexDir` returns the app root's own `convex/`, or in a
  monorepo the nearest ancestor Convex project (`convex/_generated`, or
  `convex/` next to `convex.json`); every tool calls it instead of assuming
  `<app root>/convex`.
- **Web Awesome owns the icon folder mapping.** Which Font Awesome folder an
  icon lives in (`solid`, `sharp-regular`, `jelly-regular`, …) is Web
  Awesome's `getIconFolder`; `loadWebAwesomeIconFolder` imports it from the
  installed package instead of replicating it, so collected icons always match
  the URLs the default icon library requests.
- **Capability-based, BYO license.** Free Web Awesome / Font Awesome packages
  unlock the free surface; Pro packages unlock Pro. WAVEx stays
  open-sourceable because it never bundles or requires licensed assets.
