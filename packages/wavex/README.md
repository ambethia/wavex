# wavex

The WAVEx CLI, plus programmatic re-exports of the common compiler/core entry
points.

```sh
wavex check       # parse, capability, icon, and TypeScript diagnostics across the app (agent/CI gate)
wavex routes      # print the file-convention route table
wavex compile     # compile a .wx file and print the generated module
wavex dev         # start the Vite+ dev server on Vite's default host; pass --host to expose it
wavex build       # production build
wavex prerender   # static prerender: emit dist/<path>/index.html per route
```

`wavex check [paths...]` checks the `.wx` files under each directory and each
`.wx` file named directly (other named files only contribute their `icon()`
declarations), grouped by app root, so a commit hook can pass every staged
path. It reports each problem as `file:line:col SEVERITY CODE
message` (paths relative to the working directory) and exits non-zero on
errors. Besides parser (WX0xx), capability and Convex (WX101/WX102), and icon
(WX103/WX104) diagnostics, it type-checks every `.wx` file with the same
virtual TypeScript the language server generates, under the app's
tsconfig.json — so a template reading a field its state type no longer has
fails the check just as it shows in the editor. It uses WAVEx's own
TypeScript (6.x), so apps built with the native TypeScript 7 compiler, which
has no JavaScript API, are checked too. A tsconfig that does not include the
`.wx` files gets a WX105 warning, and an app without a tsconfig.json is an
error.

## Design notes

- The CLI is agent-facing tooling by design: deterministic text output over
  the language core so coding agents and CI can check templates and inspect
  derived facts without an editor.
- Prerendering is a static HTML output optimization, not an SSR runtime: it
  emits route files from the built app shell and does not execute server-side
  data loading or provide request-time rendering.
