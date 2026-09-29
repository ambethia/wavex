# capabilities

Capability detection for Web Awesome components, Font Awesome icons, local
`.wx` components, and Convex functions.

WAVEx does not hard-require commercial packages: capabilities are detected
from what an app actually has installed. A free Web Awesome / Font Awesome
package unlocks the free surface, a Pro package or kit unlocks the Pro
surface, and templates that use a missing capability get targeted
diagnostics instead of broken output. This keeps the framework
open-sourceable without bundling or requiring licensed assets — apps bring
their own installed packages.

The same detection feeds the compiler (generated imports), the LSP
(completions and diagnostics), and the CLI (`wavex check`).

Import from `@wavex/core/capabilities`.

## Interfaces

### ComponentValidationOptions

Defined in: [packages/core/src/capabilities.ts:159](packages/core/src/capabilities.ts#L159)

Detected capabilities to validate component/icon references against.

#### Properties

##### fontAwesome?

```ts
optional fontAwesome?: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:162](packages/core/src/capabilities.ts#L162)

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:160](packages/core/src/capabilities.ts#L160)

##### webAwesome?

```ts
optional webAwesome?: Pick<WebAwesomeCapability, "packageName" | "components">;
```

Defined in: [packages/core/src/capabilities.ts:161](packages/core/src/capabilities.ts#L161)

***

### ConvexValidationOptions

Defined in: [packages/core/src/capabilities.ts:225](packages/core/src/capabilities.ts#L225)

Inputs for validating whether Convex references are client-template callable.

#### Properties

##### functionKinds?

```ts
optional functionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/core/src/capabilities.ts:227](packages/core/src/capabilities.ts#L227)

Map from normalized "module/path:function" references to detected Convex kind.

***

### FontAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:44](packages/core/src/capabilities.ts#L44)

Installed Font Awesome kits and packages available to icon-related validation.

#### Properties

##### kits

```ts
kits: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:46](packages/core/src/capabilities.ts#L46)

Installed kit packages (@awesome.me/kit-*).

##### packages

```ts
packages: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:48](packages/core/src/capabilities.ts#L48)

Installed @fortawesome/* packages.

***

### ProjectCapabilities

Defined in: [packages/core/src/capabilities.ts:52](packages/core/src/capabilities.ts#L52)

Capability snapshot discovered from an app root.

#### Properties

##### fontAwesome

```ts
fontAwesome: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:54](packages/core/src/capabilities.ts#L54)

##### webAwesome?

```ts
optional webAwesome?: WebAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:53](packages/core/src/capabilities.ts#L53)

***

### WebAwesomeAttribute

Defined in: [packages/core/src/capabilities.ts:358](packages/core/src/capabilities.ts#L358)

Attribute metadata for one Web Awesome component attribute.

#### Properties

##### default?

```ts
optional default?: string;
```

Defined in: [packages/core/src/capabilities.ts:362](packages/core/src/capabilities.ts#L362)

##### description?

```ts
optional description?: string;
```

Defined in: [packages/core/src/capabilities.ts:360](packages/core/src/capabilities.ts#L360)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:359](packages/core/src/capabilities.ts#L359)

##### type?

```ts
optional type?: string;
```

Defined in: [packages/core/src/capabilities.ts:361](packages/core/src/capabilities.ts#L361)

***

### WebAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:27](packages/core/src/capabilities.ts#L27)

Installed Web Awesome package details available to validation and code generation.

#### Properties

##### booleanAttributes

```ts
booleanAttributes: ReadonlyMap<string, ReadonlySet<string>>;
```

Defined in: [packages/core/src/capabilities.ts:38](packages/core/src/capabilities.ts#L38)

Boolean attribute names per component (keyed without the wa- prefix), from
the manifest's attribute types. Pass as `ParseWavexOptions.webAwesomeBooleanAttributes`
so bare tokens like `with-caret` on `@button` parse as boolean attributes.

##### components

```ts
components: ReadonlySet<string>;
```

Defined in: [packages/core/src/capabilities.ts:32](packages/core/src/capabilities.ts#L32)

Component names without the wa- prefix, from the package's custom-elements.json.

##### packageDir

```ts
packageDir: string;
```

Defined in: [packages/core/src/capabilities.ts:40](packages/core/src/capabilities.ts#L40)

Installed package directory (for manifest details and stylesheet scans).

##### packageName

```ts
packageName: string;
```

Defined in: [packages/core/src/capabilities.ts:29](packages/core/src/capabilities.ts#L29)

Installed package name, e.g. "@web.awesome.me/webawesome-pro" or "@awesome.me/webawesome".

##### pro

```ts
pro: boolean;
```

Defined in: [packages/core/src/capabilities.ts:30](packages/core/src/capabilities.ts#L30)

***

### WebAwesomeComponentDetail

Defined in: [packages/core/src/capabilities.ts:366](packages/core/src/capabilities.ts#L366)

Manifest metadata for one Web Awesome component.

#### Properties

##### attributes

```ts
attributes: WebAwesomeAttribute[];
```

Defined in: [packages/core/src/capabilities.ts:370](packages/core/src/capabilities.ts#L370)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:368](packages/core/src/capabilities.ts#L368)

Component name without the wa- prefix.

##### slots

```ts
slots: object[];
```

Defined in: [packages/core/src/capabilities.ts:371](packages/core/src/capabilities.ts#L371)

###### description?

```ts
optional description?: string;
```

###### name

```ts
name: string;
```

##### summary?

```ts
optional summary?: string;
```

Defined in: [packages/core/src/capabilities.ts:369](packages/core/src/capabilities.ts#L369)

## Type Aliases

### ConvexFunctionKind

```ts
type ConvexFunctionKind = "query" | "mutation" | "action" | "internal" | "httpAction";
```

Defined in: [packages/core/src/capabilities.ts:58](packages/core/src/capabilities.ts#L58)

Convex function kinds relevant to client template validation.

## Functions

### convexSemanticEventTargetReference()

```ts
function convexSemanticEventTargetReference(target): string | undefined;
```

Defined in: [packages/core/src/capabilities.ts:297](packages/core/src/capabilities.ts#L297)

Normalize a semantic `$$module:function` event target into a Convex function-kind lookup key.

#### Parameters

##### target

`string`

#### Returns

`string` \| `undefined`

***

### detectCapabilities()

```ts
function detectCapabilities(root): ProjectCapabilities;
```

Defined in: [packages/core/src/capabilities.ts:66](packages/core/src/capabilities.ts#L66)

Detect installed Web Awesome / Font Awesome capabilities from an app root.

#### Parameters

##### root

`string`

#### Returns

[`ProjectCapabilities`](#projectcapabilities)

***

### discoverConvexFunctionKinds()

```ts
function discoverConvexFunctionKinds(root): Record<string, ConvexFunctionKind>;
```

Defined in: [packages/core/src/capabilities.ts:314](packages/core/src/capabilities.ts#L314)

Classify Convex functions by scanning convex/ sources ("module/path:fn" ->
kind). Public functions keep their concrete query/mutation/action kind;
internal functions and httpAction exports are marked as non-template-callable.
Shared by the compiler, Vite plugin, CLI, and LSP.

#### Parameters

##### root

`string`

#### Returns

`Record`\<`string`, [`ConvexFunctionKind`](#convexfunctionkind)\>

***

### discoverLocalComponents()

```ts
function discoverLocalComponents(root): string[];
```

Defined in: [packages/core/src/capabilities.ts:339](packages/core/src/capabilities.ts#L339)

Local component references discovered from src/components (e.g. "talk-card", "tasks/item").

#### Parameters

##### root

`string`

#### Returns

`string`[]

***

### readManifestComponentDetails()

```ts
function readManifestComponentDetails(manifestPath): Map<string, WebAwesomeComponentDetail>;
```

Defined in: [packages/core/src/capabilities.ts:375](packages/core/src/capabilities.ts#L375)

Full component metadata (descriptions, attributes, slots) from custom-elements.json; empty when the manifest is missing or malformed.

#### Parameters

##### manifestPath

`string`

#### Returns

`Map`\<`string`, [`WebAwesomeComponentDetail`](#webawesomecomponentdetail)\>

***

### readManifestComponents()

```ts
function readManifestComponents(manifestPath): ReadonlySet<string>;
```

Defined in: [packages/core/src/capabilities.ts:140](packages/core/src/capabilities.ts#L140)

Parse component names (without wa- prefix) from a custom-elements.json manifest.

#### Parameters

##### manifestPath

`string`

#### Returns

`ReadonlySet`\<`string`\>

***

### readUtilityClasses()

```ts
function readUtilityClasses(packageDir): string[];
```

Defined in: [packages/core/src/capabilities.ts:419](packages/core/src/capabilities.ts#L419)

Utility class suffixes (wa-stack -> "stack") scraped from the installed package's stylesheets.

#### Parameters

##### packageDir

`string`

#### Returns

`string`[]

***

### validateComponentReferences()

```ts
function validateComponentReferences(file, options): Diagnostic[];
```

Defined in: [packages/core/src/capabilities.ts:166](packages/core/src/capabilities.ts#L166)

Capability diagnostics for component/icon references in a parsed .wx file.

#### Parameters

##### file

[`WavexFile`](README.md#wavexfile)

##### options

[`ComponentValidationOptions`](#componentvalidationoptions)

#### Returns

[`Diagnostic`](README.md#diagnostic)[]

***

### validateConvexReferences()

```ts
function validateConvexReferences(file, options): Diagnostic[];
```

Defined in: [packages/core/src/capabilities.ts:231](packages/core/src/capabilities.ts#L231)

Capability diagnostics for Convex references and bare $$ resource bindings.

#### Parameters

##### file

[`WavexFile`](README.md#wavexfile)

##### options

[`ConvexValidationOptions`](#convexvalidationoptions)

#### Returns

[`Diagnostic`](README.md#diagnostic)[]

***

### walkTemplateNodes()

```ts
function walkTemplateNodes(nodes, visit): void;
```

Defined in: [packages/core/src/capabilities.ts:151](packages/core/src/capabilities.ts#L151)

Depth-first visit of a template node tree.

#### Parameters

##### nodes

readonly [`TemplateNode`](README.md#templatenode)[]

##### visit

(`node`) => `void`

#### Returns

`void`

***

### webAwesomeBooleanAttributes()

```ts
function webAwesomeBooleanAttributes(details): Map<string, ReadonlySet<string>>;
```

Defined in: [packages/core/src/capabilities.ts:401](packages/core/src/capabilities.ts#L401)

Boolean attribute names per Web Awesome component (keyed without the wa-
prefix): attributes whose manifest type is `boolean` (optionally unioned
with `undefined`/`null`). Components without boolean attributes are omitted.

#### Parameters

##### details

`ReadonlyMap`\<`string`, [`WebAwesomeComponentDetail`](#webawesomecomponentdetail)\>

#### Returns

`Map`\<`string`, `ReadonlySet`\<`string`\>\>
