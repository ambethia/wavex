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

Defined in: [packages/compiler/src/compiler.ts:17](packages/compiler/src/compiler.ts#L17)

Options for [compileWavexModule](#compilewavexmodule).

#### Properties

##### convexFunctionKinds?

```ts
optional convexFunctionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/compiler/src/compiler.ts:25](packages/compiler/src/compiler.ts#L25)

Detected Convex function kind map keyed by normalized `module/path:function`.

##### id?

```ts
optional id?: string;
```

Defined in: [packages/compiler/src/compiler.ts:19](packages/compiler/src/compiler.ts#L19)

Module id used in diagnostics and the generated `wxFile` metadata (usually the file path).

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:21](packages/compiler/src/compiler.ts#L21)

Local `src/components/` references; these shadow Web Awesome names in `@` lookup.

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:23](packages/compiler/src/compiler.ts#L23)

Web Awesome component names (without `wa-`) detected from the installed package.

***

### CompileWavexResult

Defined in: [packages/compiler/src/compiler.ts:29](packages/compiler/src/compiler.ts#L29)

Result of [compileWavexModule](#compilewavexmodule): the parsed AST plus the generated module source.

#### Properties

##### ast

```ts
ast: WavexFile;
```

Defined in: [packages/compiler/src/compiler.ts:30](packages/compiler/src/compiler.ts#L30)

##### code

```ts
code: string;
```

Defined in: [packages/compiler/src/compiler.ts:32](packages/compiler/src/compiler.ts#L32)

Generated TypeScript module source (render function, resources, head entries).

##### usedWebAwesomeComponents

```ts
usedWebAwesomeComponents: readonly string[];
```

Defined in: [packages/compiler/src/compiler.ts:34](packages/compiler/src/compiler.ts#L34)

Web Awesome component names (without the wa- prefix) referenced by this template.

## Functions

### compileWavexModule()

```ts
function compileWavexModule(source, options?): CompileWavexResult;
```

Defined in: [packages/compiler/src/compiler.ts:121](packages/compiler/src/compiler.ts#L121)

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

Defined in: [packages/compiler/src/compiler.ts:967](packages/compiler/src/compiler.ts#L967)

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

Defined in: [packages/compiler/src/compiler.ts:972](packages/compiler/src/compiler.ts#L972)

Expand one `[utility]` token to its `wa-` class (plain prefix expansion, no mapping table).

#### Parameters

##### token

`string`

#### Returns

`string`
