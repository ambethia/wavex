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

Defined in: [packages/core/src/capabilities.ts:117](packages/core/src/capabilities.ts#L117)

Detected capabilities to validate component/icon references against.

#### Properties

##### fontAwesome?

```ts
optional fontAwesome?: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:120](packages/core/src/capabilities.ts#L120)

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:118](packages/core/src/capabilities.ts#L118)

##### webAwesome?

```ts
optional webAwesome?: Pick<WebAwesomeCapability, "packageName" | "components">;
```

Defined in: [packages/core/src/capabilities.ts:119](packages/core/src/capabilities.ts#L119)

***

### ConvexValidationOptions

Defined in: [packages/core/src/capabilities.ts:182](packages/core/src/capabilities.ts#L182)

#### Properties

##### functionKinds?

```ts
optional functionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/core/src/capabilities.ts:184](packages/core/src/capabilities.ts#L184)

Map from normalized "module/path:function" references to detected Convex kind.

***

### FontAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:36](packages/core/src/capabilities.ts#L36)

#### Properties

##### kits

```ts
kits: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:38](packages/core/src/capabilities.ts#L38)

Installed kit packages (@awesome.me/kit-*).

##### packages

```ts
packages: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:40](packages/core/src/capabilities.ts#L40)

Installed @fortawesome/* packages.

***

### ProjectCapabilities

Defined in: [packages/core/src/capabilities.ts:43](packages/core/src/capabilities.ts#L43)

#### Properties

##### fontAwesome

```ts
fontAwesome: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:45](packages/core/src/capabilities.ts#L45)

##### webAwesome?

```ts
optional webAwesome?: WebAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:44](packages/core/src/capabilities.ts#L44)

***

### WebAwesomeAttribute

Defined in: [packages/core/src/capabilities.ts:300](packages/core/src/capabilities.ts#L300)

#### Properties

##### default?

```ts
optional default?: string;
```

Defined in: [packages/core/src/capabilities.ts:304](packages/core/src/capabilities.ts#L304)

##### description?

```ts
optional description?: string;
```

Defined in: [packages/core/src/capabilities.ts:302](packages/core/src/capabilities.ts#L302)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:301](packages/core/src/capabilities.ts#L301)

##### type?

```ts
optional type?: string;
```

Defined in: [packages/core/src/capabilities.ts:303](packages/core/src/capabilities.ts#L303)

***

### WebAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:26](packages/core/src/capabilities.ts#L26)

#### Properties

##### components

```ts
components: ReadonlySet<string>;
```

Defined in: [packages/core/src/capabilities.ts:31](packages/core/src/capabilities.ts#L31)

Component names without the wa- prefix, from the package's custom-elements.json.

##### packageDir

```ts
packageDir: string;
```

Defined in: [packages/core/src/capabilities.ts:33](packages/core/src/capabilities.ts#L33)

Installed package directory (for manifest details and stylesheet scans).

##### packageName

```ts
packageName: string;
```

Defined in: [packages/core/src/capabilities.ts:28](packages/core/src/capabilities.ts#L28)

Installed package name, e.g. "@web.awesome.me/webawesome-pro" or "@awesome.me/webawesome".

##### pro

```ts
pro: boolean;
```

Defined in: [packages/core/src/capabilities.ts:29](packages/core/src/capabilities.ts#L29)

***

### WebAwesomeComponentDetail

Defined in: [packages/core/src/capabilities.ts:307](packages/core/src/capabilities.ts#L307)

#### Properties

##### attributes

```ts
attributes: WebAwesomeAttribute[];
```

Defined in: [packages/core/src/capabilities.ts:311](packages/core/src/capabilities.ts#L311)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:309](packages/core/src/capabilities.ts#L309)

Component name without the wa- prefix.

##### slots

```ts
slots: object[];
```

Defined in: [packages/core/src/capabilities.ts:312](packages/core/src/capabilities.ts#L312)

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

Defined in: [packages/core/src/capabilities.ts:310](packages/core/src/capabilities.ts#L310)

## Type Aliases

### ConvexFunctionKind

```ts
type ConvexFunctionKind = "query" | "mutation" | "action" | "internal" | "httpAction";
```

Defined in: [packages/core/src/capabilities.ts:49](packages/core/src/capabilities.ts#L49)

Convex function kinds relevant to client template validation.

## Functions

### convexSemanticEventTargetReference()

```ts
function convexSemanticEventTargetReference(target): string | undefined;
```

Defined in: [packages/core/src/capabilities.ts:243](packages/core/src/capabilities.ts#L243)

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

Defined in: [packages/core/src/capabilities.ts:57](packages/core/src/capabilities.ts#L57)

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

Defined in: [packages/core/src/capabilities.ts:257](packages/core/src/capabilities.ts#L257)

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

Defined in: [packages/core/src/capabilities.ts:282](packages/core/src/capabilities.ts#L282)

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

Defined in: [packages/core/src/capabilities.ts:316](packages/core/src/capabilities.ts#L316)

Full component metadata (descriptions, attributes, slots) from custom-elements.json.

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

Defined in: [packages/core/src/capabilities.ts:91](packages/core/src/capabilities.ts#L91)

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

Defined in: [packages/core/src/capabilities.ts:353](packages/core/src/capabilities.ts#L353)

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

Defined in: [packages/core/src/capabilities.ts:124](packages/core/src/capabilities.ts#L124)

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

Defined in: [packages/core/src/capabilities.ts:188](packages/core/src/capabilities.ts#L188)

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

Defined in: [packages/core/src/capabilities.ts:109](packages/core/src/capabilities.ts#L109)

Depth-first visit of a template node tree.

#### Parameters

##### nodes

readonly [`TemplateNode`](README.md#templatenode)[]

##### visit

(`node`) => `void`

#### Returns

`void`
