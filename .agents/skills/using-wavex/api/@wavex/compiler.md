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

Compiles parsed `.wx` files to Lit render modules.

Compilation targets Lit templates directly — there is deliberately no
neutral render IR in between (decided 2026-06). The compiler lowers the
`@wavex/core` AST into a TypeScript module that exports a render function,
inferred Convex resource definitions, and head entries, leaving DOM
patching to the `@wavex/runtime/lit` backend.

Key lowering rules carried by this package:
- `@name` component references resolve local `src/components/` templates
  first, then Web Awesome components — local components intentionally
  shadow Web Awesome without warning (see [componentTagForReference](#componenttagforreference)).
- `[stack gap-xl]` utility groups are plain `wa-` prefix expansion with no
  semantic mapping table (see [utilityClassForToken](#utilityclassfortoken)).
- `$module:fn` / `$$module:fn` Convex references lower to typed resource
  definitions and action targets dispatched by the runtime.

## Interfaces

### CompileWavexOptions

Defined in: [packages/compiler/src/compiler.ts:16](packages/compiler/src/compiler.ts#L16)

Options for [compileWavexModule](#compilewavexmodule).

#### Properties

##### convexFunctionKinds?

```ts
optional convexFunctionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/compiler/src/compiler.ts:24](packages/compiler/src/compiler.ts#L24)

Detected Convex function kind map keyed by normalized `module/path:function`.

##### id?

```ts
optional id?: string;
```

Defined in: [packages/compiler/src/compiler.ts:18](packages/compiler/src/compiler.ts#L18)

Module id used in diagnostics and the generated `wxFile` metadata (usually the file path).

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:20](packages/compiler/src/compiler.ts#L20)

Local `src/components/` references; these shadow Web Awesome names in `@` lookup.

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:22](packages/compiler/src/compiler.ts#L22)

Web Awesome component names (without `wa-`) detected from the installed package.

***

### CompileWavexResult

Defined in: [packages/compiler/src/compiler.ts:28](packages/compiler/src/compiler.ts#L28)

Result of [compileWavexModule](#compilewavexmodule): the parsed AST plus the generated module source.

#### Properties

##### ast

```ts
ast: WavexFile;
```

Defined in: [packages/compiler/src/compiler.ts:29](packages/compiler/src/compiler.ts#L29)

##### code

```ts
code: string;
```

Defined in: [packages/compiler/src/compiler.ts:31](packages/compiler/src/compiler.ts#L31)

Generated TypeScript module source (render function, resources, head entries).

##### usedWebAwesomeComponents

```ts
usedWebAwesomeComponents: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:33](packages/compiler/src/compiler.ts#L33)

Web Awesome component names (without the wa- prefix) referenced by this template.

## Functions

### compileWavexModule()

```ts
function compileWavexModule(source, options?): CompileWavexResult;
```

Defined in: [packages/compiler/src/compiler.ts:61](packages/compiler/src/compiler.ts#L61)

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

[`CompileWavexOptions`](#compilewavexoptions) = `{}`

#### Returns

[`CompileWavexResult`](#compilewavexresult)

***

### componentTagForReference()

```ts
function componentTagForReference(reference, options?): string;
```

Defined in: [packages/compiler/src/compiler.ts:666](packages/compiler/src/compiler.ts#L666)

Resolve an `@name` reference to its custom-element tag using the compile
options' component sets (local components shadow Web Awesome).

#### Parameters

##### reference

`string`

##### options?

[`CompileWavexOptions`](#compilewavexoptions) = `{}`

#### Returns

`string`

***

### utilityClassForToken()

```ts
function utilityClassForToken(token): string;
```

Defined in: [packages/compiler/src/compiler.ts:671](packages/compiler/src/compiler.ts#L671)

Expand one `[utility]` token to its `wa-` class (plain prefix expansion, no mapping table).

#### Parameters

##### token

`string`

#### Returns

`string`
