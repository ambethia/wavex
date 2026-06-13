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

Defined in: [packages/core/src/capabilities.ts:114](packages/core/src/capabilities.ts#L114)

Detected capabilities to validate component/icon references against.

#### Properties

##### fontAwesome?

```ts
optional fontAwesome?: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:117](packages/core/src/capabilities.ts#L117)

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:115](packages/core/src/capabilities.ts#L115)

##### webAwesome?

```ts
optional webAwesome?: Pick<WebAwesomeCapability, "packageName" | "components">;
```

Defined in: [packages/core/src/capabilities.ts:116](packages/core/src/capabilities.ts#L116)

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

Defined in: [packages/core/src/capabilities.ts:226](packages/core/src/capabilities.ts#L226)

#### Properties

##### default?

```ts
optional default?: string;
```

Defined in: [packages/core/src/capabilities.ts:230](packages/core/src/capabilities.ts#L230)

##### description?

```ts
optional description?: string;
```

Defined in: [packages/core/src/capabilities.ts:228](packages/core/src/capabilities.ts#L228)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:227](packages/core/src/capabilities.ts#L227)

##### type?

```ts
optional type?: string;
```

Defined in: [packages/core/src/capabilities.ts:229](packages/core/src/capabilities.ts#L229)

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

Defined in: [packages/core/src/capabilities.ts:233](packages/core/src/capabilities.ts#L233)

#### Properties

##### attributes

```ts
attributes: WebAwesomeAttribute[];
```

Defined in: [packages/core/src/capabilities.ts:237](packages/core/src/capabilities.ts#L237)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:235](packages/core/src/capabilities.ts#L235)

Component name without the wa- prefix.

##### slots

```ts
slots: object[];
```

Defined in: [packages/core/src/capabilities.ts:238](packages/core/src/capabilities.ts#L238)

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

Defined in: [packages/core/src/capabilities.ts:236](packages/core/src/capabilities.ts#L236)

## Functions

### detectCapabilities()

```ts
function detectCapabilities(root): ProjectCapabilities;
```

Defined in: [packages/core/src/capabilities.ts:54](packages/core/src/capabilities.ts#L54)

Detect installed Web Awesome / Font Awesome capabilities from an app root.

#### Parameters

##### root

`string`

#### Returns

[`ProjectCapabilities`](#projectcapabilities)

***

### discoverConvexFunctionKinds()

```ts
function discoverConvexFunctionKinds(root): Record<string, "query" | "mutation" | "action">;
```

Defined in: [packages/core/src/capabilities.ts:184](packages/core/src/capabilities.ts#L184)

Classify public Convex functions by scanning convex/ sources
("module/path:fn" -> kind). Shared by the Vite plugin (semantic event
dispatch) and the LSP (completions).

#### Parameters

##### root

`string`

#### Returns

`Record`\<`string`, `"query"` \| `"mutation"` \| `"action"`\>

***

### discoverLocalComponents()

```ts
function discoverLocalComponents(root): string[];
```

Defined in: [packages/core/src/capabilities.ts:208](packages/core/src/capabilities.ts#L208)

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

Defined in: [packages/core/src/capabilities.ts:242](packages/core/src/capabilities.ts#L242)

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

Defined in: [packages/core/src/capabilities.ts:88](packages/core/src/capabilities.ts#L88)

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

Defined in: [packages/core/src/capabilities.ts:279](packages/core/src/capabilities.ts#L279)

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

Defined in: [packages/core/src/capabilities.ts:121](packages/core/src/capabilities.ts#L121)

Capability diagnostics for component/icon references in a parsed .wx file.

#### Parameters

##### file

[`WavexFile`](README.md#wavexfile)

##### options

[`ComponentValidationOptions`](#componentvalidationoptions)

#### Returns

[`Diagnostic`](README.md#diagnostic)[]

***

### walkTemplateNodes()

```ts
function walkTemplateNodes(nodes, visit): void;
```

Defined in: [packages/core/src/capabilities.ts:106](packages/core/src/capabilities.ts#L106)

Depth-first visit of a template node tree.

#### Parameters

##### nodes

readonly [`TemplateNode`](README.md#templatenode)[]

##### visit

(`node`) => `void`

#### Returns

`void`
