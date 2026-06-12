# WAVEx User-Facing Spec Draft

> Status: draft. This document specifies the author-facing WAVEx app model and `.wx` syntax. It intentionally omits implementation, dev tooling, editor, and packaging details.

## 1. Goals

WAVEx is an opinionated app syntax for browser-based realtime apps built around:

- `.wx` templates with optional colocated TypeScript.
- File-based pages and layouts.
- First-class Convex resources, mutations, and actions.
- First-class Web Awesome components and utilities.
- First-class Font Awesome icons.
- First-class page metadata and analytics hooks.

## 2. App Structure

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

These paths are framework law. WAVEx tooling should not support alternate page or component roots.

### Document shell

WAVEx owns the document body. `index.html` contains no mount element (no `<div id="app">`); the app renders directly under `<body>`. The root layout conventionally renders `@page` (Web Awesome `<wa-page>`) as the app's root element, filling its named regions through native `slot:` attributes:

```wx
// src/pages/+layout.wx
@page
  header slot:header [cluster gap-m align-items-center]
    @site-nav
  slot
```

## 3. Router

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

### Error routes

`+error.wx` defines a route-level fallback for sibling and descendant pages.

```txt
src/pages/+error.wx
src/pages/tasks/+error.wx
```

## 4. `.wx` File Anatomy

A `.wx` file contains a TypeScript prelude followed by a WAVEx template body. The prelude may be empty, but the `~~~` wave pragma is always required and marks where template syntax begins.

```wx
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
- Prelude code may define types, constants, functions, and handlers used by the template.
- Convex ambient types such as `Doc<"tasks">`, `Id<"tasks">`, and `api` are available to `.wx` files.

## 5. Template Basics

`.wx` templates are indentation-based.

```wx
main [stack gap-xl]
  h1 Tasks
  p Manage your tasks.
```

Indentation defines parent/child relationships. WAVEx uses strict 2-space indentation only. Each nesting level is exactly two spaces. Tabs are invalid, and indentation that is not a multiple of two spaces is invalid.

Line comments begin with `//`.

```wx
// This line is ignored.
p This line renders.
```

### Native elements

Native HTML elements use the tag name directly.

```wx
section
  h1 Hello
  p Welcome to WAVEx.
```

Inline text may follow the element head.

```wx
p Hello world.
```

### Text and expressions

Explicit text lines use `|`.

```wx
p
  | Hello from WAVEx.
```

Expression lines use `=`.

```wx
p
  = label(task)
```

Interpolations use `{{ ... }}` inside text.

```wx
p Hello, {{ user.name }}.
```

## 6. Inline Prose Spans

WAVEx supports a strict inline prose subset for common inline elements.

```wx
p This lives in `src/pages/index.wx` and uses *strong*, _emphasis_, and ~mark~.
```

Expansion:

```html
<p>This lives in <code>src/pages/index.wx</code> and uses <strong>strong</strong>, <em>emphasis</em>, and <mark>mark</mark>.</p>
```

MVP inline spans:

```txt
`code`    -> <code>
*strong*  -> <strong>
_em_      -> <em>
~mark~    -> <mark>
```

This is not Markdown. No blockquote, table, link, list, or heading shorthand is specified for MVP. Ambiguous nesting may be rejected or escaped.

## 7. Attributes and Values

Attributes use colon syntax.

```wx
@button variant:brand appearance:filled
@input label:"Full name" required
```

Boolean attributes omit the value.

```wx
@card with-header
@input required
```

Quoted values are strings.

```wx
@input label:"New task"
meta name:description content:"Manage your tasks"
```

Expression values may use identifiers, paths, calls, or object expressions.

```wx
@checkbox checked:task.isCompleted
@button disabled:createTask.pending
$$tasks:get args:{ id: route.params.id }
```

A trailing colon with no value passes the in-scope value with the same name.

```wx
@tasks/item task:
```

is equivalent to:

```wx
@tasks/item task:task
```

Explicit `id` and `class` are allowed.

```wx
section id:hero class:marketing-hero [stack gap-xl]
```

## 8. Utility Shorthand

Bracket groups map to Web Awesome utility classes by direct `wa-` prefix expansion.

```wx
main [stack gap-xl]
div [cluster gap-s align-items-center justify-content-space-between]
section [grid gap-m]
```

Each token is the literal Web Awesome utility suffix: `stack` → `wa-stack`, `gap-xl` → `wa-gap-xl`. There is no mapping table and no colon form — `:` inside a bracket group is invalid; colons belong to attributes.

Mirroring `@` component lookup, utility tokens are shorthand for real `wa-*` classes, except where WAVEx adds its own utilities on top: a WAVEx-defined utility class may resolve a token first, with everything else passing straight through to `wa-` prefix expansion.

Example expansion:

```wx
div [cluster gap-s align-items-center]
```

```html
<div class="wa-cluster wa-gap-s wa-align-items-center"></div>
```

## 9. Components

`@` is the component shorthand.

```wx
@button variant:brand
@card with-header
@icon name:plus family:solid
@task-card task:
@tasks/item task:
```

Lookup order:

1. Local `.wx` components in `src/components/`.
2. Web Awesome components from the installed Web Awesome package.

Examples:

```txt
@tasks/item -> src/components/tasks/item.wx
@task-card  -> src/components/task-card.wx if present
@button     -> local button component if present, otherwise <wa-button>
```

Explicit Web Awesome lookup uses `@wa/`.

```wx
@wa/card with-header
```

Local components intentionally shadow Web Awesome components.

### Component inputs

Components receive the attributes written at their invocation site — the same colon-attribute syntax used everywhere else; there is no separate props concept. A component that declares `type Attrs = { ... }` in its prelude gets each declared attribute as a bare, typed local in its template:

```wx
import type { Doc } from "../../convex/_generated/dataModel"

type Attrs = { talk: Doc<"talks"> }

~~~

@card
  strong {{ talk.title }}
  p {{ talk.speaker }}
```

Without an `Attrs` declaration, attributes are available on an untyped `attrs` record (`attrs.talk`).

### Slots

Use native `slot`, not a WAVEx-specific slot directive.

```wx
// src/components/app-shell.wx
main [stack gap-xl]
  header
    slot name:header
  section
    slot
```

## 10. Directives

`+` is reserved for WAVEx directives.

### `+head`

`+head` declares page metadata.

```wx
+head
  title Tasks | WAVEx
  meta name:description content:"Manage your tasks"
  link rel:canonical href:route.url
```

`+head` may use dynamic values.

```wx
+head
  title {{ task.title }} | WAVEx
  meta name:description content:task.summary
```

### `+if`

```wx
+if tasks.length === 0
  @empty-state title:"No tasks yet"
```

### `+for`

```wx
+for task in tasks
  @tasks/item task:
```

Dynamic lists need stable identity. WAVEx infers `key:` when the item type exposes an obvious identity property, in this order:

```txt
_id
id
key
```

So `+for task in tasks` can infer `key:task._id` for typical Convex documents. Use explicit `key:` when identity cannot be inferred or when a different key is desired.

```wx
+for task in tasks key:task.slug
  @tasks/item task:
```

### Async/resource states

Resource and mutation/action state directives include:

```wx
+loading
+empty
+error err
+pending
+idle
+mutation-error err
```

Example:

```wx
$$tasks:list
  +loading
    @skeleton

  +empty
    @empty-state title:"No tasks yet"

  +error err
    @callout variant:danger
      = err.message

  +for task in tasks
    @tasks/item task:
```

### `+boundary`

```wx
+boundary
  +error err
    @callout variant:danger
      strong {{ err.title }}
      p {{ err.message }}

  $$tasks:list
    @task-list tasks:
```

### `+suspense`

```wx
+suspense reveal:together
  $$user:me
  $$projects:list
  @dashboard user: projects:
```

Allowed reveal/refresh modes:

```txt
reveal:together
reveal:progressive
refresh:background
```

`refresh:background` means previously loaded content can stay visible while WAVEx refreshes the resource in the background.

## 11. Convex References and Calls

`$` and `$$` are reserved for public Convex functions.

```txt
$module:function   -> reference to a public Convex function
$$module:function  -> call/bind/invoke a public Convex function
```

Examples:

```wx
$tasks:list
$$tasks:list
$$tasks:get args:{ id: route.params.id }
$$deeply/nested:list
$$deeply:nested:list
```

Nested Convex module paths normalize to Convex's generated function path form, e.g. `convex/deeply/nested.ts` export `list` becomes `deeply/nested:list`. WAVEx accepts slash-separated module paths and colon-separated nested shorthand in source.

`$tasks:list` is a reference. It does not invoke the function.

`$$tasks:list` invokes or binds the function in the current context. Function kind is inferred from Convex metadata/types.

```txt
public query    -> query/subscription resource
public mutation -> mutation call
public action   -> action call
```

Bare `$$module:function` statements are valid only for public queries, where they create live resources.

```wx
$$tasks:list
  +for task in tasks
    @tasks/item task:
```

Public mutations/actions require an explicit trigger or handler.

```wx
form :submit:$$tasks:create
  @input name:text label:"New task" required
  @button type:submit variant:brand Add task

@button :click:$$tasks:clearCompleted
  | Clear completed

@button :click:$$ai:summarize({ id: task._id })
  +pending
    @spinner
    | Summarizing…
  +idle
    | Summarize
```

Convex `internal` functions are backend-only and unavailable in client `.wx` templates. `httpAction` functions are endpoint/webhook/proxy concerns and are not template-callable in MVP.

### Resource binding names

Resource names are inferred by convention. `as:name` overrides inference.

```txt
$$tasks:list     -> tasks
$$tasks:get      -> task
$$user:me        -> user
$$projects:list  -> projects
```

Rules:

- Use the last module path segment as the base resource name.
- Collection-style functions such as `list`, `all`, `search`, and paginated queries bind to plural names.
- Singleton-style functions such as `get`, `one`, `load`, `byId`, and `me` bind to singular names.
- If two resources collide, use `as:name`.

```wx
$$tasks:list as:openTasks status:"open"
```

### Resource arguments

Query arguments use the same colon-attribute syntax as everything else in WAVEx. Every attribute on a `$$` call other than the reserved `as:` and `args:` becomes a Convex argument:

```wx
$$tasks:get id:route.params.id
$$talks:list track:{{ route.query.track || undefined }}
$$questions:listByTalk talkSlug:route.params.slug
```

The explicit object form remains available for computed or spread-style argument objects, and may be combined with attribute args (attributes win on conflicts):

```wx
$$tasks:search args:{ ...savedFilters, query: state.query }
```

## 12. Forms, Events, and Actions

Native forms remain first-class.

```wx
form :submit:$$tasks:create
  @input name:text label:"New task" required
  @button type:submit variant:brand
    @icon name:plus
    | Add task
```

On submit, named form controls map to Convex args.

Semantic event directives use `:event:target`.

```wx
@button :click:reset Reset
@button :click:$$tasks:clearCompleted Clear completed
```

Raw DOM/custom events use `on:event:handler`.

```wx
@dialog on:wa-show:opened
@input on:input:updateDraft
```

Analytics are implicit for WAVEx semantic events: page navigation, form submissions, Convex mutation/action calls, and framework errors. Raw `on:` DOM listeners are not automatically tracked.

`:track:` overrides or enriches the default tracking event for a semantic action.

```wx
@button :click:save :track:task_saved Save
```

Without `:track:`, WAVEx still emits a conventional event name derived from the route, directive, handler, or Convex function. Automatic pageviews are part of WAVEx navigation semantics.

## 13. Icons

`@icon` resolves to the installed Font Awesome/Web Awesome icon integration.

```wx
@icon name:plus family:solid
@icon name:rocket
```

Icon availability depends on installed Font Awesome packages/kits and local app assets. Missing icons are authoring errors.

## 14. Reserved Syntax and MVP Exclusions

Reserved or excluded for MVP:

- `::` is reserved for a future high-value primitive.
- Markdown block syntax is not supported.
- Public custom `@` providers are out of scope.
- Convex `internal` functions are not client-template callable.
- Convex `httpAction` functions are not template-callable.
- Inline arbitrary JavaScript in templates is not part of the core syntax.
