# WAVEx Design Draft

> Status: draft for discussion. This document captures architecture decisions for the active implementation (the `packages/` monorepo). The early Zig/WASM and Vite spikes that informed these decisions have been retired; their conclusions are recorded in the implementation-decision section below.

## 1. Summary

**WAVEx** is a personal, opinionated web framework for building browser-based realtime apps with:

### Naming

```txt
Canonical name: WAVEx
Pronounced:     wave-ex
Repo/CLI name:  wavex
Template files: .wx
Visual mark:    ~x
```

The name started as a portmanteau of Web Awesome and Convex, but the stylized “wave-ex” identity is intentional. The project is personal-first and intentionally leans on tightly integrated commercial/pro dependencies, so broad package/search friendliness is not a priority for the stylized name.

- **Convex** as the backend/database/realtime layer.
- **Web Awesome** as the UI component/design system.
- **Font Awesome** as the icon system, with Pro/kit support when installed.
- **PostHog** analytics baked in.
- **`.wx` templates** as the app authoring surface, with optional colocated TypeScript prelude.
- **A Vite+/TypeScript WAVEx compiler/runtime** as the primary implementation path, with Lit as the initial DOM rendering backend.
- **Build only what is WAVEx-specific; stand on the Lit ecosystem for the rest.** The genuinely novel pieces are the `.wx` → Lit compiler and the Convex/Web Awesome/Font Awesome capability inference. Downstream concerns should reuse proven packages before hand-rolling: `@lit/task` (async resource lifecycle), `@lit-labs/router` (client routing), `@lit/context` (runtime context plumbing), and `@lit-labs/ssr` (prerendering).
- **TypeScript-first language tooling** for the compiler, Vite plugin, CLI, LSP, and editor integrations, so WAVEx can directly reuse TypeScript, Convex, Web Awesome, and Font Awesome metadata/types.
- **A single TypeScript parser in `@wavex/core`** as the only `.wx` grammar definition, consumed by both the compiler and the Volar-based LSP. Decision (2026-06): an earlier Tree-sitter grammar and Zed extension were deleted rather than maintained as a second grammar; do not reintroduce them.
- **Zig as optional tooling research** for a future fast `.wx` compiler, prerender helper, or CLI binary, not the MVP browser runtime.
- **Capability-based Web Awesome / Font Awesome integration**: free packages should work, Pro packages/kits unlock Pro completions/imports when installed. WAVEx should be open-sourceable without bundling or requiring licensed assets.
- **No generic frontend framework dependency** (React/Svelte/Vue/etc.) in the default app workflow. Node/Bun/pnpm are expected for Convex development, Vite+/WAVEx tooling, and licensed package acquisition.

This does **not** mean “zero JavaScript.” Browser glue code is expected. Bundled or vendored browser JavaScript is acceptable when it is infrastructure, e.g. Web Awesome custom elements, Lit, the official Convex realtime browser client, and PostHog.

The core goal is a deterministic, web-standards-aligned, client-side framework with strong compile-time inference around routes, templates, Web Awesome components, Font Awesome icons, Convex queries, and optional HTML prerendering for initial load and SEO.

## 2. Core Principles

1. **Lean hard into web standards**
   - HTML, custom elements, attributes, forms, slots, templates, events, History API, Fetch, WebSocket, AbortController, modulepreload, and View Transitions where possible.

2. **Use platform primitives before framework inventions**
   - Native `slot`, `form`, `button`, `a href`, `template`, `dialog`, `details`, `summary`, `title`, `meta`, and `link` should remain meaningful.

3. **The template is the declaration**
   - Routes, UI components, icon usage, queries, mutations, actions, and assets should be inferred from files/templates wherever possible.

4. **Client-side by default, realtime after boot**
   - The app is primarily a browser/client-side realtime application.
   - Prerender useful HTML for SEO and initial load when helpful.
   - Hydrate/bind on the client.
   - Start Convex realtime subscriptions after boot.

5. **Opinionated WAVEx app graph, not generic JS framework soup**
   - Convex development requires a package manager and TypeScript functions (`convex dev`, queries, mutations, actions, etc.).
   - Bun/pnpm/npm are acceptable for Convex tooling and authenticated WA/FA package installation, including Pro packages when the app owner has licenses.
   - Vite+/JS tooling is the primary dev/build substrate for MVP because it gives module resolution, HMR, package integration, and production bundling.
   - Colocated TypeScript in `.wx` files is acceptable app code.
   - Lit is acceptable as an internal rendering backend, especially because Web Awesome already depends on Lit.
   - The app should not be built around React/Svelte/Vue or arbitrary frontend npm dependencies as first-class framework primitives.

6. **Composable but explicit**
   - Avoid React-style provider soup.
   - Prefer lexical scope, slots, attributes/properties, custom events, and explicit directives.

## 3. Non-Goals / Constraints

### Non-goals for MVP

- Reimplementing Convex’s realtime WebSocket protocol in Zig.
- Making Zig/WASM the MVP browser runtime.
- Writing a full DOM renderer/reconciler before proving WAVEx semantics.
- A full JavaScript optimizer/bundler; Vite+/Rolldown should do that job.
- Full Markdown compatibility.
- Full SSR runtime infrastructure.
- Supporting arbitrary npm frontend dependencies as first-class app/runtime dependencies.

### Hard constraints

- Convex is the backend/DB/realtime system.
- Web Awesome and Font Awesome are first-class UI/icon systems, with Pro support detected from installed packages/licenses rather than hard-coded as a public dependency.
- PostHog is first-class analytics.
- Static asset hosting should be enough for the default deployment, but the app model is browser-based rather than “static” in the traditional content-site sense.

## 4. High-Level Architecture

```txt
.wx files
  -> WAVEx Vite+ plugin/compiler
  -> route/template/component graph
  -> generated TypeScript/JavaScript render modules
  -> Lit-backed DOM renderer backend
  -> generated route asset modules
  -> Vite+/Rolldown production bundle
  -> deployable client asset bundle / prerendered HTML

browser
  -> index.html / prerendered route HTML
  -> WAVEx runtime
  -> route render modules/assets
  -> Lit DOM patching/keyed list backend
  -> Web Awesome custom elements
  -> official Convex browser realtime client
  -> PostHog client or minimal capture bridge
```

### Implementation decision after spikes

The language and integrations are the core product. After the Zig/WASM and Vite+ spikes, the primary path is:

```txt
Vite+/TypeScript WAVEx runtime
  Primary MVP path.
  Gives HMR, module graph, dev overlay, package integration, production bundling,
  shared Lit/Web Awesome dependencies, and natural colocated TypeScript support.

Lit rendering backend
  Initial DOM patching backend.
  WAVEx owns resources, routing, actions, head, analytics, and generated render shape.
  Lit owns low-level DOM updates, property/attribute patching, and keyed list primitives.

Zig compiler/tooling
  Optional future research.
  Could become a fast native .wx compiler, prerender helper, or CLI packaging tool.

Zig/WASM browser runtime
  Not the MVP path.
  It adds friction at the DOM, Convex, PostHog, Web Awesome, HMR, and TS-prelude seams.
```

### Runtime split

```txt
WAVEx compiler/plugin
  Parse .wx, split TypeScript prelude from template, infer Convex/WA/FA/head/resources,
  generate render modules and asset imports for Vite+.

WAVEx runtime
  Routing, DOM mount lifecycle, resource lifecycle, Convex bridge,
  mutation/action state, error/loading boundaries, head manager,
  PostHog bridge, HMR boundary, and render scheduling.

Lit backend
  html/render/repeat/directives for DOM patching, keyed list identity,
  custom-element property/attribute updates, and focus-preserving rerenders.

Web Awesome package
  Import from package `dist` through Vite+ so Lit and related deps can be deduped.

Font Awesome package
  Selected SVGs or generated sprites from node_modules or a package/cache.

Convex client
  Official Convex browser realtime client for MVP.
```

## 5. File Structure

WAVEx app structure is fixed to Vite and Convex conventions rather than inventing or accepting alternate app trees:

```txt
src/
  pages/
    index.wx
    about.wx
    tasks/
      index.wx
      [id].wx
    +layout.wx
    +error.wx

  components/
    app-shell.wx
    task-card.wx
    error-card.wx

convex/
  schema.ts
  tasks.ts
  ai.ts
  http.ts
  auth.ts
  analytics.ts

public/
  app.css

wavex.config.ts
vite.config.ts
package.json
```

The active implementation is this repository's `packages/` monorepo with `apps/todo` as the proving ground; the earlier `spikes/vite` and Zig/WASM spikes are retired, with their conclusions recorded in the implementation-decision section above.

Convex is the backend implementation. Use the default **`convex/`** directory unless there is a strong reason to add an adapter layer later:

- `convex/schema.ts` for the Convex schema.
- `convex/tasks.ts` for task queries/mutations/actions.
- `convex/http.ts` for Convex HTTP actions.
- `convex/auth.ts` for auth integration.
- `convex/analytics.ts` for PostHog/proxy integration.

WAVEx treats directory structure as framework law. Routes live in `src/pages`, reusable template components live in `src/components`, Convex lives in `convex`, and static assets live in `public`.

### Monorepo package structure

WAVEx is developed as a TypeScript-first monorepo under the `@wavex/*` namespace, with one CLI package for the `wavex` binary. After the 2026-06 consolidation (7 → 5 packages: `language-core` merged into `@wavex/core`, `renderer-lit` merged into `@wavex/runtime` as the `@wavex/runtime/lit` subpath; Tree-sitter and Zed-extension packages deleted), the shape is:

```txt
packages/
  wavex/                 # CLI: wavex dev/build/check/routes/compile
  core/                  # .wx parser/AST/diagnostics + shared config, project model, capabilities
  compiler/              # .wx -> Lit render module
  runtime/               # browser runtime: resources/head/actions/analytics/HMR; Lit renderer at @wavex/runtime/lit
  vite-plugin/           # Vite+/Rolldown integration
  lsp/                   # planned: Volar-based wavex-language-server over the @wavex/core AST
```

Public package names:

```txt
wavex
@wavex/core
@wavex/compiler
@wavex/runtime
@wavex/vite-plugin
@wavex/lsp        (planned)
```

Web Awesome / Font Awesome metadata loading lives in `@wavex/core` capabilities for now; separate metadata packages are a possible later split, not part of the current shape.

## 6. Routing

Routes are inferred from files under `src/pages/`.

```txt
src/pages/index.wx          -> /
src/pages/about.wx          -> /about
src/pages/tasks/index.wx    -> /tasks
src/pages/tasks/[id].wx     -> /tasks/:id
src/pages/docs/[...slug].wx -> /docs/*slug
```

### Generated outputs

```txt
dist/
  index.html
  about/index.html
  tasks/index.html
  _wx/
    runtime.js
    routes.generated.js
    routes/
      index.assets.js
      about.assets.js
      tasks.index.assets.js
      tasks.id.assets.js
```

### Document shell and mount contract

`index.html` carries no framework mount node — no `<div id="app">`. The body contains only the bootstrap module script, and the WAVEx bootstrap renders the app directly under `<body>` so the app's own root element is the first element in the body:

```html
<body>
  <script type="module" src="/@wavex/bootstrap"></script>
</body>
```

By convention the root layout renders `@page` (`<wa-page>`) as that root element, composing its named slots (`banner`, `header`, `navigation`, `main-header`, `aside`, `footer`, …) through native `slot:` attributes:

```txt
document.body
  -> <wa-page>            (app-rendered root, from src/pages/+layout.wx)
  -> route content        (native slot composition)
```

Prerendered HTML emits the same shape, so the served document and the hydrated document agree, with no wrapper divs in either. `<wa-page>` expects zeroed `html`/`body` margins (`html, body { min-height: 100%; margin: 0; padding: 0 }`, or Web Awesome's native styles), which WAVEx default styles should provide.

### Client navigation

Native links remain native:

```wx
a href:/tasks Tasks
```

The host intercepts internal navigations progressively:

```txt
click link
  -> History API pushState
  -> match route
  -> import route assets
  -> set route/params in WAVEx runtime
  -> render/bind
  -> PostHog pageview
  -> start route-scoped Convex subscriptions
```

If JavaScript fails, prerendered pages should still provide useful HTML for public/SEO pages.

Per the reuse principle, the client router should be evaluated against `@lit-labs/router` before hand-rolling route matching and asset loading; WAVEx-specific work should be limited to the file-convention route table and Convex subscription scoping.

## 7. `.wx` Template Language

`.wx` is an indentation-based template language inspired by Haml/Slim but designed specifically for Wavex, Web Awesome, Convex, and strict compile-time inference.

### File anatomy

A `.wx` file may start with a TypeScript prelude. The `~~~` wave separator marks where WAVEx template syntax begins.

```wx
type Task = Doc<"tasks">

function taskLabel(task: Task) {
  return task.isCompleted ? `${task.text} ✓` : task.text
}

~~~

+head
  title Tasks | WAVEx
  meta name:description content:"Manage your tasks"

$$tasks:list

main [stack gap-xl]
  @card with-header
    h1 Tasks

    +for task in tasks
      @checkbox checked:{{ task.isCompleted }}
        = taskLabel(task)
```

Rules:

- Everything before `~~~` is optional TypeScript.
- Everything after `~~~` is `.wx` template syntax.
- Convex generated types such as `Doc<"tasks">` and `Id<"tasks">` should be available automatically; users should not manually import Convex generated files in ordinary `.wx` prelude code.
- Template-only files may omit the prelude, but `~~~` remains the explicit seam once colocated TypeScript is used.
- Page metadata belongs in `+head`, not frontmatter.

### Basic examples

```wx
main [stack gap-xl]
  @card [stack gap-m] with-header appearance:filled
    div [cluster gap-s align-items-center] slot:header
      @icon name:rocket
      span *WAVEx* demo

    p This template lives in `src/pages/index.wx`.

    @button variant:brand appearance:filled :click:increment
      @icon name:plus
      | Increment
```

### Element forms

```wx
div
span Hello
p This is prose.
```

Expands to native HTML.

### Component shorthand and lookup chain

`@` is the component shorthand. It can resolve to local Wavex template components or Web Awesome components.

```wx
@button variant:brand
@icon name:plus variant:solid
@card with-header appearance:filled
@task-card task:
@tasks/item done:{{ true }}
```

Proposed lookup order:

1. App/template components in `src/components/`.
2. Web Awesome components.

Examples:

```txt
@tasks/item -> src/components/tasks/item.wx
@task-card  -> src/components/task-card.wx
@button     -> src/components/button.wx if present, otherwise <wa-button>
```

Local components intentionally shadow Web Awesome components without warning. This lets an app define `src/components/card.wx` as its house-styled card wrapper, and that component can render the underlying Web Awesome component explicitly.

```wx
// src/components/card.wx
@wa/card with-header appearance:filled
  slot
```

Explicit forms:

```wx
@wa/card variant:brand
@components/card
```

### Wavex directive shorthand

`+` is reserved for Wavex directives/control primitives that compile away or produce runtime IR, not regular components.

```wx
+for task in tasks
+if tasks.empty
+boundary
+loading
+error err
```

Expands initially to internal `wx-*` markers or directly to compiler/runtime IR. These do not necessarily become DOM nodes in production.

### Convex shorthand

`$` and `$$` are reserved for public Convex function references and calls. This keeps Convex paths like `tasks:list` visually distinct from Wavex attribute syntax.

```txt
$module:function   -> reference to a public Convex function
$$module:function  -> call/bind/invoke a public Convex function
```

Examples:

```wx
$tasks:list
$$tasks:list
$$tasks:get args:{{ { id: route.params.id } }}
$$deeply/nested:list
$$deeply:nested:list
```

Nested Convex module paths normalize to Convex's generated function path form, e.g. `convex/deeply/nested.ts` export `list` becomes `deeply/nested:list`. WAVEx accepts slash-separated module paths and colon-separated nested shorthand in source.

`$tasks:list` is a reference. It can be passed around as data or metadata without invoking the Convex function.

`$$tasks:list` calls/binds the function in the current template context. The compiler infers the function kind from Convex generated types/manifest and emits the correct runtime dispatch.

The `module:function` address is WAVEx source syntax, not the long-term runtime ABI. If `convex/tasks.ts` exports a public Convex `list` query, `$tasks:list` / `$$tasks:list` resolves through generated Convex metadata to the typed generated reference, e.g. `api.tasks.list` in Convex's generated API shape. The runtime bridge should call the official Convex client with generated references whenever possible rather than relying on string paths as the public contract.

```txt
public query    -> subscribe/query resource
public mutation -> client.mutation
public action   -> client.action
```

Bare `$$module:function` lines are only valid for public queries, because they create live resources. Public mutations/actions require an explicit trigger such as `:click:`, `:submit:`, or a colocated TypeScript handler. This avoids side effects during render/load.

```wx
$$tasks:list

form :submit:$$tasks:create
  @input name:text

@button :click:$$tasks:clearCompleted
  | Clear completed
```

Convex `internal` functions are backend-only and should be hidden from client `.wx` completions. Referencing an internal function from a client template is a diagnostic. Convex `httpAction` functions are endpoint/webhook/proxy concerns and are not template-callable in MVP.

Resource bindings are inferred by convention. `as:name` is only needed to override or resolve collisions.

```txt
$$tasks:list     -> tasks
$$tasks:get      -> task
$$user:me        -> user
$$projects:list  -> projects
```

Inference rules should stay simple:

- Use the last module path segment as the resource name.
- Collection-style functions such as `list`, `all`, `search`, and paginated queries bind to the plural resource name.
- Singleton-style functions such as `get`, `one`, `load`, `byId`, and `me` bind to a singular resource name.
- If two resources would bind to the same name in one scope, require explicit `as:name`.

### Attribute syntax

Prefer colon syntax. Bare values are literal strings unless the grammar defines the token as a boolean/no-value attribute or a WAVEx directive target.

```wx
@button variant:neutral appearance:outlined :click:reset
@icon name:rotate-left variant:solid
```

Quotes are only needed when a literal value contains spaces or special characters:

```wx
@input label:"Full name"
meta name:description content:"A Wavex app"
```

TypeScript expressions in attribute/directive values must be explicit with `{{ ... }}`. This keeps parsing and LSP mapping simple and avoids guessing whether a bare value is a string or code.

```wx
@checkbox checked:{{ task.isCompleted }}
meta name:description content:{{ task.summary }}
$$tasks:get args:{{ { id: route.params.id } }}
+for task in tasks key:{{ task.slug }}
```

A trailing colon with no value is shorthand for passing the in-scope value with the same name, like `{ task }` in JavaScript object shorthand.

```wx
@tasks/item task:
```

is equivalent to:

```wx
@tasks/item task:{{ task }}
```

This is primarily for local/template component attrs and directive/resource bindings. For native/Web Awesome attributes, use explicit literal values such as `variant:brand` or explicit expression values such as `checked:{{ task.isCompleted }}`.

Do not use `::task` or `task::` for same-name prop shorthand. The missing value in `task:` is intentionally visible and reads as “infer the value for this prop.” Reserve `name::expr` for a possible future expression shorthand, e.g. `disabled::pending` as sugar for `disabled:{{ pending }}`, but it is not MVP syntax.

### Directive attributes

```txt
:click:reset      -> data-wx-click="reset"
on:click:reset    -> raw DOM/custom event listener for `click`
on:wa-show:opened -> raw DOM/custom event listener for `wa-show`
```

Proposed meaning:

- `:event:value` is a Wavex semantic action/event directive. Its value is an action target/reference such as `reset` or `$$tasks:create`, not an implicit TypeScript expression. It can compile to delegated data attributes, route actions, mutation helpers, analytics hooks, etc.
- `on:event:handler` is the lower-level DOM/custom-event escape hatch. It should compile to `addEventListener`, not inline `onclick` JavaScript.
- When a directive needs TypeScript data, keep that data in explicit expression attributes such as `args:{{ { id: task._id } }}`.

The earlier `::click` idea is likely not useful enough for DOM events. Reserve `::` for a future expression shorthand, or leave it unused.

### Utility class shorthand

Bracket groups are whitespace-separated Web Awesome / WAVEx utility class suffixes. WAVEx simply prefixes each token with `wa-`; there is no semantic mapping table or `name:value` utility grammar.

```wx
main [stack gap-xl]
div [cluster gap-s align-items-center justify-content-space-between]
section [grid gap-m]
p [caption-l brand]
```

Example expansion:

```wx
div [cluster gap-s align-center]
```

```html
<div class="wa-cluster wa-gap-s wa-align-center"></div>
```

Custom ids/classes remain explicit:

```wx
section id:hero class:marketing-hero [stack gap-xl]
```

This avoids overloading Slim/Haml `#foo` and `.bar`, since Wavex apps should mostly use Web Awesome/WAVEx utilities rather than custom CSS. If an app needs a raw class that should not receive the `wa-` prefix, use `class:`.

### Prose shorthand

Inline prose should support a strict, opinionated WAVEx subset so authors do not need to drop into deeply nested text/code/span nodes for common inline content.

```wx
p This template lives in `src/pages/index.wx` and uses *strong*, _emphasis_, and ~mark~.
```

Expansion:

```html
<p>This template lives in <code>src/pages/index.wx</code> and uses <strong>strong</strong>, <em>emphasis</em>, and <mark>mark</mark>.</p>
```

MVP inline spans:

```txt
`code`    -> <code>
*strong*  -> <strong>
_em_      -> <em>
~mark~    -> <mark>
```

MVP can require delimiters to be paired within the same text run and can reject or escape ambiguous nesting. This is not Markdown and should not grow into Markdown. No blockquote/table/link/list/heading shorthand is required for MVP. The goal is strict, predictable inline spans inside normal `.wx` text.

## 8. Template Components and Slots

Reusable template chunks live in `src/components/`.

```txt
src/components/app-shell.wx
src/components/task-card.wx
```

Usage:

```wx
@app-shell title:"Tasks"
  @task-card task:
```

Nested component paths are supported:

```wx
@tasks/item done:{{ true }}
```

which resolves by default to:

```txt
src/components/tasks/item.wx
```

Native `slot` should be used, not `+slot`.

```wx
// src/components/app-shell.wx
main [stack gap-xl]
  header
    slot name:header
  section
    slot
```

For compile-time components, the compiler may consume `slot` and project children. For runtime custom elements, the browser handles native slots.

## 9. State and Rendering

State should exist as a primitive, but the public API does not need to expose a JavaScript-signals mental model.

Internally, signals/reactive cells are likely a good implementation strategy for:

- local component state
- route params
- Convex query results
- mutation pending/error states
- derived values
- head/meta updates

The initial renderer should use Lit as an implementation detail, not as the app authoring model. WAVEx compiles `.wx` to render modules that call a renderer adapter.

```txt
Convex/local state change
  -> WAVEx invalidates affected resource/component scope
  -> generated render function runs
  -> Lit patches DOM with stable node identity where possible
```

Generated list rendering should use keyed primitives from the beginning. Most keys should be inferred from obvious identity fields such as `_id`, `id`, or `key`; explicit `key:` is only required when identity cannot be inferred or the author wants a different key.

```wx
+for task in tasks
  @tasks/item task:

+for task in tasks key:{{ task.slug }}
  @tasks/item task:
```

This preserves focus, enables animation/transition potential, and avoids the route-wide replace-all model.

Public API options can start as colocated TypeScript helpers in the `.wx` prelude:

```wx
const count = state(0)

function increment() {
  count.value += 1
}

~~~

p Count: {{ count }}
@button :click:increment Increment
```

MVP can start simpler with exported handlers, Convex resource state, and template interpolation, then grow toward first-class state cells.

## 10. Data and Convex

Convex realtime is required. Convex functions will still be authored in TypeScript and developed with `convex dev` in the default `convex/` folder.

The official Convex browser client should be bundled through Vite+ and wrapped by the WAVEx runtime bridge for MVP.

```txt
WAVEx runtime
  -> Convex host/client bridge
  -> official Convex browser client
  -> Convex realtime backend
```

### Convex resources, references, and calls

Proposed template syntax uses `$$` for a query resource binding:

```wx
$$tasks:list
  +loading
    @spinner
    span Loading tasks…

  +error err
    @callout variant:danger
      | {{ err.message }}

  ul
    +for task in tasks
      li
        @task-card task:
```

With params:

```wx
$$tasks:get args:{{ { id: route.params.id } }}
  h1 {{ task.title }}
```

The compiler infers route data dependencies from `$$` Convex query bindings, `$` Convex references, mutation/action triggers, forms, and handler usage.

### Deep Convex integration goals

WAVEx should leverage the fact that Convex is non-negotiable rather than treating it like a generic fetch client.

Potential integration points:

- Parse `convex/**/*.ts` and/or generated Convex types to discover exported `query`, `mutation`, `action`, and `httpAction` functions.
- Generate a function manifest with path, kind, argument shape, return shape, visibility, and auth requirements where possible.
- Let templates refer to Convex functions by `$module:function` references and `$$module:function` calls/bindings without manual registration.
- Resolve `module:function` source addresses against the generated Convex API shape, e.g. `tasks:list` -> `api.tasks.list`, so the runtime bridge can use typed generated references whenever possible.
- Infer whether `$$module:function` dispatches through `client.onUpdate/query`, `client.mutation`, or `client.action` from Convex function kind.
- Hide `internal` Convex functions from client `.wx` completions and report diagnostics if referenced from client templates.
- Treat `httpAction` functions as endpoint/webhook/proxy concerns, not template-callable functions in MVP.
- Infer route subscriptions, mutation/action assets, optimistic updates, pending states, and error states from template usage.
- Deduplicate identical subscriptions across nested components and routes.
- Keep route query caches live across navigation when useful.
- Support prefetching route code, Web Awesome assets, icons, and Convex query data together.
- Generate typed Convex handles and ambient types for `.wx` TypeScript preludes.

### Convex-aware template primitives

Queries bound with bare `$$` lines are live by default:

```wx
$$tasks:list
  +loading
    @skeleton

  +empty
    @empty-state title:"No tasks yet"

  +error err
    @error-card error:

  +for task in tasks
    @tasks/item task:
```

Paginated Convex queries should have a first-class shape. The compiler can infer paginated Convex queries from the manifest and `page-size` usage:

```wx
$$posts:list page-size:25
  +for post in posts
    @post-card post:

  @button :click:posts.loadMore disabled:{{ posts.done }}
    | Load more
```

Route params and URL search params should be available as reactive inputs:

```wx
$$tasks:get args:{{ { id: route.params.id } }}
$$tasks:list args:{{ { status: route.query.status } }}
```

Forms should map native `FormData` to Convex mutation args:

```wx
form :submit:$$tasks:create
  @input name:text label:"New task" required
  @button type:submit variant:brand Add task
```

Actions can use the same action system, with pending/error/result state. The compiler infers whether the target is a mutation or action from Convex metadata/types:

```wx
@button :click:$$ai:summarize args:{{ { id: task._id } }}
  +pending
    @spinner
    | Summarizing…
  +idle
    | Summarize
```

Potential specialized primitives:

```wx
+auth required
  slot

+signed-in as:user
  @user-menu user:

+signed-out
  @login-button

+upload storage:attachments as:file
  @file-input name:attachment
```

### Route-scoped subscriptions

On navigation:

```txt
unsubscribe previous route resources
subscribe current route resources
render loading/stale state
rerender on Convex update
clean up on route leave
```

### Parallel loading

Sibling queries/resources should start in parallel by default.

```wx
+suspense reveal:together
  $$user:me
  $$projects:list
  @dashboard user: projects:
```

Nested dependencies create intentional waterfalls.

## 11. Async, Suspense, and Loading States

Async resources should have explicit lifecycle states:

```txt
idle
pending
success
error
stale
```

Proposed syntax:

```wx
+suspense reveal:progressive
  +loading
    @spinner

  +error err
    @error-card error:

  $$tasks:list
    @task-list tasks:
```

Possible suspense/reload modes:

```txt
reveal:together
reveal:progressive
refresh:background
```

`refresh:background` keeps previously loaded content visible while a resource refreshes.

## 12. Mutations, Actions, and Forms

Native forms should remain first-class.

```wx
form :submit:$$tasks:create
  @input name:text label:"New task" required
  @button type:submit variant:brand
    @icon name:plus
    | Add task
```

The host/runtime can convert form submission to `FormData`, call the Convex mutation/action with the correct client method inferred from Convex metadata, expose pending/error state, and optionally reset fields. The compiler can use the Convex function manifest to validate form field names against args.

Pending/error UI could be directive-based:

```wx
@button type:submit
  +pending
    @spinner
    | Saving…
  +idle
    | Save

+mutation-error err
  @callout variant:danger
    | {{ err.message }}
```

### Colocated TypeScript Convex API

Templates should cover common cases, but colocated TypeScript handlers also need first-class Convex access. The compiler should generate/inject a typed API surface from the Convex manifest and generated data model.

Possible `.wx` prelude shape:

```ts
type Task = Doc<"tasks">
type TaskId = Id<"tasks">

async function toggle(taskId: TaskId) {
  await api.tasks.toggle.mutate({ id: taskId })
}

async function summarize(taskId: TaskId) {
  return await api.ai.summarize.action({ id: taskId })
}
```

Under the hood for MVP, these calls use the WAVEx runtime bridge and the bundled official Convex browser client.

```txt
colocated TS typed args
  -> generated/runtime Convex API wrapper
  -> ConvexClient.mutation/action/query/onUpdate
  -> typed result/resource state
```

Realtime queries should return resource handles rather than one-shot fetches when used as resources:

```ts
const tasks = api.tasks.list.subscribe({})
// tasks.status: "loading" | "ready" | "error" | "stale"
// tasks.value: Task[] when ready
```

Mutations/actions should expose lifecycle state for templates and handlers:

```ts
const createTask = api.tasks.create.mutationState()
// createTask.pending, createTask.error, createTask.call(args)
```

Long term, the Convex protocol could still be ported to Zig, but the public WAVEx API should not change if the implementation swaps between the official JS client and a Zig realtime client.

## 13. Error Boundaries

Errors should be handled with boundaries and route-level fallbacks.

```wx
+boundary
  +error err
    @callout variant:danger
      strong {{ err.title }}
      p {{ err.message }}
      @button :click:err.retry Try again

  $$tasks:list
    @task-list tasks:
```

File-level fallbacks:

```txt
src/pages/+error.wx
src/pages/tasks/+error.wx
```

Error categories:

```txt
RenderError
QueryError
MutationError
ActionError
NavigationError
NetworkError
AuthError
```

In dev, errors should show an overlay with template file, route/component, Convex path, host stack, and retry/reload options.

## 14. Layouts

Use file-based layouts.

```txt
src/pages/+layout.wx
src/pages/+error.wx
src/pages/tasks/+layout.wx
src/pages/tasks/[id].wx
```

Layouts compose through native `slot`.

```wx
// src/pages/+layout.wx
main [stack gap-xl]
  @site-nav
  slot
```

Route graph:

```txt
root layout
  -> nested layout
    -> page
```

## 15. Head and Meta

WAVEx does not use frontmatter for page metadata. Use a normal `+head` directive in the template.

```wx
+head
  title This is my title
  meta name:description content:"This is my description"
```

Because `+head` is part of the template, dynamic head values are natural:

```wx
+head
  title {{ task.title }} | WAVEx
  meta name:description content:{{ task.summary }}
  link rel:canonical href:{{ route.url }}
```

Client runtime updates `document.title` and managed head nodes.

Prerender/SSR emits the same head nodes into HTML.

## 16. Web Awesome and Font Awesome Asset Strategy

The compiler builds a route/component dependency graph.

For each route it infers:

- used `wa-*` components
- used `<wa-icon>` names, families, variants, and icon libraries/sources
- used template components and their transitive dependencies

Generated route assets for the Vite+ path should import package `dist` modules from the detected Web Awesome provider so Vite+/Rolldown can resolve bare imports and dedupe Lit/Web Awesome dependencies:

```js
// If Web Awesome Pro is installed
import "@web.awesome.me/webawesome-pro/dist/components/button/button.js";
import "@web.awesome.me/webawesome-pro/dist/components/card/card.js";
import "@web.awesome.me/webawesome-pro/dist/styles/webawesome.css";

// If a free/public Web Awesome package is installed, generate equivalent imports
// from that package instead.
```

`dist-cdn` is only for no-bundler/browser-direct research such as the earlier Zig/static spike. The plain `dist` build intentionally contains bare package imports such as `lit` and `@shoelace-style/localize`, which are exactly what the Vite+ build should resolve.

The public WAVEx packages should treat Web Awesome packages as optional capabilities, not bundled dependencies. Apps bring their own installed free or Pro package.

Font Awesome should not ship full Pro webfonts by default. Prefer selected SVGs or generated sprites from the installed free package, Pro package, kit package, or local icon provider. Icon metadata should match the Web Awesome / Font Awesome API shape: `name`, optional `family`, optional `variant`, and optional `library`/source. Providers can translate that shape to their package-specific SVG folder layout.

```txt
assets/fontawesome/svgs/solid/plus.svg
assets/fontawesome/svgs/solid/rocket.svg
```

Potential future optimization:

```txt
per-route SVG sprites
shared app sprite
icon preloading
```

## 17. PostHog

PostHog should be first-class but configurable.

Potential modes:

1. Bundled official PostHog browser client.
2. Minimal capture-only client for baseline events.
3. Optional full client/session replay/surveys loaded lazily.
4. Optional proxy through Convex HTTP actions or another proxy adapter.

Framework events should be implicit for WAVEx semantic activity:

```txt
$pageview on route navigation
route prefetch events
form submission events
mutation/action events
error boundary events
```

`:track:` overrides or enriches the default event name/metadata for a semantic action rather than being the only way to track.

```wx
@button :click:save :track:task_saved Save
```

## 18. Language Tooling, Editor Support, and Package Capabilities

WAVEx should treat DX as a core feature. The `.wx` syntax is most valuable when the editor understands the shorthand and can complete/validate Convex functions, Web Awesome components, Font Awesome icons, and TypeScript expressions.

### Single parser, no second grammar

Decision (2026-06): the `@wavex/core` TypeScript parser is the single source of truth for `.wx`. It is consumed by the compiler today and by the future LSP. An earlier Tree-sitter grammar and Zed dev extension were deleted rather than maintained as a second, drift-prone grammar definition; they should not be reintroduced. Volar does not require Tree-sitter — Vue, Astro, and MDX all drive Volar with their own parsers.

```txt
.wx source
  -> @wavex/core parse (AST with source ranges)
  -> compiler render modules / LSP virtual documents
  -> diagnostics / completions / semantic tokens
```

Editor syntax highlighting comes from LSP semantic tokens, which work across VS Code, Zed, Neovim, Helix, and Emacs without per-editor grammars. A thin TextMate grammar is optional later for highlight-before-LSP-boots and GitHub views — drift-tolerant and cosmetic only, never a parsing input.

### Volar-based, TypeScript-first LSP

The WAVEx LSP (`@wavex/lsp`) should be built on Volar over the `@wavex/core` AST. Volar provides the virtual-document machinery (source maps between `.wx` regions and embedded TypeScript) that Vue and Astro already rely on, which is the big unlock for the typed-template DX: template expressions checked against prelude, Convex, and Web Awesome types is the main reason to prefer `.wx` over TSX, so this work should start early — it depends only on the parser, not on the runtime slices.

The LSP should be TypeScript/Node-based, not Zig-based, because the deepest intelligence comes from TypeScript-native sources:

- the TypeScript language service
- Convex generated types and API metadata
- Web Awesome package metadata and component typings
- Font Awesome installed package/kit contents
- Vite/Node module resolution and `tsconfig`

The LSP should create virtual TypeScript documents for `.wx` preludes and template expressions through Volar's virtual-code mapping, then map completions, diagnostics, hover, and go-to-definition back to source positions in `.wx` (the `@wavex/core` AST already carries source ranges).

It should provide completions and diagnostics for:

- `@` component names from local components and installed Web Awesome packages.
- Web Awesome attributes, properties, slots, events, and enum-like values.
- `$module:function` Convex references and `$$module:function` query/mutation/action calls/bindings.
- Inferred Convex function kind so calls dispatch through query/subscription, mutation, or action correctly.
- Diagnostics for client references to internal functions or `httpAction` endpoints.
- Convex argument/result types and generated `Doc<"table">` / `Id<"table">` ambient types.
- `@icon name:`, `family:`, `variant:`, and `library:` from installed Font Awesome packages/kits.
- `[stack gap-xl]` Web Awesome/WAVEx utility shorthands.
- TypeScript expressions in preludes, interpolations, `name:{{ expression }}` attributes/directive payloads, and props.

### Agent-facing tooling

The language core should also power CLI/JSON commands useful to coding agents and CI:

```sh
wavex check
wavex inspect src/pages/home.wx --json
wavex completions src/pages/home.wx --line 12 --character 8 --json
wavex explain src/pages/home.wx --json
```

These should expose derived facts such as inferred Convex resources, Web Awesome components, Font Awesome icons, diagnostics, generated asset imports, and render-module shape.

### Capability-based Web Awesome and Font Awesome support

WAVEx should not hard-require the commercial/pro packages. It should detect capabilities from installed dependencies. Public packages should use optional peer dependencies / soft resolution where possible; app projects install whichever Web Awesome and Font Awesome packages they are licensed to use.

```txt
Web Awesome free installed -> free components/props/events
Web Awesome Pro installed  -> free + pro components/patterns/charts
Font Awesome free installed -> free icon completions/imports
Font Awesome Pro kit installed -> kit/pro icon completions/imports
```

If a template uses a missing capability, the LSP/compiler should produce targeted diagnostics:

```txt
@chart requires a Web Awesome package that provides <wa-chart>.
Icon name:"unicorn" family:"duotone" variant:"solid" was not found in installed Font Awesome packages/kits.
```

This keeps WAVEx open-sourceable while supporting BYO licensed assets. The project can be shared publicly without bundling licensed Web Awesome Pro or Font Awesome Pro files.

Internally, capability detection can be modeled as providers, but a public custom provider API is out of scope for MVP. The `@` syntax should initially resolve only local WAVEx components and detected Web Awesome packages.

Internal provider shape:

```ts
type UiProvider = {
  name: string;
  components: Map<string, ComponentMeta>;
  resolveImport(component: string): string;
};

type IconProvider = {
  name: string;
  icons: Map<string, IconMeta>;
  resolveIcon(ref: { name: string; family?: string; variant?: string; library?: string }): string;
};
```

Provider priority should remain predictable:

```txt
src/components/ local templates by default
  -> installed Web Awesome Pro package if present
  -> installed Web Awesome free package if present

installed Font Awesome kit/package icons by name/family/variant/library
  -> local app icons if supported
```

## 19. Development and Hot Reloading

WAVEx should have a first-class dev command built on Vite+ HMR.

```txt
wavex dev
  -> ensure Convex dev is running or clearly ask user to run it separately
  -> start Vite+ once
  -> watch .wx/templates/components/public/runtime files
  -> rebuild only changed compiler output/assets
  -> notify browser via Vite HMR
```

Reload strategy:

```txt
CSS change          -> Vite stylesheet HMR
.wx template change -> regenerate route/component module, accept HMR, rerender current scope
TS prelude change   -> hot update module if safe, otherwise route/component reload
WA/FA dep change    -> regenerate asset imports, Vite reloads affected module
runtime change      -> full reload if HMR cannot preserve state
```

Possible state preservation hooks:

```ts
export function snapshotState(): unknown;
export function restoreState(snapshot: unknown): void;
```

Current dev workflow:

```sh
# In two terminals, from apps/todo
npx convex dev
pnpm dev
```

## 20. Plain JavaScript Escape Hatches

Escape hatches should be ES modules and web-standard friendly.

Element lifecycle hooks:

```wx
div :mount:"./charts.js#mountChart" :unmount:"./charts.js#destroyChart"
```

Custom elements should work directly:

```wx
my-chart data:{{ chartJson }}
```

Module scripts:

```wx
+script src:"./enhance.js"
```

Inline arbitrary JS should be avoided or treated as an explicit unsafe escape hatch.

## 21. Prerender / SEO / SSR Plan

### Tier 1: Prerendered Client App

This is the primary SEO and initial-load plan for MVP. The app is still browser-based; prerendering is an output optimization, not the app identity.

```txt
.wx route
  -> expanded HTML
  -> prerendered dist/path/index.html
  -> client boot binds events and starts Convex realtime
```

Since compiled output is Lit templates, prerendering should be evaluated on top of `@lit-labs/ssr` rather than a bespoke HTML serializer.

Good for:

- landing pages
- docs
- marketing
- public app pages
- public data snapshots

### Tier 2: Prerendering with Convex build-time data

Build step calls Convex HTTP API for public data and prerenders known routes.

```txt
wavex prerender / build hook
  -> query Convex HTTP API
  -> render HTML
  -> deploy client assets + prerendered HTML
```

### Tier 3: Optional Edge SSR Adapter

Keep a plan for real SSR without making it the default.

```txt
edge function / worker
  -> load WAVEx SSR renderer
  -> fetch Convex HTTP data for initial render
  -> emit HTML + serialized initial data
  -> browser hydrates and starts Convex realtime
```

This introduces runtime infrastructure only when needed.

## 22. Full-Stack / Worker Future

Even if MVP is browser app + Convex, avoid designing out future adapters.

Potential adapters:

```txt
static-assets
edge-ssr
worker
convex-only
```

Potential future structure:

```txt
server/
workers/
functions/
```

But Convex remains the default backend. Any full-stack support should be an adapter layer, not a second required backend stack.

## 23. Open Questions

1. ~~How neutral should the generated render IR be versus compiling directly to Lit templates?~~ Resolved 2026-06: compile directly to Lit templates; no neutral IR for MVP.
2. What is the exact HMR contract for `.wx` page/component modules and colocated TypeScript state preservation?
3. What is the exact `.wx` grammar for strict inline prose spans, and how much of it belongs in the parser versus semantic lowering?
4. Which Web Awesome/WAVEx utility suffixes should be documented as recommended `[utility]` tokens now that utilities are simple `wa-` prefix expansion rather than a mapping table?
5. Should a future `name::expr` shorthand be added for `name:{{ expr }}`, and if so where is it worth the extra syntax?
6. What is the first-class state API for colocated TypeScript and/or generated runtime modules?
7. How much Convex query/mutation syntax belongs in templates vs colocated TypeScript handlers?
8. Should PostHog baseline use official client or minimal capture-only client?
9. What hydration/resume behavior is needed for prerendered HTML versus client-only route modules?
10. What is the smallest credible prerender implementation on top of the Vite+ path?
11. What package names and provider priority should be used for Web Awesome free vs Pro detection?
12. How much of the LSP should rely on virtual TypeScript files versus custom semantic completions?

## 24. Proposed MVP Sequence

1. Vite+/Lit runtime foundation
   - extract a real WAVEx runtime from the initial Vite spike (done: `@wavex/runtime`)
   - switch Web Awesome imports from `dist-cdn` to package `dist`
   - import/share Lit through Vite+
   - compile `.wx` to render modules instead of static HTML strings
   - support keyed `+for` output using Lit primitives

2. `.wx` parser MVP
   - `@` component lookup shorthand
   - `+` directive/control shorthand
   - `name:value` literal attrs and `name:{{ expression }}` expression attrs
   - `:event:value` directives
   - `[stack gap-xl]` utilities via simple `wa-` prefix expansion
   - inline text
   - `~~~` TypeScript/template separator
   - automatic Convex ambient types in TS prelude
   - `+head` directive
   - strict inline prose spans: `` `code` ``, `*strong*`, `_em_`, and `~mark~`
   - parser is the `@wavex/core` TypeScript parser (decided 2026-06; no Tree-sitter)

3. Package capability detection
   - detect installed Web Awesome free/Pro providers
   - detect installed Font Awesome packages/kits/local icons
   - generate capability-backed component/icon imports
   - surface missing capability diagnostics

4. Hot reloadable `.wx` modules
   - Vite HMR for page/component modules
   - preserve Convex client/resource state across template edits
   - rerender current route/component scope through Lit

5. Multi-route generation
   - file-based routes
   - per-route asset modules
   - client navigation

6. Template components
   - `src/components/*.wx`
   - native `slot`
   - transitive asset inference

7. Convex realtime bridge
   - bundled official Convex browser client
   - `$module:function` references and `$$module:function` Convex resources/calls
   - route-scoped subscriptions
   - loading/error states

8. Forms/mutations
   - native `form`
   - `:submit:$$module:function`
   - pending/error state

9. Prerendered HTML
   - emit `dist/path/index.html`
   - `+head` metadata
   - hydrate/resume with the same runtime/resource graph

10. Error boundaries
   - local `+boundary`
   - route `+error.wx`

11. PostHog integration
   - pageviews
   - custom events
   - proxy strategy decision

12. Volar LSP baseline — may start in parallel with items 5–11; it depends only on the `@wavex/core` parser
   - `@wavex/lsp` on Volar over the `@wavex/core` AST
   - semantic tokens for editor highlighting (replaces the deleted Tree-sitter/Zed syntax layer)
   - `@` component completions
   - `$module:function` and `$$module:function` Convex completions
   - Web Awesome prop/value diagnostics
   - Font Awesome icon completions
   - virtual TypeScript diagnostics for prelude/expressions, including `name:{{ expression }}` values
   - optional thin TextMate grammar for highlight-before-LSP-boots and GitHub views (cosmetic only)

13. Demo app
   - build a realistic app in final-ish syntax
   - work backwards from missing features
