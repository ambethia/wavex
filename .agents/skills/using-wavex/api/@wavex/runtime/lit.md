# lit

Lit renderer backend for the WAVEx runtime.

Lit is an implementation detail here, not the app authoring model: compiled
`.wx` render modules call this adapter, and Lit handles DOM patching,
property/attribute updates, and keyed list identity (preserving focus
across rerenders). Reusing Lit instead of a bespoke renderer is a core
decision — Web Awesome already depends on Lit, so the dependency is shared
and deduped through the app bundle.

Import from `@wavex/runtime/lit`.

## Interfaces

### LitApp

Defined in: [packages/runtime/src/lit.ts:95](packages/runtime/src/lit.ts#L95)

A mounted WAVEx Lit app with its router and initial-navigation lifecycle.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### mount

```ts
mount: LitMount<Result>;
```

Defined in: [packages/runtime/src/lit.ts:96](packages/runtime/src/lit.ts#L96)

##### ready

```ts
ready: Promise<void>;
```

Defined in: [packages/runtime/src/lit.ts:99](packages/runtime/src/lit.ts#L99)

Settles after the initial route has loaded and committed.

##### router

```ts
router: ClientRouter;
```

Defined in: [packages/runtime/src/lit.ts:97](packages/runtime/src/lit.ts#L97)

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/lit.ts:103](packages/runtime/src/lit.ts#L103)

Dispose the router, mount, and caller lifecycle hook. Idempotent.

###### Returns

`void`

##### update()

```ts
update(nextContext): void;
```

Defined in: [packages/runtime/src/lit.ts:101](packages/runtime/src/lit.ts#L101)

Merge app-owned context and rerender without remounting the app.

###### Parameters

###### nextContext

[`RenderContext`](README.md#rendercontext)

###### Returns

`void`

***

### LitAppOptions

Defined in: [packages/runtime/src/lit.ts:81](packages/runtime/src/lit.ts#L81)

Options for composing a Lit mount with the WAVEx client router.

#### Extends

- [`LitMountOptions`](#litmountoptions).`Omit`\<[`ClientRouterOptions`](README.md#clientrouteroptions), `"routes"` \| `"host"`\>

#### Properties

##### actionClient?

```ts
optional actionClient?: ActionClient;
```

Defined in: [packages/runtime/src/lit.ts:46](packages/runtime/src/lit.ts#L46)

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`actionClient`](#actionclient-1)

##### analytics?

```ts
optional analytics?: AnalyticsClient;
```

Defined in: [packages/runtime/src/lit.ts:48](packages/runtime/src/lit.ts#L48)

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`analytics`](#analytics-1)

##### initialContext?

```ts
optional initialContext?: RenderContext;
```

Defined in: [packages/runtime/src/lit.ts:87](packages/runtime/src/lit.ts#L87)

App-owned context available to the first route render.

##### initialPath?

```ts
optional initialPath?: string;
```

Defined in: [packages/runtime/src/lit.ts:89](packages/runtime/src/lit.ts#L89)

Initial URL passed to the router (defaults to the current path and query).

##### notFound?

```ts
optional notFound?: RenderFunction;
```

Defined in: [packages/runtime/src/router.ts:97](packages/runtime/src/router.ts#L97)

Render function used when no route matches the current path.

###### Inherited from

[`ClientRouterOptions`](README.md#clientrouteroptions).[`notFound`](README.md#notfound)

##### onDispose?

```ts
optional onDispose?: () => void;
```

Defined in: [packages/runtime/src/lit.ts:91](packages/runtime/src/lit.ts#L91)

Called exactly once when the composed app is disposed; use it for caller-owned clients.

###### Returns

`void`

##### onNavigate?

```ts
optional onNavigate?: (route) => void;
```

Defined in: [packages/runtime/src/router.ts:111](packages/runtime/src/router.ts#L111)

###### Parameters

###### route

[`RouteContext`](README.md#routecontext)

###### Returns

`void`

###### Inherited from

[`ClientRouterOptions`](README.md#clientrouteroptions).[`onNavigate`](README.md#onnavigate)

##### onUnhandledAction?

```ts
optional onUnhandledAction?: (event) => void;
```

Defined in: [packages/runtime/src/lit.ts:50](packages/runtime/src/lit.ts#L50)

Override the runtime diagnostic for a semantic target with no local or app handler.

###### Parameters

###### event

[`WavexActionEvent`](README.md#wavexactionevent)

###### Returns

`void`

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`onUnhandledAction`](#onunhandledaction-1)

##### resolveActionKind?

```ts
optional resolveActionKind?: ActionKindResolver;
```

Defined in: [packages/runtime/src/lit.ts:47](packages/runtime/src/lit.ts#L47)

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`resolveActionKind`](#resolveactionkind-1)

##### resourceClient?

```ts
optional resourceClient?: ResourceClient;
```

Defined in: [packages/runtime/src/lit.ts:45](packages/runtime/src/lit.ts#L45)

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`resourceClient`](#resourceclient-1)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/lit.ts:44](packages/runtime/src/lit.ts#L44)

###### Inherited from

[`LitMountOptions`](#litmountoptions).[`resources`](#resources-1)

##### root?

```ts
optional root?: HTMLElement;
```

Defined in: [packages/runtime/src/lit.ts:85](packages/runtime/src/lit.ts#L85)

Mount target (defaults to `document.body`).

##### routes

```ts
routes: readonly ClientRoute[];
```

Defined in: [packages/runtime/src/lit.ts:83](packages/runtime/src/lit.ts#L83)

File-convention routes, normally imported from `virtual:wavex/routes`.

##### scrollRestoration?

```ts
optional scrollRestoration?:
  | false
  | ClientRouterScrollOptions;
```

Defined in: [packages/runtime/src/router.ts:109](packages/runtime/src/router.ts#L109)

Reset push/replace navigations to the top and restore history offsets
after page commits. Pass false to leave all scrolling to the app/browser,
or provide custom seams for a scroll container.

###### Inherited from

[`ClientRouterOptions`](README.md#clientrouteroptions).[`scrollRestoration`](README.md#scrollrestoration)

##### viewTransitions?

```ts
optional viewTransitions?: boolean;
```

Defined in: [packages/runtime/src/router.ts:103](packages/runtime/src/router.ts#L103)

Wrap navigation commits in `document.startViewTransition` (default true).
Automatically skipped when unsupported, under `prefers-reduced-motion`,
and on the initial load; HMR swaps never transition.

###### Inherited from

[`ClientRouterOptions`](README.md#clientrouteroptions).[`viewTransitions`](README.md#viewtransitions)

##### window?

```ts
optional window?: Window;
```

Defined in: [packages/runtime/src/router.ts:110](packages/runtime/src/router.ts#L110)

###### Inherited from

[`ClientRouterOptions`](README.md#clientrouteroptions).[`window`](README.md#window)

***

### LitMount

Defined in: [packages/runtime/src/lit.ts:61](packages/runtime/src/lit.ts#L61)

A live mounted page: the router and HMR drive it through `setPage`/`setRender`/`update`.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### context

```ts
context: RenderContext;
```

Defined in: [packages/runtime/src/lit.ts:62](packages/runtime/src/lit.ts#L62)

##### result?

```ts
optional result?: Result;
```

Defined in: [packages/runtime/src/lit.ts:77](packages/runtime/src/lit.ts#L77)

##### root

```ts
root: HTMLElement;
```

Defined in: [packages/runtime/src/lit.ts:76](packages/runtime/src/lit.ts#L76)

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/lit.ts:75](packages/runtime/src/lit.ts#L75)

###### Returns

`void`

##### setNavigation()

```ts
setNavigation(navigation): void;
```

Defined in: [packages/runtime/src/lit.ts:74](packages/runtime/src/lit.ts#L74)

Navigation lifecycle from the client router; rerenders so `+if navigation.pending` UI updates.

###### Parameters

###### navigation

[`NavigationState`](README.md#navigationstate)

###### Returns

`void`

##### setPage()

```ts
setPage(page): void;
```

Defined in: [packages/runtime/src/lit.ts:67](packages/runtime/src/lit.ts#L67)

Atomically swap render, resources, route, and head in a single update (used by the client router).

###### Parameters

###### page

###### head?

(`context?`) => [`HeadEntry`](README.md#headentry)[]

###### render

[`RenderFunction`](README.md#renderfunction)\<`Result`\>

###### resources

readonly [`ResourceDefinition`](README.md#resourcedefinition)\<`unknown`\>[]

###### route

[`RouteContext`](README.md#routecontext)

###### Returns

`void`

##### setRender()

```ts
setRender(nextRender): void;
```

Defined in: [packages/runtime/src/lit.ts:64](packages/runtime/src/lit.ts#L64)

###### Parameters

###### nextRender

[`RenderFunction`](README.md#renderfunction)\<`Result`\>

###### Returns

`void`

##### setResources()

```ts
setResources(nextResources): void;
```

Defined in: [packages/runtime/src/lit.ts:65](packages/runtime/src/lit.ts#L65)

###### Parameters

###### nextResources

readonly [`ResourceDefinition`](README.md#resourcedefinition)\<`unknown`\>[]

###### Returns

`void`

##### update()

```ts
update(nextContext?): void;
```

Defined in: [packages/runtime/src/lit.ts:63](packages/runtime/src/lit.ts#L63)

###### Parameters

###### nextContext?

[`RenderContext`](README.md#rendercontext)

###### Returns

`void`

***

### LitMountOptions

Defined in: [packages/runtime/src/lit.ts:43](packages/runtime/src/lit.ts#L43)

Clients and resources wired into a mount; omit clients in tests to render without a backend.

#### Extended by

- [`LitAppOptions`](#litappoptions)

#### Properties

##### actionClient?

```ts
optional actionClient?: ActionClient;
```

Defined in: [packages/runtime/src/lit.ts:46](packages/runtime/src/lit.ts#L46)

##### analytics?

```ts
optional analytics?: AnalyticsClient;
```

Defined in: [packages/runtime/src/lit.ts:48](packages/runtime/src/lit.ts#L48)

##### onUnhandledAction?

```ts
optional onUnhandledAction?: (event) => void;
```

Defined in: [packages/runtime/src/lit.ts:50](packages/runtime/src/lit.ts#L50)

Override the runtime diagnostic for a semantic target with no local or app handler.

###### Parameters

###### event

[`WavexActionEvent`](README.md#wavexactionevent)

###### Returns

`void`

##### resolveActionKind?

```ts
optional resolveActionKind?: ActionKindResolver;
```

Defined in: [packages/runtime/src/lit.ts:47](packages/runtime/src/lit.ts#L47)

##### resourceClient?

```ts
optional resourceClient?: ResourceClient;
```

Defined in: [packages/runtime/src/lit.ts:45](packages/runtime/src/lit.ts#L45)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/lit.ts:44](packages/runtime/src/lit.ts#L44)

***

### WavexPageModule

Defined in: [packages/runtime/src/lit.ts:54](packages/runtime/src/lit.ts#L54)

The exports of a compiled `.wx` page module, as loaded by the bootstrap/router.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### default?

```ts
optional default?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/lit.ts:55](packages/runtime/src/lit.ts#L55)

##### render?

```ts
optional render?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/lit.ts:56](packages/runtime/src/lit.ts#L56)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/lit.ts:57](packages/runtime/src/lit.ts#L57)

## Functions

### mountLit()

```ts
function mountLit<Result>(
   root,
   render,
   initialContext?,
options?): LitMount<Result>;
```

Defined in: [packages/runtime/src/lit.ts:113](packages/runtime/src/lit.ts#L113)

Mount a render function into a root element with the full runtime wired up:
resource subscriptions (rerendering on every value/state change), semantic
event delegation, action lifecycle rerenders, and `+head` application.
Updates are batched per microtask; Lit patches the DOM in place, so node
identity and focus survive rerenders.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Parameters

##### root

`HTMLElement`

##### render

[`RenderFunction`](README.md#renderfunction)\<`Result`\>

##### initialContext?

[`RenderContext`](README.md#rendercontext) = `{}`

##### options?

[`LitMountOptions`](#litmountoptions) = `{}`

#### Returns

[`LitMount`](#litmount)\<`Result`\>

***

### mountLitApp()

```ts
function mountLitApp<Result>(options): LitApp<Result>;
```

Defined in: [packages/runtime/src/lit.ts:240](packages/runtime/src/lit.ts#L240)

Compose [mountLit](#mountlit) and the client router for an app-owned entry module.

WAVEx owns the mount/router lifecycle while clients and app context remain
caller-owned. This is the customization seam for authentication, analytics,
and other startup concerns that must run before the first route renders.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Parameters

##### options

[`LitAppOptions`](#litappoptions)

#### Returns

[`LitApp`](#litapp)\<`Result`\>

***

### mountLitPage()

```ts
function mountLitPage<Result>(
   root,
   pageModule,
   initialContext?,
options?): LitMount<Result>;
```

Defined in: [packages/runtime/src/lit.ts:292](packages/runtime/src/lit.ts#L292)

Mount a compiled `.wx` page module (render export + inferred resources) — the bootstrap entry point.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Parameters

##### root

`HTMLElement`

##### pageModule

[`WavexPageModule`](#wavexpagemodule)\<`Result`\>

##### initialContext?

[`RenderContext`](README.md#rendercontext) = `{}`

##### options?

[`LitMountOptions`](#litmountoptions) = `{}`

#### Returns

[`LitMount`](#litmount)\<`Result`\>
