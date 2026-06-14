# @wavex/runtime

Browser runtime for WAVEx apps: routing, resource lifecycle, the Convex
bridge, mutation/action state, head management, error boundaries, and
analytics.

The split of responsibilities is deliberate: WAVEx owns resources, routing,
actions, head, and analytics, while the renderer backend (see
`@wavex/runtime/lit`) owns low-level DOM patching and keyed list identity.
Apps are client-side by default — prerendered HTML is an output
optimization, and Convex realtime subscriptions start after boot.

The Convex bridge wraps the official Convex browser client behind the
[ResourceClient](#resourceclient) and [ActionClient](#actionclient) interfaces: `$$module:fn`
query bindings become live route-scoped subscriptions (torn down on
navigation), and mutations/actions dispatch through the client with
explicit pending/error lifecycle state ([ActionState](#actionstate)) for templates.

## Interfaces

### ActionClient

Defined in: [packages/runtime/src/index.ts:163](packages/runtime/src/index.ts#L163)

Dispatch seam for mutations/actions; wraps the Convex client in production ([createConvexActionClient](#createconvexactionclient)).

#### Methods

##### invoke()

```ts
invoke(definition): Promise<unknown>;
```

Defined in: [packages/runtime/src/index.ts:164](packages/runtime/src/index.ts#L164)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### Returns

`Promise`\<`unknown`\>

***

### ActionDefinition

Defined in: [packages/runtime/src/index.ts:144](packages/runtime/src/index.ts#L144)

A `$$module:fn` mutation/action target parsed from a semantic event attribute.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args?

```ts
optional args?: TArgs;
```

Defined in: [packages/runtime/src/index.ts:150](packages/runtime/src/index.ts#L150)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:147](packages/runtime/src/index.ts#L147)

##### kind?

```ts
optional kind?: "mutation" | "action";
```

Defined in: [packages/runtime/src/index.ts:149](packages/runtime/src/index.ts#L149)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:146](packages/runtime/src/index.ts#L146)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:148](packages/runtime/src/index.ts#L148)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:145](packages/runtime/src/index.ts#L145)

***

### ActionState

Defined in: [packages/runtime/src/index.ts:44](packages/runtime/src/index.ts#L44)

Current state of one semantic action target (mutation or Convex action).

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### error?

```ts
optional error?: unknown;
```

Defined in: [packages/runtime/src/index.ts:48](packages/runtime/src/index.ts#L48)

##### pending

```ts
pending: boolean;
```

Defined in: [packages/runtime/src/index.ts:46](packages/runtime/src/index.ts#L46)

##### result?

```ts
optional result?: T;
```

Defined in: [packages/runtime/src/index.ts:47](packages/runtime/src/index.ts#L47)

##### status

```ts
status: ActionLifecycleStatus;
```

Defined in: [packages/runtime/src/index.ts:45](packages/runtime/src/index.ts#L45)

##### updatedAt?

```ts
optional updatedAt?: number;
```

Defined in: [packages/runtime/src/index.ts:49](packages/runtime/src/index.ts#L49)

***

### AnalyticsClient

Defined in: [packages/runtime/src/analytics.ts:1](packages/runtime/src/analytics.ts#L1)

#### Methods

##### capture()

```ts
capture(event, properties?): void;
```

Defined in: [packages/runtime/src/analytics.ts:2](packages/runtime/src/analytics.ts#L2)

###### Parameters

###### event

`string`

###### properties?

`Record`\<`string`, `unknown`\>

###### Returns

`void`

***

### ClientRoute

Defined in: [packages/runtime/src/router.ts:18](packages/runtime/src/router.ts#L18)

A file-derived route: `src/pages/tasks/[id].wx` → `/tasks/:id`.

#### Extends

- [`RouteDefinition`](../core/README.md#routedefinition)

#### Properties

##### errors?

```ts
optional errors?: readonly object[];
```

Defined in: [packages/runtime/src/router.ts:23](packages/runtime/src/router.ts#L23)

+error.wx modules, outermost first; the deepest one handles route errors.

##### file

```ts
file: string;
```

Defined in: [packages/core/dist/model.d.ts:16](packages/core/dist/model.d.ts#L16)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`file`](../core/README.md#file)

##### id

```ts
id: string;
```

Defined in: [packages/core/dist/model.d.ts:15](packages/core/dist/model.d.ts#L15)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`id`](../core/README.md#id)

##### layouts?

```ts
optional layouts?: readonly object[];
```

Defined in: [packages/runtime/src/router.ts:21](packages/runtime/src/router.ts#L21)

Layout modules, outermost first (src/pages/+layout.wx, then nested).

##### load

```ts
load: () => Promise<RoutePageModule<unknown>>;
```

Defined in: [packages/runtime/src/router.ts:19](packages/runtime/src/router.ts#L19)

###### Returns

`Promise`\<[`RoutePageModule`](#routepagemodule)\<`unknown`\>\>

##### path

```ts
path: string;
```

Defined in: [packages/core/dist/model.d.ts:17](packages/core/dist/model.d.ts#L17)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`path`](../core/README.md#path)

##### segments

```ts
segments: RouteSegment[];
```

Defined in: [packages/core/dist/model.d.ts:18](packages/core/dist/model.d.ts#L18)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`segments`](../core/README.md#segments)

***

### ClientRouter

Defined in: [packages/runtime/src/router.ts:92](packages/runtime/src/router.ts#L92)

#### Properties

##### current?

```ts
optional current?: object;
```

Defined in: [packages/runtime/src/router.ts:96](packages/runtime/src/router.ts#L96)

###### file?

```ts
optional file?: string;
```

###### route

```ts
route: RouteContext;
```

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/router.ts:97](packages/runtime/src/router.ts#L97)

###### Returns

`void`

##### hotReplacePage()

```ts
hotReplacePage(file, module): void;
```

Defined in: [packages/runtime/src/router.ts:95](packages/runtime/src/router.ts#L95)

Swap the module for a route or layout file in place (HMR), keeping route state.

###### Parameters

###### file

`string`

###### module

[`RoutePageModule`](#routepagemodule)

###### Returns

`void`

##### navigate()

```ts
navigate(to, options?): Promise<void>;
```

Defined in: [packages/runtime/src/router.ts:93](packages/runtime/src/router.ts#L93)

###### Parameters

###### to

`string`

###### options?

###### replace?

`boolean`

###### Returns

`Promise`\<`void`\>

***

### ClientRouterOptions

Defined in: [packages/runtime/src/router.ts:77](packages/runtime/src/router.ts#L77)

#### Properties

##### host

```ts
host: RouterPageHost;
```

Defined in: [packages/runtime/src/router.ts:79](packages/runtime/src/router.ts#L79)

##### notFound?

```ts
optional notFound?: RenderFunction;
```

Defined in: [packages/runtime/src/router.ts:81](packages/runtime/src/router.ts#L81)

Render function used when no route matches the current path.

##### onNavigate?

```ts
optional onNavigate?: (route) => void;
```

Defined in: [packages/runtime/src/router.ts:89](packages/runtime/src/router.ts#L89)

###### Parameters

###### route

[`RouteContext`](#routecontext)

###### Returns

`void`

##### routes

```ts
routes: readonly ClientRoute[];
```

Defined in: [packages/runtime/src/router.ts:78](packages/runtime/src/router.ts#L78)

##### viewTransitions?

```ts
optional viewTransitions?: boolean;
```

Defined in: [packages/runtime/src/router.ts:87](packages/runtime/src/router.ts#L87)

Wrap navigation commits in `document.startViewTransition` (default true).
Automatically skipped when unsupported, under `prefers-reduced-motion`,
and on the initial load; HMR swaps never transition.

##### window?

```ts
optional window?: Window;
```

Defined in: [packages/runtime/src/router.ts:88](packages/runtime/src/router.ts#L88)

***

### ConvexActionClientLike

Defined in: [packages/runtime/src/index.ts:196](packages/runtime/src/index.ts#L196)

Structural slice of the Convex client used for mutations and actions.

#### Methods

##### action()

```ts
action(action, args): Promise<unknown>;
```

Defined in: [packages/runtime/src/index.ts:198](packages/runtime/src/index.ts#L198)

###### Parameters

###### action

`unknown`

###### args

`Record`\<`string`, `unknown`\>

###### Returns

`Promise`\<`unknown`\>

##### mutation()

```ts
mutation(mutation, args): Promise<unknown>;
```

Defined in: [packages/runtime/src/index.ts:197](packages/runtime/src/index.ts#L197)

###### Parameters

###### mutation

`unknown`

###### args

`Record`\<`string`, `unknown`\>

###### Returns

`Promise`\<`unknown`\>

***

### ConvexActionClientOptions

Defined in: [packages/runtime/src/index.ts:206](packages/runtime/src/index.ts#L206)

#### Properties

##### api?

```ts
optional api?: unknown;
```

Defined in: [packages/runtime/src/index.ts:207](packages/runtime/src/index.ts#L207)

##### resolveFunction?

```ts
optional resolveFunction?: (definition) => unknown;
```

Defined in: [packages/runtime/src/index.ts:208](packages/runtime/src/index.ts#L208)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### Returns

`unknown`

***

### ConvexBrowserClientLike

Defined in: [packages/runtime/src/index.ts:186](packages/runtime/src/index.ts#L186)

Structural slice of the official Convex browser client the runtime depends on (subscriptions).

#### Methods

##### onUpdate()

```ts
onUpdate(
   query, 
   args, 
   callback, 
   onError?): ResourceTeardown;
```

Defined in: [packages/runtime/src/index.ts:187](packages/runtime/src/index.ts#L187)

###### Parameters

###### query

`unknown`

###### args

`Record`\<`string`, `unknown`\>

###### callback

(`result`) => `unknown`

###### onError?

(`error`) => `unknown`

###### Returns

[`ResourceTeardown`](#resourceteardown)

***

### ConvexResourceClientOptions

Defined in: [packages/runtime/src/index.ts:201](packages/runtime/src/index.ts#L201)

#### Properties

##### api?

```ts
optional api?: unknown;
```

Defined in: [packages/runtime/src/index.ts:202](packages/runtime/src/index.ts#L202)

##### resolveFunction?

```ts
optional resolveFunction?: (definition) => unknown;
```

Defined in: [packages/runtime/src/index.ts:203](packages/runtime/src/index.ts#L203)

###### Parameters

###### definition

[`ResolvedResourceDefinition`](#resolvedresourcedefinition)

###### Returns

`unknown`

***

### HeadEntry

Defined in: [packages/runtime/src/index.ts:221](packages/runtime/src/index.ts#L221)

One managed head node from a `+head` directive (title, meta, or link).

#### Properties

##### attributes?

```ts
optional attributes?: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:224](packages/runtime/src/index.ts#L224)

##### tag

```ts
tag: "title" | "meta" | "link";
```

Defined in: [packages/runtime/src/index.ts:222](packages/runtime/src/index.ts#L222)

##### text?

```ts
optional text?: string;
```

Defined in: [packages/runtime/src/index.ts:223](packages/runtime/src/index.ts#L223)

***

### NavigationState

Defined in: [packages/runtime/src/index.ts:79](packages/runtime/src/index.ts#L79)

The client router's navigation lifecycle, exposed declaratively in template
context. Render an nprogress-style indicator with `+if navigation.pending`;
the router also mirrors this onto `<html data-wx-navigating>` for CSS-only
indicators.

#### Properties

##### pending

```ts
pending: boolean;
```

Defined in: [packages/runtime/src/index.ts:80](packages/runtime/src/index.ts#L80)

##### to?

```ts
optional to?: RouteContext;
```

Defined in: [packages/runtime/src/index.ts:82](packages/runtime/src/index.ts#L82)

The destination route while a navigation is pending.

***

### PostHogCaptureOptions

Defined in: [packages/runtime/src/analytics.ts:5](packages/runtime/src/analytics.ts#L5)

#### Properties

##### apiKey

```ts
apiKey: string;
```

Defined in: [packages/runtime/src/analytics.ts:6](packages/runtime/src/analytics.ts#L6)

##### fetchFn?

```ts
optional fetchFn?: (input, init?) => Promise<Response>;
```

Defined in: [packages/runtime/src/analytics.ts:9](packages/runtime/src/analytics.ts#L9)

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### host?

```ts
optional host?: string;
```

Defined in: [packages/runtime/src/analytics.ts:8](packages/runtime/src/analytics.ts#L8)

PostHog instance origin, default https://us.i.posthog.com

##### storage?

```ts
optional storage?: Pick<Storage, "getItem" | "setItem">;
```

Defined in: [packages/runtime/src/analytics.ts:10](packages/runtime/src/analytics.ts#L10)

***

### RenderContext

Defined in: [packages/runtime/src/index.ts:58](packages/runtime/src/index.ts#L58)

Everything a compiled render function can see: the route, component attrs,
local state, live resource values and their lifecycle states, action
states, projected slot content, and the semantic action dispatcher.
Compiled `.wx` modules read from this; the runtime owns writing to it.

#### Properties

##### actionStates?

```ts
optional actionStates?: Record<string, ActionState<unknown>>;
```

Defined in: [packages/runtime/src/index.ts:65](packages/runtime/src/index.ts#L65)

##### attrs?

```ts
optional attrs?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:61](packages/runtime/src/index.ts#L61)

Component attributes (and the route error for +error.wx pages).

##### dispatch?

```ts
optional dispatch?: (event) => void | Promise<void>;
```

Defined in: [packages/runtime/src/index.ts:70](packages/runtime/src/index.ts#L70)

###### Parameters

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void` \| `Promise`\<`void`\>

##### navigation?

```ts
optional navigation?: NavigationState;
```

Defined in: [packages/runtime/src/index.ts:67](packages/runtime/src/index.ts#L67)

Client navigation lifecycle — `navigation.pending` while a route loads.

##### resources?

```ts
optional resources?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:63](packages/runtime/src/index.ts#L63)

##### resourceStates?

```ts
optional resourceStates?: Record<string, ResourceState<unknown>>;
```

Defined in: [packages/runtime/src/index.ts:64](packages/runtime/src/index.ts#L64)

##### route?

```ts
optional route?: RouteContext;
```

Defined in: [packages/runtime/src/index.ts:59](packages/runtime/src/index.ts#L59)

##### slots?

```ts
optional slots?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:69](packages/runtime/src/index.ts#L69)

Slot content projected into layouts and local components (semantic slot composition).

##### state?

```ts
optional state?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:62](packages/runtime/src/index.ts#L62)

***

### ResolvedActionDefinition

Defined in: [packages/runtime/src/index.ts:153](packages/runtime/src/index.ts#L153)

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args

```ts
args: TArgs;
```

Defined in: [packages/runtime/src/index.ts:159](packages/runtime/src/index.ts#L159)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:156](packages/runtime/src/index.ts#L156)

##### kind

```ts
kind: "mutation" | "action";
```

Defined in: [packages/runtime/src/index.ts:158](packages/runtime/src/index.ts#L158)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:155](packages/runtime/src/index.ts#L155)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:157](packages/runtime/src/index.ts#L157)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:154](packages/runtime/src/index.ts#L154)

***

### ResolvedResourceDefinition

Defined in: [packages/runtime/src/index.ts:103](packages/runtime/src/index.ts#L103)

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args

```ts
args: TArgs;
```

Defined in: [packages/runtime/src/index.ts:109](packages/runtime/src/index.ts#L109)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:106](packages/runtime/src/index.ts#L106)

##### kind

```ts
kind: "query";
```

Defined in: [packages/runtime/src/index.ts:108](packages/runtime/src/index.ts#L108)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:105](packages/runtime/src/index.ts#L105)

##### name

```ts
name: string;
```

Defined in: [packages/runtime/src/index.ts:104](packages/runtime/src/index.ts#L104)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:107](packages/runtime/src/index.ts#L107)

***

### ResourceClient

Defined in: [packages/runtime/src/index.ts:125](packages/runtime/src/index.ts#L125)

The subscription seam between the runtime and a realtime backend. The real
implementation wraps the official Convex browser client
([createConvexResourceClient](#createconvexresourceclient)); tests use fake clients — runtime
behavior is deliberately testable without a live deployment.

#### Methods

##### subscribe()

```ts
subscribe<T>(definition, handlers): ResourceTeardown;
```

Defined in: [packages/runtime/src/index.ts:126](packages/runtime/src/index.ts#L126)

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### definition

[`ResolvedResourceDefinition`](#resolvedresourcedefinition)

###### handlers

[`ResourceSubscriptionHandlers`](#resourcesubscriptionhandlers)\<`T`\>

###### Returns

[`ResourceTeardown`](#resourceteardown)

***

### ResourceController

Defined in: [packages/runtime/src/index.ts:133](packages/runtime/src/index.ts#L133)

Manages the live subscriptions for a mounted page; `update` diffs definitions, `dispose` tears all down.

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/index.ts:135](packages/runtime/src/index.ts#L135)

###### Returns

`void`

##### update()

```ts
update(nextDefinitions?): void;
```

Defined in: [packages/runtime/src/index.ts:134](packages/runtime/src/index.ts#L134)

###### Parameters

###### nextDefinitions?

readonly [`ResourceDefinition`](#resourcedefinition)\<`unknown`\>[]

###### Returns

`void`

***

### ResourceControllerOptions

Defined in: [packages/runtime/src/index.ts:138](packages/runtime/src/index.ts#L138)

#### Properties

##### client?

```ts
optional client?: ResourceClient;
```

Defined in: [packages/runtime/src/index.ts:139](packages/runtime/src/index.ts#L139)

##### onChange?

```ts
optional onChange?: () => void;
```

Defined in: [packages/runtime/src/index.ts:140](packages/runtime/src/index.ts#L140)

###### Returns

`void`

***

### ResourceDefinition

Defined in: [packages/runtime/src/index.ts:93](packages/runtime/src/index.ts#L93)

A Convex query resource as emitted by the compiler for a `$$module:fn`
binding. Args may be a static value or a factory reading the render
context (e.g. `route.params`), which makes the subscription re-resolve on
navigation.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args?

```ts
optional args?: TArgs | ResourceArgsFactory<TArgs>;
```

Defined in: [packages/runtime/src/index.ts:99](packages/runtime/src/index.ts#L99)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:96](packages/runtime/src/index.ts#L96)

##### getArgs?

```ts
optional getArgs?: ResourceArgsFactory<TArgs>;
```

Defined in: [packages/runtime/src/index.ts:100](packages/runtime/src/index.ts#L100)

##### kind?

```ts
optional kind?: "query";
```

Defined in: [packages/runtime/src/index.ts:98](packages/runtime/src/index.ts#L98)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:95](packages/runtime/src/index.ts#L95)

##### name

```ts
name: string;
```

Defined in: [packages/runtime/src/index.ts:94](packages/runtime/src/index.ts#L94)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:97](packages/runtime/src/index.ts#L97)

***

### ResourceState

Defined in: [packages/runtime/src/index.ts:33](packages/runtime/src/index.ts#L33)

Current state of one subscribed Convex query resource.

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### error?

```ts
optional error?: unknown;
```

Defined in: [packages/runtime/src/index.ts:36](packages/runtime/src/index.ts#L36)

##### status

```ts
status: ResourceLifecycleStatus;
```

Defined in: [packages/runtime/src/index.ts:34](packages/runtime/src/index.ts#L34)

##### updatedAt?

```ts
optional updatedAt?: number;
```

Defined in: [packages/runtime/src/index.ts:37](packages/runtime/src/index.ts#L37)

##### value?

```ts
optional value?: T;
```

Defined in: [packages/runtime/src/index.ts:35](packages/runtime/src/index.ts#L35)

***

### ResourceSubscriptionHandlers

Defined in: [packages/runtime/src/index.ts:112](packages/runtime/src/index.ts#L112)

#### Type Parameters

##### T

`T` = `unknown`

#### Methods

##### error()

```ts
error(error): void;
```

Defined in: [packages/runtime/src/index.ts:114](packages/runtime/src/index.ts#L114)

###### Parameters

###### error

`unknown`

###### Returns

`void`

##### next()

```ts
next(value): void;
```

Defined in: [packages/runtime/src/index.ts:113](packages/runtime/src/index.ts#L113)

###### Parameters

###### value

`T`

###### Returns

`void`

***

### RouteContext

Defined in: [packages/runtime/src/index.ts:22](packages/runtime/src/index.ts#L22)

The current route as seen by templates: `route.path`, `route.params`, `route.query`.

#### Properties

##### params

```ts
params: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:24](packages/runtime/src/index.ts#L24)

##### path

```ts
path: string;
```

Defined in: [packages/runtime/src/index.ts:23](packages/runtime/src/index.ts#L23)

##### query

```ts
query: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:25](packages/runtime/src/index.ts#L25)

##### url?

```ts
optional url?: URL;
```

Defined in: [packages/runtime/src/index.ts:26](packages/runtime/src/index.ts#L26)

***

### RoutePageModule

Defined in: [packages/runtime/src/router.ts:11](packages/runtime/src/router.ts#L11)

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### default?

```ts
optional default?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/router.ts:12](packages/runtime/src/router.ts#L12)

##### headEntries?

```ts
optional headEntries?: (context?) => HeadEntry[];
```

Defined in: [packages/runtime/src/router.ts:15](packages/runtime/src/router.ts#L15)

###### Parameters

###### context?

[`RenderContext`](#rendercontext)

###### Returns

[`HeadEntry`](#headentry)[]

##### render?

```ts
optional render?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/router.ts:13](packages/runtime/src/router.ts#L13)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/router.ts:14](packages/runtime/src/router.ts#L14)

***

### RouterPageHost

Defined in: [packages/runtime/src/router.ts:65](packages/runtime/src/router.ts#L65)

The mounted page host the router drives. @wavex/runtime/lit's mount
satisfies this shape; any renderer backend can implement it.

#### Methods

##### setNavigation()?

```ts
optional setNavigation(navigation): void;
```

Defined in: [packages/runtime/src/router.ts:74](packages/runtime/src/router.ts#L74)

Navigation lifecycle for declarative progress UI (optional for custom hosts).

###### Parameters

###### navigation

[`NavigationState`](#navigationstate)

###### Returns

`void`

##### setPage()

```ts
setPage(page): void;
```

Defined in: [packages/runtime/src/router.ts:66](packages/runtime/src/router.ts#L66)

###### Parameters

###### page

###### head?

(`context?`) => [`HeadEntry`](#headentry)[]

###### render

[`RenderFunction`](#renderfunction)

###### resources

readonly [`ResourceDefinition`](#resourcedefinition)\<`unknown`\>[]

###### route

[`RouteContext`](#routecontext)

###### Returns

`void`

##### update()

```ts
update(nextContext?): void;
```

Defined in: [packages/runtime/src/router.ts:72](packages/runtime/src/router.ts#L72)

###### Parameters

###### nextContext?

###### route?

[`RouteContext`](#routecontext)

###### Returns

`void`

***

### SemanticActionDispatcherOptions

Defined in: [packages/runtime/src/index.ts:174](packages/runtime/src/index.ts#L174)

#### Properties

##### actionClient?

```ts
optional actionClient?: ActionClient;
```

Defined in: [packages/runtime/src/index.ts:175](packages/runtime/src/index.ts#L175)

##### analytics?

```ts
optional analytics?: AnalyticsClient;
```

Defined in: [packages/runtime/src/index.ts:182](packages/runtime/src/index.ts#L182)

Optional analytics sink; semantic Convex actions are captured automatically (`:track:` overrides the name).

##### dispatch?

```ts
optional dispatch?: (event) => void | Promise<void>;
```

Defined in: [packages/runtime/src/index.ts:176](packages/runtime/src/index.ts#L176)

###### Parameters

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void` \| `Promise`\<`void`\>

##### onActionError?

```ts
optional onActionError?: (definition, error, event) => void;
```

Defined in: [packages/runtime/src/index.ts:179](packages/runtime/src/index.ts#L179)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### error

`unknown`

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void`

##### onActionResult?

```ts
optional onActionResult?: (definition, result, event) => void;
```

Defined in: [packages/runtime/src/index.ts:178](packages/runtime/src/index.ts#L178)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### result

`unknown`

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void`

##### resolveActionKind?

```ts
optional resolveActionKind?: ActionKindResolver;
```

Defined in: [packages/runtime/src/index.ts:177](packages/runtime/src/index.ts#L177)

##### throwActionErrors?

```ts
optional throwActionErrors?: boolean;
```

Defined in: [packages/runtime/src/index.ts:180](packages/runtime/src/index.ts#L180)

***

### WavexActionEvent

Defined in: [packages/runtime/src/index.ts:212](packages/runtime/src/index.ts#L212)

A semantic event captured by delegation: `:click:save` produces `{ type: "click", target: "save" }`.

#### Properties

##### context

```ts
context: RenderContext;
```

Defined in: [packages/runtime/src/index.ts:217](packages/runtime/src/index.ts#L217)

##### element

```ts
element: Element;
```

Defined in: [packages/runtime/src/index.ts:216](packages/runtime/src/index.ts#L216)

##### event

```ts
event: Event;
```

Defined in: [packages/runtime/src/index.ts:215](packages/runtime/src/index.ts#L215)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:214](packages/runtime/src/index.ts#L214)

##### type

```ts
type: string;
```

Defined in: [packages/runtime/src/index.ts:213](packages/runtime/src/index.ts#L213)

## Type Aliases

### ActionKindResolver

```ts
type ActionKindResolver = (definition, event) => "mutation" | "action" | undefined;
```

Defined in: [packages/runtime/src/index.ts:172](packages/runtime/src/index.ts#L172)

Resolves whether a `$$` target is a Convex mutation or action. The Vite
plugin supplies one backed by the function-kind manifest discovered from
`convex/` sources, so templates never declare the kind.

#### Parameters

##### definition

[`ActionDefinition`](#actiondefinition)

##### event

[`WavexActionEvent`](#wavexactionevent)

#### Returns

`"mutation"` \| `"action"` \| `undefined`

***

### ActionLifecycleStatus

```ts
type ActionLifecycleStatus = "idle" | "pending" | "error";
```

Defined in: [packages/runtime/src/index.ts:41](packages/runtime/src/index.ts#L41)

Lifecycle of a mutation/action dispatch; drives `+pending` / `+idle` / `+mutation-error` states.

***

### RenderFunction

```ts
type RenderFunction<Result> = (context?) => Result;
```

Defined in: [packages/runtime/src/index.ts:228](packages/runtime/src/index.ts#L228)

The shape of a compiled `.wx` module's render export; `Result` is the renderer backend's template type.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Parameters

##### context?

[`RenderContext`](#rendercontext)

#### Returns

`Result`

***

### ResourceArgsFactory

```ts
type ResourceArgsFactory<TArgs> = (context) => TArgs;
```

Defined in: [packages/runtime/src/index.ts:85](packages/runtime/src/index.ts#L85)

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Parameters

##### context

[`RenderContext`](#rendercontext)

#### Returns

`TArgs`

***

### ResourceLifecycleStatus

```ts
type ResourceLifecycleStatus = "loading" | "ready" | "error";
```

Defined in: [packages/runtime/src/index.ts:30](packages/runtime/src/index.ts#L30)

Lifecycle of a live query resource; drives `+loading` / `+error` / `+empty` template states.

***

### ResourceTeardown

```ts
type ResourceTeardown = 
  | void
  | (() => void)
  | {
  dispose?: () => void;
  getCurrentValue?: () => unknown;
  unsubscribe?: () => void;
};
```

Defined in: [packages/runtime/src/index.ts:117](packages/runtime/src/index.ts#L117)

## Functions

### analyticsEventNameForTarget()

```ts
function analyticsEventNameForTarget(target): string;
```

Defined in: [packages/runtime/src/analytics.ts:73](packages/runtime/src/analytics.ts#L73)

Conventional analytics event name for a semantic Convex action target, e.g. "$$tasks:create" -> "tasks:create".

#### Parameters

##### target

`string`

#### Returns

`string`

***

### applyHead()

```ts
function applyHead(entries, documentRef?): void;
```

Defined in: [packages/runtime/src/index.ts:486](packages/runtime/src/index.ts#L486)

Reconcile `document.title` and `data-wx-head`-managed meta/link nodes with
the given entries. Only nodes the runtime created are touched, so static
head content from `index.html` (and prerendered head output, which emits
the same shape) survives client navigation.

#### Parameters

##### entries

readonly [`HeadEntry`](#headentry)[]

##### documentRef?

`Document` = `document`

#### Returns

`void`

***

### composeLayoutRender()

```ts
function composeLayoutRender(layouts, page): object;
```

Defined in: [packages/runtime/src/router.ts:31](packages/runtime/src/router.ts#L31)

Compose +layout.wx modules around a page render. Each layout receives the
inner content through context.slots.default, matching the compiler's
semantic slot projection for bare `slot` elements.

#### Parameters

##### layouts

readonly [`RoutePageModule`](#routepagemodule)\<`unknown`\>[]

##### page

[`RoutePageModule`](#routepagemodule)

#### Returns

`object`

##### headEntries

```ts
headEntries: (context?) => HeadEntry[];
```

###### Parameters

###### context?

[`RenderContext`](#rendercontext)

###### Returns

[`HeadEntry`](#headentry)[]

##### render

```ts
render: RenderFunction;
```

##### resources

```ts
resources: readonly ResourceDefinition<unknown>[];
```

***

### createClientRouter()

```ts
function createClientRouter(options): ClientRouter;
```

Defined in: [packages/runtime/src/router.ts:117](packages/runtime/src/router.ts#L117)

Progressive client router: intercepts internal link clicks (native `a href`
stays native), drives the History API, lazy-loads the matched route's
module and layouts, and atomically swaps the page into the host via
`setPage` — which re-scopes Convex subscriptions to the new route. Stale
navigations are cancelled by token, and `popstate` is handled for
back/forward.

#### Parameters

##### options

[`ClientRouterOptions`](#clientrouteroptions)

#### Returns

[`ClientRouter`](#clientrouter)

***

### createConvexActionClient()

```ts
function createConvexActionClient(client, options?): ActionClient;
```

Defined in: [packages/runtime/src/index.ts:369](packages/runtime/src/index.ts#L369)

Adapt the Convex client to the [ActionClient](#actionclient) seam; dispatches by inferred kind (mutation vs action).

#### Parameters

##### client

[`ConvexActionClientLike`](#convexactionclientlike)

##### options?

[`ConvexActionClientOptions`](#convexactionclientoptions) = `{}`

#### Returns

[`ActionClient`](#actionclient)

***

### createConvexResourceClient()

```ts
function createConvexResourceClient(client, options?): ResourceClient;
```

Defined in: [packages/runtime/src/index.ts:354](packages/runtime/src/index.ts#L354)

Adapt the official Convex browser client to the [ResourceClient](#resourceclient)
seam. Function addresses resolve through the generated `api` object when
provided (typed references), falling back to string paths.

#### Parameters

##### client

[`ConvexBrowserClientLike`](#convexbrowserclientlike)

##### options?

[`ConvexResourceClientOptions`](#convexresourceclientoptions) = `{}`

#### Returns

[`ResourceClient`](#resourceclient)

***

### createPostHogCaptureClient()

```ts
function createPostHogCaptureClient(options): AnalyticsClient;
```

Defined in: [packages/runtime/src/analytics.ts:18](packages/runtime/src/analytics.ts#L18)

Minimal PostHog capture bridge (decision for the baseline: no official
client dependency; events POST to the public /capture endpoint). Analytics
stays optional — apps enable it with VITE_POSTHOG_KEY / VITE_POSTHOG_HOST.

#### Parameters

##### options

[`PostHogCaptureOptions`](#posthogcaptureoptions)

#### Returns

[`AnalyticsClient`](#analyticsclient)

***

### createRenderContext()

```ts
function createRenderContext(context?): RenderContext;
```

Defined in: [packages/runtime/src/index.ts:248](packages/runtime/src/index.ts#L248)

Normalize a partial context into a fully-populated [RenderContext](#rendercontext) with empty defaults.

#### Parameters

##### context?

[`RenderContext`](#rendercontext) = `{}`

#### Returns

[`RenderContext`](#rendercontext)

***

### createResourceController()

```ts
function createResourceController(
   context, 
   definitions?, 
   options?): ResourceController;
```

Defined in: [packages/runtime/src/index.ts:269](packages/runtime/src/index.ts#L269)

Subscribe the context's resources through a [ResourceClient](#resourceclient) and keep
`context.resources` / `context.resourceStates` current. Subscriptions are
keyed by function address and resolved args: `update()` diffs the wanted
set against active subscriptions, so navigation tears down only what
actually changed (route-scoped subscriptions), and `onChange` schedules a
rerender on every value/state transition.

#### Parameters

##### context

[`RenderContext`](#rendercontext)

##### definitions?

readonly [`ResourceDefinition`](#resourcedefinition)\<`unknown`\>[] = `[]`

##### options?

[`ResourceControllerOptions`](#resourcecontrolleroptions) = `{}`

#### Returns

[`ResourceController`](#resourcecontroller)

***

### createRouteContext()

```ts
function createRouteContext(input?): RouteContext;
```

Defined in: [packages/runtime/src/index.ts:237](packages/runtime/src/index.ts#L237)

Build a [RouteContext](#routecontext) from a URL (defaults to the current location); params are filled in by the router.

#### Parameters

##### input?

`string` \| `URL`

#### Returns

[`RouteContext`](#routecontext)

***

### createSemanticActionDispatcher()

```ts
function createSemanticActionDispatcher(context, options?): (event) => Promise<void>;
```

Defined in: [packages/runtime/src/index.ts:389](packages/runtime/src/index.ts#L389)

Build the dispatcher behind `context.dispatch`. `$$module:fn` targets go
through the action client with full lifecycle handling — pending state,
form `preventDefault`/reset on success, error state, and an automatic
analytics capture (`:track:` overrides the event name). Non-Convex targets
fall through to `options.dispatch` (app-defined handlers).

#### Parameters

##### context

[`RenderContext`](#rendercontext)

##### options?

[`SemanticActionDispatcherOptions`](#semanticactiondispatcheroptions) = `{}`

#### Returns

(`event`) => `Promise`\<`void`\>

***

### installSemanticEventDelegation()

```ts
function installSemanticEventDelegation(root, context): () => void;
```

Defined in: [packages/runtime/src/index.ts:454](packages/runtime/src/index.ts#L454)

Listen for click/submit/change at the root (capture phase) and route
`data-wx-*` action attributes — the compiled form of `:event:target` — to
`context.dispatch`. Delegation means compiled templates carry no inline
listeners. Returns an uninstall function.

#### Parameters

##### root

`ParentNode` & `EventTarget`

##### context

[`RenderContext`](#rendercontext)

#### Returns

() => `void`
