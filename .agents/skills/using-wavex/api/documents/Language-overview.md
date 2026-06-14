# WAVEx language overview

WAVEx is an opinionated app syntax for browser-based realtime apps built around:

- `.wx` templates with optional colocated TypeScript.
- File-based pages and layouts.
- First-class Convex resources, mutations, and actions.
- First-class Web Awesome components and utilities.
- First-class Font Awesome icons.
- First-class page metadata and analytics hooks.

## App structure

A WAVEx app uses exactly this Vite/Convex-aligned structure:

```txt
src/
  pages/
  components/
convex/
public/
```

- `src/pages/` defines routes.
- `src/components/` contains reusable `.wx` components.
- `convex/` contains Convex functions and schema using the default Convex project shape.
- `public/` contains static files using the default Vite project shape.

These paths are framework law. WAVEx tooling does not support alternate page or component roots.

### Document shell

WAVEx owns the document body. `index.html` contains no mount element (no `<div id="app">`); the app renders directly under `<body>`. The root layout conventionally renders `@page` (Web Awesome `<wa-page>`) as the app's root element, filling its named regions through native `slot:` attributes:

```wx
// src/pages/+layout.wx
@page
  header slot:header [cluster gap-m align-items-center]
    @site-nav
  slot
```

## Router

Routes are inferred from `src/pages/`.

```txt
src/pages/index.wx          -> /
src/pages/about.wx          -> /about
src/pages/tasks/index.wx    -> /tasks
src/pages/tasks/[id].wx     -> /tasks/:id
src/pages/docs/[...slug].wx -> /docs/*slug
```

Route params and query params are available in templates and TypeScript prelude code:

```wx
p Task id: {{ route.params.id }}
p Filter: {{ route.query.status }}
```

Native links remain native:

```wx
a href:/tasks Tasks
```

### Layouts

`+layout.wx` defines a layout for sibling and descendant pages.

```txt
src/pages/+layout.wx
src/pages/tasks/+layout.wx
```

Layouts compose through native `slot`.

```wx
// src/pages/+layout.wx
main [stack gap-xl]
  @site-nav
  slot
```

Named slots use native `slot:name` attributes.

```wx
@page-shell
  h1 slot:title Tasks
  @task-list
```

### Navigation progress

The router exposes its lifecycle as the `navigation` template value — `navigation.pending` is true from link click until the next page commits, and `navigation.to` carries the destination route. Layouts render an nprogress-style indicator declaratively:

```wx
@page
  @site-nav
  +if navigation.pending
    @progress-bar indeterminate class:nav-progress
  slot
```

The router also mirrors the state onto `<html data-wx-navigating>`, so CSS-only indicators work without any template change. To avoid flashing on fast navigations, delay the reveal in CSS (e.g. an `animation-delay` before fading the bar in).

### View transitions

Client navigations are wrapped in the View Transitions API by default: a subtle cross-fade where supported, an instant swap everywhere else, and automatically skipped under `prefers-reduced-motion`. Back/forward navigations carry a direction type for CSS:

```css
::view-transition-old(root) { /* customize the default cross-fade */ }
:active-view-transition-type(backward) ::view-transition-new(root) { /* directional styling */ }
```

Opt out per app via the Vite plugin: `wavex({ viewTransitions: false })`. Initial loads and HMR swaps never transition.

### Error routes

`+error.wx` defines a route-level fallback for sibling and descendant pages.

```txt
src/pages/+error.wx
src/pages/tasks/+error.wx
```

## `.wx` file anatomy

A `.wx` file contains a TypeScript prelude followed by a WAVEx template body. The prelude may be empty, but the `~~~` wave pragma is always required and marks where template syntax begins.

```wx
import type { Doc } from "../../convex/_generated/dataModel"

type Task = Doc<"tasks">

function label(task: Task) {
  return task.text
}

~~~

+head
  title Tasks

$$tasks:list

main
  +for task in tasks
    p {{ label(task) }}
```

Rules:

- A line containing only `~~~` separates TypeScript prelude from template body.
- `~~~` is required in every `.wx` file.
- If no TypeScript is needed, `~~~` is the first non-comment line.
- Prelude code may define types, constants, functions, imports, and handlers used by the template.
- Convex `Doc` and `Id` types are ordinary TypeScript imports from the app's generated `convex/_generated/dataModel` module.
- The Convex `api` object is injected into compiled template expressions for resource/action dispatch; prelude TypeScript should still import any Convex types it references explicitly.
