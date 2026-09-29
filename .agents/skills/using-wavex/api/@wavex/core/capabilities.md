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

Defined in: [packages/core/src/capabilities.ts:188](packages/core/src/capabilities.ts#L188)

Detected capabilities to validate component/icon references against.

#### Properties

##### fontAwesome?

```ts
optional fontAwesome?: Pick<FontAwesomeCapability, "iconSources">;
```

Defined in: [packages/core/src/capabilities.ts:191](packages/core/src/capabilities.ts#L191)

##### localComponents?

```ts
optional localComponents?: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:189](packages/core/src/capabilities.ts#L189)

##### webAwesome?

```ts
optional webAwesome?: Pick<WebAwesomeCapability, "components" | "packageName">;
```

Defined in: [packages/core/src/capabilities.ts:190](packages/core/src/capabilities.ts#L190)

***

### ConvexValidationOptions

Defined in: [packages/core/src/capabilities.ts:258](packages/core/src/capabilities.ts#L258)

Inputs for validating whether Convex references are client-template callable.

#### Properties

##### functionKinds?

```ts
optional functionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
```

Defined in: [packages/core/src/capabilities.ts:260](packages/core/src/capabilities.ts#L260)

Map from normalized "module/path:function" references to detected Convex kind.

***

### FontAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:64](packages/core/src/capabilities.ts#L64)

Installed Font Awesome kits and packages available to icon-related validation.

#### Properties

##### iconSources

```ts
iconSources: readonly FontAwesomeIconSource[];
```

Defined in: [packages/core/src/capabilities.ts:75](packages/core/src/capabilities.ts#L75)

Packages that ship SVG files, in lookup order (kits, then SVG packages).
When there is at least one and Web Awesome is installed, WAVEx validates
icon names against them and serves the app's icons itself instead of Web
Awesome's default Font Awesome CDN.

##### kits

```ts
kits: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:66](packages/core/src/capabilities.ts#L66)

Installed kit packages (@awesome.me/kit-*), sorted.

##### packages

```ts
packages: readonly string[];
```

Defined in: [packages/core/src/capabilities.ts:68](packages/core/src/capabilities.ts#L68)

Installed @fortawesome/* packages, sorted.

***

### FontAwesomeIconSource

Defined in: [packages/core/src/icons.ts:16](packages/core/src/icons.ts#L16)

One installed Font Awesome package WAVEx can serve SVG icons from: a kit
(`@awesome.me/kit-*`, SVGs under `icons/svgs/`) or an SVG package such as
`@fortawesome/fontawesome-free` / `fontawesome-pro` (under `svgs/`). Both
lay icons out as `<folder>/<name>.svg` with Font Awesome's folder names
(`solid`, `regular`, `brands`, `sharp-solid`, `duotone`, …).

#### Properties

##### packageName

```ts
packageName: string;
```

Defined in: [packages/core/src/icons.ts:17](packages/core/src/icons.ts#L17)

##### svgDir

```ts
svgDir: string;
```

Defined in: [packages/core/src/icons.ts:19](packages/core/src/icons.ts#L19)

Directory containing the `<folder>/<name>.svg` files.

***

### IconAsset

Defined in: [packages/core/src/icons.ts:47](packages/core/src/icons.ts#L47)

An icon resolved to the SVG file that serves it.

#### Properties

##### file

```ts
file: string;
```

Defined in: [packages/core/src/icons.ts:52](packages/core/src/icons.ts#L52)

Absolute path of the SVG in the installed Font Awesome package.

##### folder

```ts
folder: string;
```

Defined in: [packages/core/src/icons.ts:49](packages/core/src/icons.ts#L49)

Font Awesome folder, e.g. "solid" or "sharp-regular".

##### name

```ts
name: string;
```

Defined in: [packages/core/src/icons.ts:50](packages/core/src/icons.ts#L50)

***

### IconReference

Defined in: [packages/core/src/icons.ts:30](packages/core/src/icons.ts#L30)

A Font Awesome icon an app uses, as written: from a literal `@icon name:`,
a string literal in a value position of a dynamic `name:{{ … }}`
expression, or an `icon("…")` declaration imported from `@wavex/runtime`.
`family`/`variant` are undefined when the source leaves them to Web
Awesome's defaults (`classic`/`solid`). `line`/`column` are 1-based in the
file that references the icon.

#### Properties

##### column

```ts
column: number;
```

Defined in: [packages/core/src/icons.ts:35](packages/core/src/icons.ts#L35)

##### family?

```ts
optional family?: string;
```

Defined in: [packages/core/src/icons.ts:32](packages/core/src/icons.ts#L32)

##### line

```ts
line: number;
```

Defined in: [packages/core/src/icons.ts:34](packages/core/src/icons.ts#L34)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/icons.ts:31](packages/core/src/icons.ts#L31)

##### variant?

```ts
optional variant?: string;
```

Defined in: [packages/core/src/icons.ts:33](packages/core/src/icons.ts#L33)

***

### ProjectCapabilities

Defined in: [packages/core/src/capabilities.ts:79](packages/core/src/capabilities.ts#L79)

Capability snapshot discovered from an app root.

#### Properties

##### fontAwesome

```ts
fontAwesome: FontAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:81](packages/core/src/capabilities.ts#L81)

##### webAwesome?

```ts
optional webAwesome?: WebAwesomeCapability;
```

Defined in: [packages/core/src/capabilities.ts:80](packages/core/src/capabilities.ts#L80)

***

### SourceIcons

Defined in: [packages/core/src/icons.ts:495](packages/core/src/icons.ts#L495)

Icons referenced by one app source file, plus its `icon()` declaration diagnostics.

#### Properties

##### diagnostics

```ts
diagnostics: Diagnostic[];
```

Defined in: [packages/core/src/icons.ts:499](packages/core/src/icons.ts#L499)

##### file

```ts
file: string;
```

Defined in: [packages/core/src/icons.ts:497](packages/core/src/icons.ts#L497)

Absolute path of the `.wx` template or TypeScript/JavaScript file.

##### icons

```ts
icons: IconReference[];
```

Defined in: [packages/core/src/icons.ts:498](packages/core/src/icons.ts#L498)

***

### WebAwesomeAttribute

Defined in: [packages/core/src/capabilities.ts:428](packages/core/src/capabilities.ts#L428)

Attribute metadata for one Web Awesome component attribute.

#### Properties

##### default?

```ts
optional default?: string;
```

Defined in: [packages/core/src/capabilities.ts:432](packages/core/src/capabilities.ts#L432)

##### description?

```ts
optional description?: string;
```

Defined in: [packages/core/src/capabilities.ts:430](packages/core/src/capabilities.ts#L430)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:429](packages/core/src/capabilities.ts#L429)

##### type?

```ts
optional type?: string;
```

Defined in: [packages/core/src/capabilities.ts:431](packages/core/src/capabilities.ts#L431)

***

### WebAwesomeCapability

Defined in: [packages/core/src/capabilities.ts:47](packages/core/src/capabilities.ts#L47)

Installed Web Awesome package details available to validation and code generation.

#### Properties

##### booleanAttributes

```ts
booleanAttributes: ReadonlyMap<string, ReadonlySet<string>>;
```

Defined in: [packages/core/src/capabilities.ts:58](packages/core/src/capabilities.ts#L58)

Boolean attribute names per component (keyed without the wa- prefix), from
the manifest's attribute types. Pass as `ParseWavexOptions.webAwesomeBooleanAttributes`
so bare tokens like `with-caret` on `@button` parse as boolean attributes.

##### components

```ts
components: ReadonlySet<string>;
```

Defined in: [packages/core/src/capabilities.ts:52](packages/core/src/capabilities.ts#L52)

Component names without the wa- prefix, from the package's custom-elements.json.

##### packageDir

```ts
packageDir: string;
```

Defined in: [packages/core/src/capabilities.ts:60](packages/core/src/capabilities.ts#L60)

Installed package directory (for manifest details and stylesheet scans).

##### packageName

```ts
packageName: string;
```

Defined in: [packages/core/src/capabilities.ts:49](packages/core/src/capabilities.ts#L49)

Installed package name, e.g. "@web.awesome.me/webawesome-pro" or "@awesome.me/webawesome".

##### pro

```ts
pro: boolean;
```

Defined in: [packages/core/src/capabilities.ts:50](packages/core/src/capabilities.ts#L50)

***

### WebAwesomeComponentDetail

Defined in: [packages/core/src/capabilities.ts:436](packages/core/src/capabilities.ts#L436)

Manifest metadata for one Web Awesome component.

#### Properties

##### attributes

```ts
attributes: WebAwesomeAttribute[];
```

Defined in: [packages/core/src/capabilities.ts:440](packages/core/src/capabilities.ts#L440)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/capabilities.ts:438](packages/core/src/capabilities.ts#L438)

Component name without the wa- prefix.

##### slots

```ts
slots: object[];
```

Defined in: [packages/core/src/capabilities.ts:441](packages/core/src/capabilities.ts#L441)

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

Defined in: [packages/core/src/capabilities.ts:439](packages/core/src/capabilities.ts#L439)

## Type Aliases

### ConvexFunctionKind

```ts
type ConvexFunctionKind = "query" | "mutation" | "action" | "internal" | "httpAction";
```

Defined in: [packages/core/src/capabilities.ts:85](packages/core/src/capabilities.ts#L85)

Convex function kinds relevant to client template validation.

***

### IconFolderResolver

```ts
type IconFolderResolver = (name, family, variant) => string;
```

Defined in: [packages/core/src/icons.ts:44](packages/core/src/icons.ts#L44)

Maps an icon to its Font Awesome folder — Web Awesome's own
`getIconFolder(name, family, variant)`, loaded from the installed package by
[loadWebAwesomeIconFolder](#loadwebawesomeiconfolder) so WAVEx serves exactly the URLs Web
Awesome's default icon library requests.

#### Parameters

##### name

`string`

##### family

`string`

##### variant

`string`

#### Returns

`string`

## Functions

### collectAppIcons()

```ts
function collectAppIcons(appRoot, parseOptions?): SourceIcons[];
```

Defined in: [packages/core/src/icons.ts:511](packages/core/src/icons.ts#L511)

Scan an app's `src/` for the icons it uses: `.wx` templates and preludes
([collectTemplateIcons](#collecttemplateicons)) and `icon()` declarations in
TypeScript/JavaScript files ([collectDeclaredIcons](#collectdeclaredicons)). Files without
icons or diagnostics are omitted. Pass the same parse options the compiler
uses so component heads parse identically.

#### Parameters

##### appRoot

`string`

##### parseOptions?

`Omit`\<[`ParseWavexOptions`](README.md#parsewavexoptions), `"fileName"`\> = `{}`

#### Returns

[`SourceIcons`](#sourceicons)[]

***

### collectDeclaredIcons()

```ts
function collectDeclaredIcons(source): object;
```

Defined in: [packages/core/src/icons.ts:371](packages/core/src/icons.ts#L371)

`icon("…")` declarations in TypeScript/JavaScript source that imports
`icon` from `@wavex/runtime` (named, aliased, or through a namespace
import). Declarations must use string literals for the name and for any
`family`/`variant` option so WAVEx can collect them; other calls are
reported as WX104.

#### Parameters

##### source

`string`

#### Returns

`object`

##### diagnostics

```ts
diagnostics: Diagnostic[];
```

##### icons

```ts
icons: IconReference[];
```

***

### collectTemplateIcons()

```ts
function collectTemplateIcons(file, options?): object;
```

Defined in: [packages/core/src/icons.ts:157](packages/core/src/icons.ts#L157)

Icons a parsed `.wx` file uses through Web Awesome's default icon library:
`@icon` / `@wa/icon` heads (not a local `icon.wx`, not another `library:`)
whose `name:` is a literal, plus the string literals that can be the value
of a dynamic `name:{{ … }}` expression (ternary branches, `||`/`??`
operands, the last `&&` operand — never comparison operands), with the
element's literal `family:`/`variant:`. Elements whose family or variant is
dynamic cannot be collected; declare those icons with `icon()` instead.
`icon("…")` declarations in the prelude are collected too.

#### Parameters

##### file

[`WavexFile`](README.md#wavexfile)

##### options?

###### localComponents?

readonly `string`[]

#### Returns

`object`

##### diagnostics

```ts
diagnostics: Diagnostic[];
```

##### icons

```ts
icons: IconReference[];
```

***

### convexSemanticEventTargetReference()

```ts
function convexSemanticEventTargetReference(target): string | undefined;
```

Defined in: [packages/core/src/capabilities.ts:330](packages/core/src/capabilities.ts#L330)

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

Defined in: [packages/core/src/capabilities.ts:93](packages/core/src/capabilities.ts#L93)

Detect installed Web Awesome / Font Awesome capabilities from an app root.

#### Parameters

##### root

`string`

#### Returns

[`ProjectCapabilities`](#projectcapabilities)

***

### detectFontAwesomeIconSources()

```ts
function detectFontAwesomeIconSources(
   root,
   kits,
   packages): FontAwesomeIconSource[];
```

Defined in: [packages/core/src/icons.ts:65](packages/core/src/icons.ts#L65)

Installed Font Awesome SVG sources in deterministic lookup order: kits
(sorted), then `@fortawesome/*` packages that ship an `svgs/` directory
(sorted). JS-only `*-svg-icons` packages have no SVG files and are not
sources.

#### Parameters

##### root

`string`

##### kits

readonly `string`[]

##### packages

readonly `string`[]

#### Returns

[`FontAwesomeIconSource`](#fontawesomeiconsource)[]

***

### discoverConvexFunctionKinds()

```ts
function discoverConvexFunctionKinds(root): Record<string, ConvexFunctionKind>;
```

Defined in: [packages/core/src/capabilities.ts:383](packages/core/src/capabilities.ts#L383)

Classify Convex functions by scanning the app's Convex sources
("module/path:fn" -> kind), located with [findConvexDir](#findconvexdir). Public
functions keep their concrete query/mutation/action kind; internal functions
and httpAction exports are marked as non-template-callable. Shared by the
compiler, Vite plugin, CLI, and LSP.

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

Defined in: [packages/core/src/capabilities.ts:409](packages/core/src/capabilities.ts#L409)

Local component references discovered from src/components (e.g. "talk-card", "tasks/item").

#### Parameters

##### root

`string`

#### Returns

`string`[]

***

### expressionValueLiterals()

```ts
function expressionValueLiterals(expression): string[];
```

Defined in: [packages/core/src/icons.ts:215](packages/core/src/icons.ts#L215)

String literals that can be the value of a JavaScript expression: the
expression itself when it is a literal, both ternary branches, every `||` /
`??` operand, and the last `&&` operand, recursively. Conditions and
comparison operands are never values, so `status === 'done' ? 'box' : 'truck'`
yields `box` and `truck` only.

#### Parameters

##### expression

`string`

#### Returns

`string`[]

***

### findConvexDir()

```ts
function findConvexDir(appRoot): string | undefined;
```

Defined in: [packages/core/src/capabilities.ts:352](packages/core/src/capabilities.ts#L352)

Find the Convex functions directory for a WAVEx app root.

The app root's own `convex/` wins when present (the single-package layout).
Otherwise the nearest ancestor directory whose `convex/` is a Convex project
— it has `convex/_generated` (codegen has run) or sits next to a
`convex.json` — is used, which covers monorepos where the web app is a
workspace package and Convex lives at the repository root. Returns undefined
when neither exists. Shared by the Vite plugin, CLI, and LSP so they agree
on one Convex directory.

#### Parameters

##### appRoot

`string`

#### Returns

`string` \| `undefined`

***

### iconFolder()

```ts
function iconFolder(icon, folderOf): string;
```

Defined in: [packages/core/src/icons.ts:120](packages/core/src/icons.ts#L120)

The Font Awesome folder for an icon, applying Web Awesome's family/variant defaults.

#### Parameters

##### icon

`Pick`\<[`IconReference`](#iconreference), `"name"` \| `"family"` \| `"variant"`\>

##### folderOf

[`IconFolderResolver`](#iconfolderresolver)

#### Returns

`string`

***

### isIconSourceFile()

```ts
function isIconSourceFile(fileName): boolean;
```

Defined in: [packages/core/src/icons.ts:536](packages/core/src/icons.ts#L536)

Whether a file name is one [collectAppIcons](#collectappicons) scans: a `.wx` template or a non-declaration TypeScript/JavaScript module.

#### Parameters

##### fileName

`string`

#### Returns

`boolean`

***

### loadWebAwesomeIconFolder()

```ts
function loadWebAwesomeIconFolder(webAwesomePackageDir): Promise<IconFolderResolver>;
```

Defined in: [packages/core/src/icons.ts:85](packages/core/src/icons.ts#L85)

Load Web Awesome's `getIconFolder` from the installed package
(`dist/components/icon/library.default.js`). It is the source of truth for
the folder the default icon library requests — including Pro+ families —
so WAVEx does not replicate the mapping. Throws when the installed Web
Awesome predates `setIconPath`/`getIconFolder` (3.8).

#### Parameters

##### webAwesomePackageDir

`string`

#### Returns

`Promise`\<[`IconFolderResolver`](#iconfolderresolver)\>

***

### readManifestComponentDetails()

```ts
function readManifestComponentDetails(manifestPath): Map<string, WebAwesomeComponentDetail>;
```

Defined in: [packages/core/src/capabilities.ts:445](packages/core/src/capabilities.ts#L445)

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

Defined in: [packages/core/src/capabilities.ts:169](packages/core/src/capabilities.ts#L169)

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

Defined in: [packages/core/src/capabilities.ts:489](packages/core/src/capabilities.ts#L489)

Utility class suffixes (wa-stack -> "stack") scraped from the installed package's stylesheets.

#### Parameters

##### packageDir

`string`

#### Returns

`string`[]

***

### readWebAwesomeDefaultLibraryIcons()

```ts
function readWebAwesomeDefaultLibraryIcons(webAwesomePackageDir): Pick<IconReference, "name" | "family" | "variant">[];
```

Defined in: [packages/core/src/icons.ts:553](packages/core/src/icons.ts#L553)

Icons Web Awesome's own components request from the default icon library
(for example `<wa-page>`'s `bars` navigation toggle): literal
`<wa-icon name="…">` tags without a `library` attribute in the installed
package's bundled component code. Setting an icon path redirects these too,
so a self-hosting app must serve them alongside its own icons.

#### Parameters

##### webAwesomePackageDir

`string`

#### Returns

`Pick`\<[`IconReference`](#iconreference), `"name"` \| `"family"` \| `"variant"`\>[]

***

### resolveIconAsset()

```ts
function resolveIconAsset(
   icon,
   folderOf,
   sources): IconAsset | undefined;
```

Defined in: [packages/core/src/icons.ts:105](packages/core/src/icons.ts#L105)

Resolve an icon to its SVG file: the first icon source that has `<folder>/<name>.svg`.

#### Parameters

##### icon

`Pick`\<[`IconReference`](#iconreference), `"name"` \| `"family"` \| `"variant"`\>

##### folderOf

[`IconFolderResolver`](#iconfolderresolver)

##### sources

readonly [`FontAwesomeIconSource`](#fontawesomeiconsource)[]

#### Returns

[`IconAsset`](#iconasset) \| `undefined`

***

### validateComponentReferences()

```ts
function validateComponentReferences(file, options): Diagnostic[];
```

Defined in: [packages/core/src/capabilities.ts:200](packages/core/src/capabilities.ts#L200)

Capability diagnostics for component/icon references in a parsed .wx file.
Unknown components are WX101 errors; `@icon` gets a WX101 info note when no
installed Font Awesome package ships SVG files, because Web Awesome then
loads icons from the Font Awesome CDN and WAVEx cannot validate names.

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

Defined in: [packages/core/src/capabilities.ts:264](packages/core/src/capabilities.ts#L264)

Capability diagnostics for Convex references and bare $$ resource bindings.

#### Parameters

##### file

[`WavexFile`](README.md#wavexfile)

##### options

[`ConvexValidationOptions`](#convexvalidationoptions)

#### Returns

[`Diagnostic`](README.md#diagnostic)[]

***

### validateIconReferences()

```ts
function validateIconReferences(
   icons,
   folderOf,
   sources): Diagnostic[];
```

Defined in: [packages/core/src/icons.ts:125](packages/core/src/icons.ts#L125)

WX103 diagnostics for icons that no installed Font Awesome source provides.

#### Parameters

##### icons

readonly [`IconReference`](#iconreference)[]

##### folderOf

[`IconFolderResolver`](#iconfolderresolver)

##### sources

readonly [`FontAwesomeIconSource`](#fontawesomeiconsource)[]

#### Returns

[`Diagnostic`](README.md#diagnostic)[]

***

### walkTemplateNodes()

```ts
function walkTemplateNodes(nodes, visit): void;
```

Defined in: [packages/core/src/capabilities.ts:180](packages/core/src/capabilities.ts#L180)

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

Defined in: [packages/core/src/capabilities.ts:471](packages/core/src/capabilities.ts#L471)

Boolean attribute names per Web Awesome component (keyed without the wa-
prefix): attributes whose manifest type is `boolean` (optionally unioned
with `undefined`/`null`). Components without boolean attributes are omitted.

#### Parameters

##### details

`ReadonlyMap`\<`string`, [`WebAwesomeComponentDetail`](#webawesomecomponentdetail)\>

#### Returns

`Map`\<`string`, `ReadonlySet`\<`string`\>\>
