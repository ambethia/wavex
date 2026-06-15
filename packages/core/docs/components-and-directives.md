---
title: Components and directives
---

# Components and directives

## Components

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

Without an `Attrs` declaration, attributes are available on an untyped `attrs` record (`attrs.talk`). Typed `Attrs` keys must not reuse compiler-provided render locals (`actionStates`, `attrs`, `context`, `html`, `navigation`, `nothing`, `repeat`, `resourceStates`, `route`, `state`) or a `$$` resource binding name; the compiler reports a diagnostic instead of generating an ambiguous local.

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

## Directives

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

## Icons

`@icon` resolves to the installed Font Awesome/Web Awesome icon integration.

```wx
@icon name:plus family:solid
@icon name:rocket
```

Icon availability depends on installed Font Awesome packages/kits and local app assets. Missing icons are authoring errors.
