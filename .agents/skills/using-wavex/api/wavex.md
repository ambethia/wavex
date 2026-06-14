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

The `wavex` CLI package: agent- and CI-friendly commands over the language
core (`wavex check`, route inspection, compilation), plus programmatic
re-exports of the most common compiler and core entry points.

## Functions

### compileWavexModule()

```ts
function compileWavexModule(source, options?): CompileWavexResult;
```

Defined in: [packages/compiler/dist/compiler.d.ts:30](packages/compiler/dist/compiler.d.ts#L30)

Compile `.wx` source into a Lit render module.

The generated module preserves the TypeScript prelude verbatim, then
exports: a `render(context)` function built on Lit `html`/`repeat`, a
`resources` array of inferred Convex query definitions, and a
`headEntries(context)` function for `+head` content. Components declaring
`type Attrs = { … }` in their prelude get each attribute destructured as a
bare typed local in template scope. Parse and compile problems are reported
on `result.ast.diagnostics`, not thrown.

#### Parameters

##### source

`string`

##### options?

[`CompileWavexOptions`](@wavex/compiler.md#compilewavexoptions)

#### Returns

[`CompileWavexResult`](@wavex/compiler.md#compilewavexresult)

***

### createDefaultConfig()

```ts
function createDefaultConfig(): WavexConfig;
```

Defined in: [packages/core/dist/model.d.ts:54](packages/core/dist/model.d.ts#L54)

The standard WAVEx app layout (see [WavexConfig](@wavex/core/README.md#wavexconfig)).

#### Returns

[`WavexConfig`](@wavex/core/README.md#wavexconfig)

***

### createRouteDefinition()

```ts
function createRouteDefinition(file, pagesDir?): RouteDefinition | undefined;
```

Defined in: [packages/core/dist/model.d.ts:65](packages/core/dist/model.d.ts#L65)

Build a full [RouteDefinition](@wavex/core/README.md#routedefinition) from a page file path, or undefined if the file is not routable.

#### Parameters

##### file

`string`

##### pagesDir?

`string`

#### Returns

[`RouteDefinition`](@wavex/core/README.md#routedefinition) \| `undefined`

***

### parseWavex()

```ts
function parseWavex(source, _options?): WavexFile;
```

Defined in: [packages/core/dist/parser.d.ts:15](packages/core/dist/parser.d.ts#L15)

Parse a complete `.wx` source file into a [WavexFile](@wavex/core/README.md#wavexfile).

The TypeScript prelude (everything before the `~~~` wave separator) is kept
as raw text for TypeScript tooling; the indentation-based template body is
parsed into TemplateNode trees with source ranges. Parse problems
are collected as diagnostics on the result rather than thrown, so a file
with errors still yields a best-effort AST for the LSP and compiler.

#### Parameters

##### source

`string`

##### \_options?

[`ParseWavexOptions`](@wavex/core/README.md#parsewavexoptions)

#### Returns

[`WavexFile`](@wavex/core/README.md#wavexfile)

***

### routePathFromPageFile()

```ts
function routePathFromPageFile(file, pagesDir?): string | undefined;
```

Defined in: [packages/core/dist/model.d.ts:61](packages/core/dist/model.d.ts#L61)

Derive a route path from a page file path, or undefined for non-routable
files (`+layout.wx`, `+error.wx`, non-`.wx` files). `index.wx` maps to the
directory path, `[id]` to `:id`, and `[...slug]` to `*slug`.

#### Parameters

##### file

`string`

##### pagesDir?

`string`

#### Returns

`string` \| `undefined`
