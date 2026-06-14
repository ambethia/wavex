# wavex

The WAVEx CLI, plus programmatic re-exports of the common compiler/core entry
points.

```sh
wavex check       # parse + capability diagnostics across the app (agent/CI gate)
wavex routes      # print the file-convention route table
wavex compile     # compile a .wx file and print the generated module
wavex dev         # start the Vite+ dev server on Vite's default host; pass --host to expose it
wavex build       # production build
wavex prerender   # Tier-1 prerender: emit dist/<path>/index.html per route
```

## Design notes

- The CLI is agent-facing tooling by design: deterministic, JSON-friendly
  commands over the language core so coding agents and CI can check templates
  and inspect derived facts without an editor.
- Prerendering is an output optimization (`@lit-labs/ssr` is the reference
  direction), not an SSR runtime — the served document and the hydrated
  document emit the same shape.
