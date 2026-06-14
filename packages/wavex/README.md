# wavex

The WAVEx CLI, plus programmatic re-exports of the common compiler/core entry
points.

```sh
wavex check       # parse + capability diagnostics across the app (agent/CI gate)
wavex routes      # print the file-convention route table
wavex compile     # compile a .wx file and print the generated module
wavex dev         # start the Vite+ dev server on Vite's default host; pass --host to expose it
wavex build       # production build
wavex prerender   # static prerender: emit dist/<path>/index.html per route
```

## Design notes

- The CLI is agent-facing tooling by design: deterministic text output over
  the language core so coding agents and CI can check templates and inspect
  derived facts without an editor.
- Prerendering is a static HTML output optimization, not an SSR runtime: it
  emits route files from the built app shell and does not execute server-side
  data loading or provide request-time rendering.
