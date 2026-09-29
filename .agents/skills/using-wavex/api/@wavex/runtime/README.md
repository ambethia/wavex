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
A resource subscribes only while its enclosing `+if` conditions hold, and a
paginated one (`paginate:N`) subscribes to one page at a time.

## Interfaces

### ActionClient

Defined in: [packages/runtime/src/index.ts:241](packages/runtime/src/index.ts#L241)

Dispatch seam for mutations/actions; wraps the Convex client in production ([createConvexActionClient](#createconvexactionclient)).

#### Methods

##### invoke()

```ts
invoke(definition): Promise<unknown>;
```

Defined in: [packages/runtime/src/index.ts:242](packages/runtime/src/index.ts#L242)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### Returns

`Promise`\<`unknown`\>

***

### ActionDefinition

Defined in: [packages/runtime/src/index.ts:221](packages/runtime/src/index.ts#L221)

A `$$module:fn` mutation/action target parsed from a semantic event attribute.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args?

```ts
optional args?: TArgs;
```

Defined in: [packages/runtime/src/index.ts:227](packages/runtime/src/index.ts#L227)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:224](packages/runtime/src/index.ts#L224)

##### kind?

```ts
optional kind?: "mutation" | "action";
```

Defined in: [packages/runtime/src/index.ts:226](packages/runtime/src/index.ts#L226)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:223](packages/runtime/src/index.ts#L223)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:225](packages/runtime/src/index.ts#L225)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:222](packages/runtime/src/index.ts#L222)

***

### ActionState

Defined in: [packages/runtime/src/index.ts:59](packages/runtime/src/index.ts#L59)

Current state of one semantic action target (mutation or Convex action).

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### error?

```ts
optional error?: unknown;
```

Defined in: [packages/runtime/src/index.ts:63](packages/runtime/src/index.ts#L63)

##### pending

```ts
pending: boolean;
```

Defined in: [packages/runtime/src/index.ts:61](packages/runtime/src/index.ts#L61)

##### result?

```ts
optional result?: T;
```

Defined in: [packages/runtime/src/index.ts:62](packages/runtime/src/index.ts#L62)

##### status

```ts
status: ActionLifecycleStatus;
```

Defined in: [packages/runtime/src/index.ts:60](packages/runtime/src/index.ts#L60)

##### updatedAt?

```ts
optional updatedAt?: number;
```

Defined in: [packages/runtime/src/index.ts:64](packages/runtime/src/index.ts#L64)

***

### AnalyticsClient

Defined in: [packages/runtime/src/analytics.ts:2](packages/runtime/src/analytics.ts#L2)

Minimal analytics sink used by semantic action dispatchers.

#### Methods

##### capture()

```ts
capture(event, properties?): void;
```

Defined in: [packages/runtime/src/analytics.ts:3](packages/runtime/src/analytics.ts#L3)

###### Parameters

###### event

`string`

###### properties?

`Record`\<`string`, `unknown`\>

###### Returns

`void`

***

### ClientRoute

Defined in: [packages/runtime/src/router.ts:19](packages/runtime/src/router.ts#L19)

A file-derived route: `src/pages/tasks/[id].wx` → `/tasks/:id`.

#### Extends

- [`RouteDefinition`](../core/README.md#routedefinition)

#### Properties

##### errors?

```ts
optional errors?: readonly object[];
```

Defined in: [packages/runtime/src/router.ts:24](packages/runtime/src/router.ts#L24)

+error.wx modules, outermost first; the deepest one handles route errors.

##### file

```ts
file: string;
```

Defined in: [packages/core/dist/model.d.ts:19](packages/core/dist/model.d.ts#L19)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`file`](../core/README.md#file)

##### id

```ts
id: string;
```

Defined in: [packages/core/dist/model.d.ts:18](packages/core/dist/model.d.ts#L18)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`id`](../core/README.md#id)

##### layouts?

```ts
optional layouts?: readonly object[];
```

Defined in: [packages/runtime/src/router.ts:22](packages/runtime/src/router.ts#L22)

Layout modules, outermost first (src/pages/+layout.wx, then nested).

##### load

```ts
load: () => Promise<RoutePageModule<unknown>>;
```

Defined in: [packages/runtime/src/router.ts:20](packages/runtime/src/router.ts#L20)

###### Returns

`Promise`\<[`RoutePageModule`](#routepagemodule)\<`unknown`\>\>

##### path

```ts
path: string;
```

Defined in: [packages/core/dist/model.d.ts:20](packages/core/dist/model.d.ts#L20)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`path`](../core/README.md#path)

##### segments

```ts
segments: RouteSegment[];
```

Defined in: [packages/core/dist/model.d.ts:21](packages/core/dist/model.d.ts#L21)

###### Inherited from

[`RouteDefinition`](../core/README.md#routedefinition).[`segments`](../core/README.md#segments)

***

### ClientRouter

Defined in: [packages/runtime/src/router.ts:116](packages/runtime/src/router.ts#L116)

Imperative router controller returned by createClientRouter.

#### Properties

##### current?

```ts
optional current?: object;
```

Defined in: [packages/runtime/src/router.ts:125](packages/runtime/src/router.ts#L125)

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

Defined in: [packages/runtime/src/router.ts:126](packages/runtime/src/router.ts#L126)

###### Returns

`void`

##### hotReplacePage()

```ts
hotReplacePage(file, module): void;
```

Defined in: [packages/runtime/src/router.ts:124](packages/runtime/src/router.ts#L124)

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

Defined in: [packages/runtime/src/router.ts:122](packages/runtime/src/router.ts#L122)

Navigate to an in-app URL. `replace` swaps the current history entry;
`scroll: false` keeps the current scroll offset (e.g. for query-param
filter updates) instead of resetting to the top or `#fragment` target.

###### Parameters

###### to

`string`

###### options?

###### replace?

`boolean`

###### scroll?

`boolean`

###### Returns

`Promise`\<`void`\>

***

### ClientRouterOptions

Defined in: [packages/runtime/src/router.ts:93](packages/runtime/src/router.ts#L93)

Options for creating the progressive-enhancement client router.

#### Properties

##### host

```ts
host: RouterPageHost;
```

Defined in: [packages/runtime/src/router.ts:95](packages/runtime/src/router.ts#L95)

##### notFound?

```ts
optional notFound?: RenderFunction;
```

Defined in: [packages/runtime/src/router.ts:97](packages/runtime/src/router.ts#L97)

Render function used when no route matches the current path.

##### onNavigate?

```ts
optional onNavigate?: (route) => void;
```

Defined in: [packages/runtime/src/router.ts:112](packages/runtime/src/router.ts#L112)

###### Parameters

###### route

[`RouteContext`](#routecontext)

###### Returns

`void`

##### routes

```ts
routes: readonly ClientRoute[];
```

Defined in: [packages/runtime/src/router.ts:94](packages/runtime/src/router.ts#L94)

##### scrollRestoration?

```ts
optional scrollRestoration?: false | ClientRouterScrollOptions;
```

Defined in: [packages/runtime/src/router.ts:110](packages/runtime/src/router.ts#L110)

Reset push/replace navigations to the top (or their `#fragment` target)
and restore history offsets after page commits, including across reloads.
Pass false to leave all scrolling to the app/browser, or provide custom
seams for a scroll container.

##### viewTransitions?

```ts
optional viewTransitions?: boolean;
```

Defined in: [packages/runtime/src/router.ts:103](packages/runtime/src/router.ts#L103)

Wrap navigation commits in `document.startViewTransition` (default true).
Automatically skipped when unsupported, under `prefers-reduced-motion`,
and on the initial load; HMR swaps never transition.

##### window?

```ts
optional window?: Window;
```

Defined in: [packages/runtime/src/router.ts:111](packages/runtime/src/router.ts#L111)

***

### ClientRouterScrollOptions

Defined in: [packages/runtime/src/router.ts:85](packages/runtime/src/router.ts#L85)

Custom scroll container seams for client-router scroll restoration.

#### Properties

##### getPosition?

```ts
optional getPosition?: () => ScrollPosition;
```

Defined in: [packages/runtime/src/router.ts:87](packages/runtime/src/router.ts#L87)

Read the current scroll offset (defaults to `window.scrollX/Y`).

###### Returns

[`ScrollPosition`](#scrollposition)

##### scrollTo?

```ts
optional scrollTo?: (position) => void;
```

Defined in: [packages/runtime/src/router.ts:89](packages/runtime/src/router.ts#L89)

Apply an offset after a route commit (defaults to `window.scrollTo`).

###### Parameters

###### position

[`ScrollPosition`](#scrollposition)

###### Returns

`void`

***

### ConvexActionClientLike

Defined in: [packages/runtime/src/index.ts:285](packages/runtime/src/index.ts#L285)

Structural slice of the Convex client used for mutations and actions.

#### Methods

##### action()

```ts
action(action, args): Promise<unknown>;
```

Defined in: [packages/runtime/src/index.ts:287](packages/runtime/src/index.ts#L287)

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

Defined in: [packages/runtime/src/index.ts:286](packages/runtime/src/index.ts#L286)

###### Parameters

###### mutation

`unknown`

###### args

`Record`\<`string`, `unknown`\>

###### Returns

`Promise`\<`unknown`\>

***

### ConvexActionClientOptions

Defined in: [packages/runtime/src/index.ts:297](packages/runtime/src/index.ts#L297)

Function-resolution options for the Convex mutation/action adapter.

#### Properties

##### api?

```ts
optional api?: unknown;
```

Defined in: [packages/runtime/src/index.ts:298](packages/runtime/src/index.ts#L298)

##### resolveFunction?

```ts
optional resolveFunction?: (definition) => unknown;
```

Defined in: [packages/runtime/src/index.ts:299](packages/runtime/src/index.ts#L299)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### Returns

`unknown`

***

### ConvexBrowserClientLike

Defined in: [packages/runtime/src/index.ts:275](packages/runtime/src/index.ts#L275)

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

Defined in: [packages/runtime/src/index.ts:276](packages/runtime/src/index.ts#L276)

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

Defined in: [packages/runtime/src/index.ts:291](packages/runtime/src/index.ts#L291)

Function-resolution options for the Convex query resource adapter.

#### Properties

##### api?

```ts
optional api?: unknown;
```

Defined in: [packages/runtime/src/index.ts:292](packages/runtime/src/index.ts#L292)

##### resolveFunction?

```ts
optional resolveFunction?: (definition) => unknown;
```

Defined in: [packages/runtime/src/index.ts:293](packages/runtime/src/index.ts#L293)

###### Parameters

###### definition

[`ResolvedResourceDefinition`](#resolvedresourcedefinition)

###### Returns

`unknown`

***

### HeadEntry

Defined in: [packages/runtime/src/index.ts:312](packages/runtime/src/index.ts#L312)

One managed head node from a `+head` directive (title, meta, or link).

#### Properties

##### attributes?

```ts
optional attributes?: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:315](packages/runtime/src/index.ts#L315)

##### tag

```ts
tag: "title" | "meta" | "link";
```

Defined in: [packages/runtime/src/index.ts:313](packages/runtime/src/index.ts#L313)

##### text?

```ts
optional text?: string;
```

Defined in: [packages/runtime/src/index.ts:314](packages/runtime/src/index.ts#L314)

***

### IconOptions

Defined in: [packages/runtime/src/index.ts:363](packages/runtime/src/index.ts#L363)

Font Awesome family/variant for an [icon](#icon) declaration (Web Awesome's `@icon family:`/`variant:`).

#### Properties

##### family?

```ts
optional family?: string;
```

Defined in: [packages/runtime/src/index.ts:365](packages/runtime/src/index.ts#L365)

Icon family, e.g. `"sharp"` or `"duotone"`; defaults to `"classic"`.

##### variant?

```ts
optional variant?: string;
```

Defined in: [packages/runtime/src/index.ts:367](packages/runtime/src/index.ts#L367)

Icon variant, e.g. `"regular"` or `"light"`; defaults to `"solid"`.

***

### NavigationState

Defined in: [packages/runtime/src/index.ts:118](packages/runtime/src/index.ts#L118)

The client router's navigation lifecycle, exposed declaratively in template
context. Render an nprogress-style indicator with `+if navigation.pending`;
the router also mirrors this onto `<html data-wx-navigating>` for CSS-only
indicators.

#### Properties

##### pending

```ts
pending: boolean;
```

Defined in: [packages/runtime/src/index.ts:119](packages/runtime/src/index.ts#L119)

##### to?

```ts
optional to?: RouteContext;
```

Defined in: [packages/runtime/src/index.ts:121](packages/runtime/src/index.ts#L121)

The destination route while a navigation is pending.

***

### PostHogCaptureOptions

Defined in: [packages/runtime/src/analytics.ts:7](packages/runtime/src/analytics.ts#L7)

Configuration for the built-in PostHog `/capture` bridge.

#### Properties

##### apiKey

```ts
apiKey: string;
```

Defined in: [packages/runtime/src/analytics.ts:8](packages/runtime/src/analytics.ts#L8)

##### fetchFn?

```ts
optional fetchFn?: (input, init?) => Promise<Response>;
```

Defined in: [packages/runtime/src/analytics.ts:11](packages/runtime/src/analytics.ts#L11)

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

Defined in: [packages/runtime/src/analytics.ts:10](packages/runtime/src/analytics.ts#L10)

PostHog instance origin, default https://us.i.posthog.com

##### storage?

```ts
optional storage?: Pick<Storage, "getItem" | "setItem">;
```

Defined in: [packages/runtime/src/analytics.ts:12](packages/runtime/src/analytics.ts#L12)

***

### Register

Defined in: [packages/runtime/src/index.ts:82](packages/runtime/src/index.ts#L82)

Registration point for app-wide WAVEx types (TanStack-style). An app
augments it once, and every template's `state`, `mountLitApp`'s
`initialContext.state`, and `LitApp.update` are typed with it — in the
editor and in `wavex check`:

```ts
// src/main.ts (any module file the app's tsconfig includes)
declare module "@wavex/runtime" {
  interface Register {
    state: { auth: typeof authState; pledges: typeof pledgeState };
  }
}
```

***

### RenderContext

Defined in: [packages/runtime/src/index.ts:96](packages/runtime/src/index.ts#L96)

Everything a compiled render function can see: the route, component attrs,
local state, live resource values and their lifecycle states, action
states, projected slot content, and the semantic action dispatcher.
Compiled `.wx` modules read from this; the runtime owns writing to it.

#### Properties

##### actionStates?

```ts
optional actionStates?: Record<string, ActionState<unknown>>;
```

Defined in: [packages/runtime/src/index.ts:104](packages/runtime/src/index.ts#L104)

##### attrs?

```ts
optional attrs?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:99](packages/runtime/src/index.ts#L99)

Component attributes (and the route error for +error.wx pages).

##### dispatch?

```ts
optional dispatch?: (event) => void | Promise<void>;
```

Defined in: [packages/runtime/src/index.ts:109](packages/runtime/src/index.ts#L109)

###### Parameters

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void` \| `Promise`\<`void`\>

##### navigation?

```ts
optional navigation?: NavigationState;
```

Defined in: [packages/runtime/src/index.ts:106](packages/runtime/src/index.ts#L106)

Client navigation lifecycle — `navigation.pending` while a route loads.

##### resources?

```ts
optional resources?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:102](packages/runtime/src/index.ts#L102)

##### resourceStates?

```ts
optional resourceStates?: Record<string, ResourceState<unknown>>;
```

Defined in: [packages/runtime/src/index.ts:103](packages/runtime/src/index.ts#L103)

##### route?

```ts
optional route?: RouteContext;
```

Defined in: [packages/runtime/src/index.ts:97](packages/runtime/src/index.ts#L97)

##### slots?

```ts
optional slots?: Record<string, unknown>;
```

Defined in: [packages/runtime/src/index.ts:108](packages/runtime/src/index.ts#L108)

Slot content projected into layouts and local components (semantic slot composition).

##### state?

```ts
optional state?: Record<string, any>;
```

Defined in: [packages/runtime/src/index.ts:101](packages/runtime/src/index.ts#L101)

App-owned state (typed by the app's [Register](#register) declaration); WAVEx never mutates it.

***

### ResolvedActionDefinition

Defined in: [packages/runtime/src/index.ts:231](packages/runtime/src/index.ts#L231)

Semantic action definition after kind and args are resolved for dispatch.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args

```ts
args: TArgs;
```

Defined in: [packages/runtime/src/index.ts:237](packages/runtime/src/index.ts#L237)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:234](packages/runtime/src/index.ts#L234)

##### kind

```ts
kind: "mutation" | "action";
```

Defined in: [packages/runtime/src/index.ts:236](packages/runtime/src/index.ts#L236)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:233](packages/runtime/src/index.ts#L233)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:235](packages/runtime/src/index.ts#L235)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:232](packages/runtime/src/index.ts#L232)

***

### ResolvedResourceDefinition

Defined in: [packages/runtime/src/index.ts:160](packages/runtime/src/index.ts#L160)

Resource definition after args have been resolved for the current render context.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args

```ts
args: TArgs;
```

Defined in: [packages/runtime/src/index.ts:166](packages/runtime/src/index.ts#L166)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:163](packages/runtime/src/index.ts#L163)

##### kind

```ts
kind: "query";
```

Defined in: [packages/runtime/src/index.ts:165](packages/runtime/src/index.ts#L165)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:162](packages/runtime/src/index.ts#L162)

##### name

```ts
name: string;
```

Defined in: [packages/runtime/src/index.ts:161](packages/runtime/src/index.ts#L161)

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:164](packages/runtime/src/index.ts#L164)

***

### ResourceClient

Defined in: [packages/runtime/src/index.ts:184](packages/runtime/src/index.ts#L184)

The subscription seam between the runtime and a realtime backend. The real
implementation wraps the official Convex browser client
([createConvexResourceClient](#createconvexresourceclient)); tests use fake clients — runtime
behavior is deliberately testable without a live deployment.

#### Methods

##### subscribe()

```ts
subscribe<T>(definition, handlers): ResourceTeardown;
```

Defined in: [packages/runtime/src/index.ts:185](packages/runtime/src/index.ts#L185)

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

Defined in: [packages/runtime/src/index.ts:192](packages/runtime/src/index.ts#L192)

Manages the live subscriptions for a mounted page; `update` diffs definitions, `dispose` tears all down.

#### Methods

##### dispose()

```ts
dispose(): void;
```

Defined in: [packages/runtime/src/index.ts:207](packages/runtime/src/index.ts#L207)

###### Returns

`void`

##### turnPage()

```ts
turnPage(name, direction): boolean;
```

Defined in: [packages/runtime/src/index.ts:206](packages/runtime/src/index.ts#L206)

Move the paginated resource `name` to its next or previous page, as the
`name.nextPage` / `name.previousPage` semantic targets do. Returns false
when no paginated resource definition has that name. A move with no page
in that direction (see [ResourceState.hasNextPage](#hasnextpage) and
[ResourceState.hasPreviousPage](#haspreviouspage)) does nothing.

###### Parameters

###### name

`string`

###### direction

[`PageDirection`](#pagedirection)

###### Returns

`boolean`

##### update()

```ts
update(nextDefinitions?): void;
```

Defined in: [packages/runtime/src/index.ts:198](packages/runtime/src/index.ts#L198)

Re-evaluate every definition's `+if` gate and args against the context
and subscribe, resubscribe, or unsubscribe to match. Changes apply
synchronously, before the caller renders.

###### Parameters

###### nextDefinitions?

readonly [`ResourceDefinition`](#resourcedefinition)\<`unknown`\>[]

###### Returns

`void`

***

### ResourceControllerOptions

Defined in: [packages/runtime/src/index.ts:211](packages/runtime/src/index.ts#L211)

Options for resource subscription management.

#### Properties

##### client?

```ts
optional client?: ResourceClient;
```

Defined in: [packages/runtime/src/index.ts:212](packages/runtime/src/index.ts#L212)

##### onChange?

```ts
optional onChange?: () => void;
```

Defined in: [packages/runtime/src/index.ts:217](packages/runtime/src/index.ts#L217)

Called after changes that happen outside `update()` — subscription values
and errors, and page turns — so the host can rerender.

###### Returns

`void`

***

### ResourceDefinition

Defined in: [packages/runtime/src/index.ts:134](packages/runtime/src/index.ts#L134)

A Convex query resource as emitted by the compiler for a `$$module:fn`
binding. Args may be a static value or a factory reading the render
context (`route`, `state`, other resources), which the controller
re-resolves on every update — navigation, resource changes, local
handlers, and `app.update({ state })` — resubscribing when they change.

#### Type Parameters

##### TArgs

`TArgs` = `unknown`

#### Properties

##### args?

```ts
optional args?: TArgs | ResourceArgsFactory<TArgs>;
```

Defined in: [packages/runtime/src/index.ts:140](packages/runtime/src/index.ts#L140)

##### functionName

```ts
functionName: string;
```

Defined in: [packages/runtime/src/index.ts:137](packages/runtime/src/index.ts#L137)

##### getArgs?

```ts
optional getArgs?: ResourceArgsFactory<TArgs>;
```

Defined in: [packages/runtime/src/index.ts:141](packages/runtime/src/index.ts#L141)

##### kind?

```ts
optional kind?: "query";
```

Defined in: [packages/runtime/src/index.ts:139](packages/runtime/src/index.ts#L139)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/runtime/src/index.ts:136](packages/runtime/src/index.ts#L136)

##### name

```ts
name: string;
```

Defined in: [packages/runtime/src/index.ts:135](packages/runtime/src/index.ts#L135)

##### pageSize?

```ts
optional pageSize?: number;
```

Defined in: [packages/runtime/src/index.ts:156](packages/runtime/src/index.ts#L156)

Items per page for a Convex paginated query (`paginate:N`). The resource
subscribes to one page at a time — its args plus
`paginationOpts: { cursor, numItems }` — binds that page's items, and
moves between pages with [ResourceController.turnPage](#turnpage). Changing
its args or closing its gate returns it to the first page.

##### raw?

```ts
optional raw?: string;
```

Defined in: [packages/runtime/src/index.ts:138](packages/runtime/src/index.ts#L138)

##### when?

```ts
optional when?: (context) => boolean;
```

Defined in: [packages/runtime/src/index.ts:148](packages/runtime/src/index.ts#L148)

Subscribe only while this returns true — WAVEx's form of Convex's
`"skip"`. The compiler emits it from the `+if` directives enclosing the
`$$` line. While it is false the resource is unsubscribed, its binding
and state are absent, and its args are not resolved.

###### Parameters

###### context

[`RenderContext`](#rendercontext)

###### Returns

`boolean`

***

### ResourceState

Defined in: [packages/runtime/src/index.ts:41](packages/runtime/src/index.ts#L41)

Current state of one subscribed Convex query resource. A resource whose
`+if` conditions do not hold has no state (and no binding value).

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### error?

```ts
optional error?: unknown;
```

Defined in: [packages/runtime/src/index.ts:44](packages/runtime/src/index.ts#L44)

##### hasNextPage?

```ts
optional hasNextPage?: boolean;
```

Defined in: [packages/runtime/src/index.ts:52](packages/runtime/src/index.ts#L52)

Paginated resources (`paginate:N`): the loaded page is not the last, so
`name.nextPage` moves on. False while a page loads or after it fails.

##### hasPreviousPage?

```ts
optional hasPreviousPage?: boolean;
```

Defined in: [packages/runtime/src/index.ts:47](packages/runtime/src/index.ts#L47)

Paginated resources (`paginate:N`): the resource is past its first page, so `name.previousPage` moves back.

##### status

```ts
status: ResourceLifecycleStatus;
```

Defined in: [packages/runtime/src/index.ts:42](packages/runtime/src/index.ts#L42)

##### updatedAt?

```ts
optional updatedAt?: number;
```

Defined in: [packages/runtime/src/index.ts:45](packages/runtime/src/index.ts#L45)

##### value?

```ts
optional value?: T;
```

Defined in: [packages/runtime/src/index.ts:43](packages/runtime/src/index.ts#L43)

***

### ResourceSubscriptionHandlers

Defined in: [packages/runtime/src/index.ts:170](packages/runtime/src/index.ts#L170)

Callbacks a ResourceClient uses to publish resource values or errors.

#### Type Parameters

##### T

`T` = `unknown`

#### Methods

##### error()

```ts
error(error): void;
```

Defined in: [packages/runtime/src/index.ts:172](packages/runtime/src/index.ts#L172)

###### Parameters

###### error

`unknown`

###### Returns

`void`

##### next()

```ts
next(value): void;
```

Defined in: [packages/runtime/src/index.ts:171](packages/runtime/src/index.ts#L171)

###### Parameters

###### value

`T`

###### Returns

`void`

***

### RouteContext

Defined in: [packages/runtime/src/index.ts:27](packages/runtime/src/index.ts#L27)

The current route as seen by templates: `route.path`, `route.params`, `route.query`.

#### Properties

##### params

```ts
params: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:29](packages/runtime/src/index.ts#L29)

##### path

```ts
path: string;
```

Defined in: [packages/runtime/src/index.ts:28](packages/runtime/src/index.ts#L28)

##### query

```ts
query: Record<string, string>;
```

Defined in: [packages/runtime/src/index.ts:30](packages/runtime/src/index.ts#L30)

##### url?

```ts
optional url?: URL;
```

Defined in: [packages/runtime/src/index.ts:31](packages/runtime/src/index.ts#L31)

***

### RoutePageModule

Defined in: [packages/runtime/src/router.ts:12](packages/runtime/src/router.ts#L12)

Runtime shape of a lazily loaded page or layout module.

#### Type Parameters

##### Result

`Result` = `unknown`

#### Properties

##### default?

```ts
optional default?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/router.ts:13](packages/runtime/src/router.ts#L13)

##### headEntries?

```ts
optional headEntries?: (context?) => HeadEntry[];
```

Defined in: [packages/runtime/src/router.ts:16](packages/runtime/src/router.ts#L16)

###### Parameters

###### context?

[`RenderContext`](#rendercontext)

###### Returns

[`HeadEntry`](#headentry)[]

##### render?

```ts
optional render?: RenderFunction<Result>;
```

Defined in: [packages/runtime/src/router.ts:14](packages/runtime/src/router.ts#L14)

##### resources?

```ts
optional resources?: readonly ResourceDefinition<unknown>[];
```

Defined in: [packages/runtime/src/router.ts:15](packages/runtime/src/router.ts#L15)

***

### RouterPageHost

Defined in: [packages/runtime/src/router.ts:66](packages/runtime/src/router.ts#L66)

The mounted page host the router drives. @wavex/runtime/lit's mount
satisfies this shape; any renderer backend can implement it.

#### Methods

##### setNavigation()?

```ts
optional setNavigation(navigation): void;
```

Defined in: [packages/runtime/src/router.ts:75](packages/runtime/src/router.ts#L75)

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

Defined in: [packages/runtime/src/router.ts:67](packages/runtime/src/router.ts#L67)

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

Defined in: [packages/runtime/src/router.ts:73](packages/runtime/src/router.ts#L73)

###### Parameters

###### nextContext?

###### route?

[`RouteContext`](#routecontext)

###### Returns

`void`

***

### ScrollPosition

Defined in: [packages/runtime/src/router.ts:79](packages/runtime/src/router.ts#L79)

A document or custom scroll container's two-dimensional scroll offset.

#### Properties

##### x

```ts
x: number;
```

Defined in: [packages/runtime/src/router.ts:80](packages/runtime/src/router.ts#L80)

##### y

```ts
y: number;
```

Defined in: [packages/runtime/src/router.ts:81](packages/runtime/src/router.ts#L81)

***

### SemanticActionDispatcherOptions

Defined in: [packages/runtime/src/index.ts:253](packages/runtime/src/index.ts#L253)

Dependencies and lifecycle hooks for the semantic action dispatcher.

#### Properties

##### actionClient?

```ts
optional actionClient?: ActionClient;
```

Defined in: [packages/runtime/src/index.ts:254](packages/runtime/src/index.ts#L254)

##### analytics?

```ts
optional analytics?: AnalyticsClient;
```

Defined in: [packages/runtime/src/index.ts:271](packages/runtime/src/index.ts#L271)

Optional analytics sink; semantic local and Convex actions are captured automatically (`:track:` overrides the name).

##### dispatch?

```ts
optional dispatch?: (event) => void | Promise<void>;
```

Defined in: [packages/runtime/src/index.ts:256](packages/runtime/src/index.ts#L256)

App-level fallback for non-Convex targets that have no compiled local handler.

###### Parameters

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void` \| `Promise`\<`void`\>

##### onActionError?

```ts
optional onActionError?: (definition, error, event) => void;
```

Defined in: [packages/runtime/src/index.ts:261](packages/runtime/src/index.ts#L261)

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

Defined in: [packages/runtime/src/index.ts:260](packages/runtime/src/index.ts#L260)

###### Parameters

###### definition

[`ResolvedActionDefinition`](#resolvedactiondefinition)

###### result

`unknown`

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void`

##### onUnhandledAction?

```ts
optional onUnhandledAction?: (event) => void;
```

Defined in: [packages/runtime/src/index.ts:258](packages/runtime/src/index.ts#L258)

Override the default console diagnostic for an unresolved target (no local handler, app dispatch, or action client).

###### Parameters

###### event

[`WavexActionEvent`](#wavexactionevent)

###### Returns

`void`

##### resolveActionKind?

```ts
optional resolveActionKind?: ActionKindResolver;
```

Defined in: [packages/runtime/src/index.ts:259](packages/runtime/src/index.ts#L259)

##### throwActionErrors?

```ts
optional throwActionErrors?: boolean;
```

Defined in: [packages/runtime/src/index.ts:262](packages/runtime/src/index.ts#L262)

##### turnPage?

```ts
optional turnPage?: (name, direction) => boolean;
```

Defined in: [packages/runtime/src/index.ts:269](packages/runtime/src/index.ts#L269)

Move a paginated resource for `name.nextPage` / `name.previousPage`
targets; mounts pass their resource controller's
[ResourceController.turnPage](#turnpage). Returning false (no paginated
resource has that name) reports the target as unhandled.

###### Parameters

###### name

`string`

###### direction

[`PageDirection`](#pagedirection)

###### Returns

`boolean`

***

### WavexActionEvent

Defined in: [packages/runtime/src/index.ts:303](packages/runtime/src/index.ts#L303)

A semantic event captured by delegation: `:click:save` produces `{ type: "click", target: "save" }`.

#### Properties

##### context

```ts
context: RenderContext;
```

Defined in: [packages/runtime/src/index.ts:308](packages/runtime/src/index.ts#L308)

##### element

```ts
element: Element;
```

Defined in: [packages/runtime/src/index.ts:307](packages/runtime/src/index.ts#L307)

##### event

```ts
event: Event;
```

Defined in: [packages/runtime/src/index.ts:306](packages/runtime/src/index.ts#L306)

##### target

```ts
target: string;
```

Defined in: [packages/runtime/src/index.ts:305](packages/runtime/src/index.ts#L305)

##### type

```ts
type: string;
```

Defined in: [packages/runtime/src/index.ts:304](packages/runtime/src/index.ts#L304)

## Type Aliases

### ActionKindResolver

```ts
type ActionKindResolver = (definition, event) => "mutation" | "action" | undefined;
```

Defined in: [packages/runtime/src/index.ts:250](packages/runtime/src/index.ts#L250)

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

Defined in: [packages/runtime/src/index.ts:56](packages/runtime/src/index.ts#L56)

Lifecycle of a mutation/action dispatch; drives `+pending` / `+idle` / `+mutation-error` states.

***

### AppState

```ts
type AppState = Register extends object ? State : Record<string, any>;
```

Defined in: [packages/runtime/src/index.ts:88](packages/runtime/src/index.ts#L88)

The app's template `state` type: `Register["state"]` when the app
registers one (see [Register](#register)), otherwise an untyped record.

***

### PageDirection

```ts
type PageDirection = "next" | "previous";
```

Defined in: [packages/core/dist/model.d.ts:95](packages/core/dist/model.d.ts#L95)

Direction of a page move on a paginated resource.

***

### RenderFunction

```ts
type RenderFunction<Result> = (context?) => Result;
```

Defined in: [packages/runtime/src/index.ts:319](packages/runtime/src/index.ts#L319)

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

Defined in: [packages/runtime/src/index.ts:125](packages/runtime/src/index.ts#L125)

Computes resource args from the current render context before subscription.

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

Defined in: [packages/runtime/src/index.ts:35](packages/runtime/src/index.ts#L35)

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

Defined in: [packages/runtime/src/index.ts:176](packages/runtime/src/index.ts#L176)

Teardown shape returned by a resource subscription; supports Convex and test-client conventions.

## Functions

### analyticsEventNameForTarget()

```ts
function analyticsEventNameForTarget(target): string;
```

Defined in: [packages/runtime/src/analytics.ts:83](packages/runtime/src/analytics.ts#L83)

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

Defined in: [packages/runtime/src/index.ts:850](packages/runtime/src/index.ts#L850)

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

Defined in: [packages/runtime/src/router.ts:32](packages/runtime/src/router.ts#L32)

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

Defined in: [packages/runtime/src/router.ts:196](packages/runtime/src/router.ts#L196)

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

Defined in: [packages/runtime/src/index.ts:671](packages/runtime/src/index.ts#L671)

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

Defined in: [packages/runtime/src/index.ts:656](packages/runtime/src/index.ts#L656)

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

Defined in: [packages/runtime/src/analytics.ts:20](packages/runtime/src/analytics.ts#L20)

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

Defined in: [packages/runtime/src/index.ts:407](packages/runtime/src/index.ts#L407)

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

Defined in: [packages/runtime/src/index.ts:433](packages/runtime/src/index.ts#L433)

Subscribe the context's resources through a [ResourceClient](#resourceclient) and keep
`context.resources` / `context.resourceStates` current. Subscriptions are
keyed by function address and resolved args: `update()` diffs the wanted
set against active subscriptions, so navigation tears down only what
actually changed (route-scoped subscriptions), and `onChange` schedules a
rerender on every asynchronous value/state transition.

A definition whose `when` gate is false is not wanted: its subscription
stops and its binding and state are cleared. A paginated definition
(`pageSize`) keeps a cursor stack per resource and subscribes to the
current page only; see [ResourceController.turnPage](#turnpage).

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

Defined in: [packages/runtime/src/index.ts:396](packages/runtime/src/index.ts#L396)

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

Defined in: [packages/runtime/src/index.ts:694](packages/runtime/src/index.ts#L694)

Build the dispatcher behind `context.dispatch`. `$$module:fn` targets go
through the action client with full lifecycle handling — pending state,
form `preventDefault`/reset on success, error state, and an automatic
analytics capture (`:track:` overrides the event name). `name.nextPage` /
`name.previousPage` targets move a paginated resource through
`options.turnPage`. Other targets first resolve the local prelude handler
attached by the compiler, then fall through to `options.dispatch` for
app-level targets.

#### Parameters

##### context

[`RenderContext`](#rendercontext)

##### options?

[`SemanticActionDispatcherOptions`](#semanticactiondispatcheroptions) = `{}`

#### Returns

(`event`) => `Promise`\<`void`\>

***

### icon()

```ts
function icon<N>(name, options?): N;
```

Defined in: [packages/runtime/src/index.ts:390](packages/runtime/src/index.ts#L390)

Declare a Font Awesome icon name that TypeScript computes, so WAVEx can
collect, validate, and self-host it; returns `name` unchanged.

Template icons written as literals (`@icon name:box`, or the literal
branches of `name:{{ done ? "box" : "truck-fast" }}`) are collected
automatically. Names chosen in TypeScript are not visible to the template
scan, so wrap each possible literal where it is written:

```ts
import { icon } from "@wavex/runtime";

const SUBJECT_ICONS = { survey: icon("clipboard-list"), payment: icon("credit-card") } as const;
```

`wavex check` and the Vite plugin find literal `icon()` calls in the app's
`src/` files (and `.wx` preludes), report names the installed Font Awesome
package lacks, and serve them with the template's icons. Arguments must be
string literals.

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

##### options?

[`IconOptions`](#iconoptions)

#### Returns

`N`

***

### installSemanticEventDelegation()

```ts
function installSemanticEventDelegation(root, context): () => void;
```

Defined in: [packages/runtime/src/index.ts:818](packages/runtime/src/index.ts#L818)

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
