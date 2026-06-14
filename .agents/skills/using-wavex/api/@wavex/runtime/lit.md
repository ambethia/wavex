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

### LitMount

Defined in: [packages/runtime/src/lit.ts:52](packages/runtime/src/lit.ts#L52)

A live mounted page: the router and HMR drive it through `setPage`/`setRender`/`update`.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### context

```ts
context: RenderContext;
```

Defined in: [packages/runtime/src/lit.ts:53](packages/runtime/src/lit.ts#L53)

##### result?

```ts
optional result?: Result;
```

Defined in: [packages/runtime/src/lit.ts:68](packages/runtime/src/lit.ts#L68)

##### root

```ts
root: HTMLElement;
```

Defined in: [packages/runtime/src/lit.ts:67](packages/runtime/src/lit.ts#L67)

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/lit.ts:66](packages/runtime/src/lit.ts#L66)

###### Returns

`void`

##### setNavigation()

```ts
setNavigation(navigation): void;
```

Defined in: [packages/runtime/src/lit.ts:65](packages/runtime/src/lit.ts#L65)

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

Defined in: [packages/runtime/src/lit.ts:58](packages/runtime/src/lit.ts#L58)

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

Defined in: [packages/runtime/src/lit.ts:55](packages/runtime/src/lit.ts#L55)

###### Parameters

###### nextRender

[`RenderFunction`](README.md#renderfunction)\<`Result`\>

###### Returns

`void`

##### setResources()

```ts
setResources(nextResources): void;
```

Defined in: [packages/runtime/src/lit.ts:56](packages/runtime/src/lit.ts#L56)

###### Parameters

###### nextResources

readonly [`ResourceDefinition`](README.md#resourcedefinition)\<`unknown`\>[]

###### Returns

`void`

##### update()

```ts
update(nextContext?): void;
```

Defined in: [packages/runtime/src/lit.ts:54](packages/runtime/src/lit.ts#L54)

###### Parameters

###### nextContext?

[`RenderContext`](README.md#rendercontext)

###### Returns

`void`

***

### LitMountOptions

Defined in: [packages/runtime/src/lit.ts:36](packages/runtime/src/lit.ts#L36)

Clients and resources wired into a mount; omit clients in tests to render without a backend.

#### Properties

##### actionClient?

```ts
optional actionClient?: ActionClient;
```

Defined in: [packages/runtime/src/lit.ts:39](packages/runtime/src/lit.ts#L39)

##### analytics?

```ts
optional analytics?: AnalyticsClient;
```

Defined in: [packages/runtime/src/lit.ts:41](packages/runtime/src/lit.ts#L41)

##### resolveActionKind?

```ts
optional resolveActionKind?: ActionKindResolver;
```

Defined in: [packages/runtime/src/lit.ts:40](packages/runtime/src/lit.ts#L40)

##### resourceClient?

```ts
optional resourceClient?: ResourceClient;
```

Defined in: [packages/runtime/src/lit.ts:38](packages/runtime/src/lit.ts#L38)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/lit.ts:37](packages/runtime/src/lit.ts#L37)

***

### WavexPageModule

Defined in: [packages/runtime/src/lit.ts:45](packages/runtime/src/lit.ts#L45)

The exports of a compiled `.wx` page module, as loaded by the bootstrap/router.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### default?

```ts
optional default?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/lit.ts:46](packages/runtime/src/lit.ts#L46)

##### render?

```ts
optional render?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/lit.ts:47](packages/runtime/src/lit.ts#L47)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/lit.ts:48](packages/runtime/src/lit.ts#L48)

## Functions

### mountLit()

```ts
function mountLit<Result>(
   root, 
   render, 
   initialContext?, 
options?): LitMount<Result>;
```

Defined in: [packages/runtime/src/lit.ts:78](packages/runtime/src/lit.ts#L78)

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

### mountLitPage()

```ts
function mountLitPage<Result>(
   root, 
   pageModule, 
   initialContext?, 
options?): LitMount<Result>;
```

Defined in: [packages/runtime/src/lit.ts:200](packages/runtime/src/lit.ts#L200)

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
