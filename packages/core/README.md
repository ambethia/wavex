# @wavex/core

Parser, AST, diagnostics, and the shared project model for `.wx` files — the
single source of truth for the WAVEx language.

## What lives here

- **`@wavex/core`** — `parseWavex` (the only `.wx` grammar definition), the
  template AST with node and sub-line token source ranges, structured diagnostics, and the project
  model: the fixed app layout (`WavexConfig`), file-based route derivation and
  matching, Convex resource binding-name inference, `@` component reference
  resolution, and `[utility]` → `wa-` class expansion.
- **`@wavex/core/capabilities`** — Node-side detection of installed Web
  Awesome / Font Awesome packages, local `.wx` components, and Convex function
  kinds, plus capability diagnostics for templates that use something the app
  doesn't have installed.
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
- **Directory structure is framework law.** Routes in `src/pages`, components
  in `src/components`, Convex in `convex`, static assets in `public`. There is
  deliberately no configuration to move these.
- **Capability-based, BYO license.** Free Web Awesome / Font Awesome packages
  unlock the free surface; Pro packages unlock Pro. WAVEx stays
  open-sourceable because it never bundles or requires licensed assets.
