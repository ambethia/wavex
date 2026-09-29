# @wavex/lsp

Volar-based language tooling for `.wx` files.

The LSP is built on Volar over the `@wavex/core` AST — the same parser the
compiler uses, so editor diagnostics cannot drift from compiler behavior.
Volar's virtual-code machinery maps `.wx` TypeScript preludes and template
expressions into virtual TypeScript documents, so completions, diagnostics,
hover, and go-to-definition come from the real TypeScript language service
plus Convex, Web Awesome, and Font Awesome metadata, then map back to `.wx`
source positions. Editor syntax highlighting is handled by the VS Code
TextMate grammar; the grammar is cosmetic, while this LSP uses the
`@wavex/core` parser for diagnostics and type-aware language features.

## Classes

### WavexVirtualCode

Defined in: [packages/lsp/src/language.ts:83](packages/lsp/src/language.ts#L83)

The Volar virtual code for one `.wx` document: parses with the
`@wavex/core` parser (the single parser), keeps the AST for non-TS
features, and emits an embedded TypeScript document that maps the prelude
and every `{{ … }}` / attribute expression back to its `.wx` source range.

#### Implements

- `VirtualCode`

#### Constructors

##### Constructor

```ts
new WavexVirtualCode(
   snapshot,
   fsPath?,
   parseOptions?): WavexVirtualCode;
```

Defined in: [packages/lsp/src/language.ts:90](packages/lsp/src/language.ts#L90)

###### Parameters

###### snapshot

`IScriptSnapshot`

###### fsPath?

`string`

###### parseOptions?

[`ParseWavexOptions`](../core/README.md#parsewavexoptions) = `{}`

###### Returns

[`WavexVirtualCode`](#wavexvirtualcode)

#### Properties

##### ast

```ts
ast: WavexFile;
```

Defined in: [packages/lsp/src/language.ts:88](packages/lsp/src/language.ts#L88)

##### embeddedCodes

```ts
embeddedCodes: VirtualCode[] = [];
```

Defined in: [packages/lsp/src/language.ts:87](packages/lsp/src/language.ts#L87)

###### Implementation of

```ts
VirtualCode.embeddedCodes
```

##### id

```ts
id: string = "root";
```

Defined in: [packages/lsp/src/language.ts:84](packages/lsp/src/language.ts#L84)

###### Implementation of

```ts
VirtualCode.id
```

##### languageId

```ts
languageId: string = WAVEX_LANGUAGE_ID;
```

Defined in: [packages/lsp/src/language.ts:85](packages/lsp/src/language.ts#L85)

###### Implementation of

```ts
VirtualCode.languageId
```

##### mappings

```ts
mappings: CodeMapping[] = [];
```

Defined in: [packages/lsp/src/language.ts:86](packages/lsp/src/language.ts#L86)

###### Implementation of

```ts
VirtualCode.mappings
```

##### snapshot

```ts
snapshot: IScriptSnapshot;
```

Defined in: [packages/lsp/src/language.ts:90](packages/lsp/src/language.ts#L90)

###### Implementation of

```ts
VirtualCode.snapshot
```

## Interfaces

### WavexServiceOptions

Defined in: [packages/lsp/src/service.ts:9](packages/lsp/src/service.ts#L9)

Project context for completions/diagnostics, usually detected via `@wavex/core/capabilities`.

#### Properties

##### convexFunctionKinds?

```ts
optional convexFunctionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/lsp/src/service.ts:23](packages/lsp/src/service.ts#L23)

Detected Convex function kinds keyed by normalized `module/path:function`.

##### convexFunctions?

```ts
optional convexFunctions?: readonly string[];
```

Defined in: [packages/lsp/src/service.ts:21](packages/lsp/src/service.ts#L21)

Convex function references (e.g. "tasks:list").

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/lsp/src/service.ts:11](packages/lsp/src/service.ts#L11)

Local component references (e.g. "talk-card", "tasks/item").

##### utilityClasses?

```ts
optional utilityClasses?: readonly string[];
```

Defined in: [packages/lsp/src/service.ts:19](packages/lsp/src/service.ts#L19)

Utility class suffixes (stack, gap-xl, ...) for [bracket-group] completions.

##### webAwesomeBooleanAttributes?

```ts
optional webAwesomeBooleanAttributes?: ReadonlyMap<string, ReadonlySet<string>>;
```

Defined in: [packages/lsp/src/service.ts:15](packages/lsp/src/service.ts#L15)

Boolean attributes per Web Awesome component, so diagnostics parse component heads like the compiler.

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: readonly string[];
```

Defined in: [packages/lsp/src/service.ts:13](packages/lsp/src/service.ts#L13)

Web Awesome component names without the wa- prefix.

##### webAwesomeDetails?

```ts
optional webAwesomeDetails?: ReadonlyMap<string, WebAwesomeComponentDetail>;
```

Defined in: [packages/lsp/src/service.ts:17](packages/lsp/src/service.ts#L17)

Full Web Awesome component metadata for attribute completions and hover.

## Type Aliases

### WavexParseOptionsResolver

```ts
type WavexParseOptionsResolver = (fileName) => ParseWavexOptions;
```

Defined in: [packages/lsp/src/language.ts:36](packages/lsp/src/language.ts#L36)

Resolves the parse options (component context such as installed Web Awesome
boolean attributes) for a `.wx` file path, so virtual code parses component
heads exactly like the compiler.

#### Parameters

##### fileName

`string`

#### Returns

[`ParseWavexOptions`](../core/README.md#parsewavexoptions)

***

### WavexServiceOptionsResolver

```ts
type WavexServiceOptionsResolver =
  | WavexServiceOptions
  | ((documentUri) => WavexServiceOptions);
```

Defined in: [packages/lsp/src/service.ts:27](packages/lsp/src/service.ts#L27)

Static options, or a per-document resolver so multi-project workspaces get the right context.

## Variables

### WAVEX\_LANGUAGE\_ID

```ts
const WAVEX_LANGUAGE_ID: "wavex" = "wavex";
```

Defined in: [packages/lsp/src/language.ts:20](packages/lsp/src/language.ts#L20)

The LSP language id for `.wx` documents.

## Functions

### createWavexLanguagePlugin()

```ts
function createWavexLanguagePlugin(parseOptionsFor?): LanguagePlugin<URI>;
```

Defined in: [packages/lsp/src/language.ts:48](packages/lsp/src/language.ts#L48)

Volar language plugin: recognizes `.wx` files and produces a
[WavexVirtualCode](#wavexvirtualcode) per document, with the embedded TypeScript code
registered as the TypeScript service script so prelude and template
expressions are type-checked by the real TS language service.

Pass `parseOptionsFor` (the language server passes the app's detected
component context) so bare boolean attributes on `@component` heads parse
the same way they compile.

#### Parameters

##### parseOptionsFor?

[`WavexParseOptionsResolver`](#wavexparseoptionsresolver)

#### Returns

`LanguagePlugin`\<`URI`\>

***

### createWavexServicePlugin()

```ts
function createWavexServicePlugin(optionsOrResolver?): LanguageServicePlugin;
```

Defined in: [packages/lsp/src/service.ts:49](packages/lsp/src/service.ts#L49)

Volar service plugin providing the WAVEx-specific editor features that
aren't plain TypeScript: parser diagnostics, completions for `@` components
(local + Web Awesome), `+` directives, `$`/`$$` Convex functions, and
`[utility]` tokens, plus hover docs from Web Awesome metadata.

#### Parameters

##### optionsOrResolver?

[`WavexServiceOptionsResolver`](#wavexserviceoptionsresolver) = `{}`

#### Returns

`LanguageServicePlugin`
