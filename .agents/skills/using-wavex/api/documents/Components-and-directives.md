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

Web Awesome boolean attributes are written bare, like native ones, because
WAVEx reads each component's boolean attributes from the installed package's
custom-elements manifest (see "Attributes and values" in the template syntax
guide):

```wx
@card with-header
@button slot:trigger appearance:plain with-caret
@dialog label:Details light-dismiss
```

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

Without an `Attrs` declaration, attributes are available on an untyped `attrs` record (`attrs.talk`). Typed `Attrs` keys must be safe JavaScript binding identifiers and must not reuse compiler-provided render locals (`actionStates`, `attrs`, `context`, `html`, `navigation`, `nothing`, `repeat`, `resourceStates`, `route`, `state`) or a `$$` resource binding name; the compiler reports a diagnostic instead of generating an ambiguous local.

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

Inside a loop — in its `key:` and throughout its body — `index` is the current
item's zero-based position. In nested loops it is the innermost loop's
position, and `index` cannot be used as the item name.

```wx
+for found in findings key:index
  li data-finding:{{ String(index) }} {{ index + 1 }}. {{ found.summary }}
```

A positional `key:index` suits lists that are only appended to or replaced
wholesale; when items can be reordered or removed, key by identity so rendered
elements move with their items.

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

`@icon` renders Web Awesome's `<wa-icon>`, which draws Font Awesome icons
through Web Awesome's default icon library. `family:` and `variant:` default to
`classic` and `solid`.

```wx
@icon name:plus
@icon name:rocket family:sharp variant:regular
@icon name:github family:brands
```

How icons are served depends on what the app installs:

- **A Font Awesome kit (`@awesome.me/kit-*`) or SVG package
  (`@fortawesome/fontawesome-free`, `@fortawesome/fontawesome-pro`).** WAVEx
  collects every icon the app uses, validates each against the package's SVG
  files, and serves exactly those files from the app itself at
  `<base><assetsDir>/wavex-icons/<folder>/<name>.svg` — the dev server serves
  them and the build emits them as assets. Icons never come from the Font
  Awesome CDN, so a Pro kit's icons work on any domain. Missing icons are
  authoring errors: `wavex check` and the build report WX103 with the location.
- **Only Web Awesome.** Icons load from the Font Awesome CDN (Web Awesome's
  default), names cannot be validated, and `wavex check` notes this with a
  WX101 info diagnostic. Font Awesome's JS-only `*-svg-icons` packages ship no
  SVG files, so they do not enable self-hosting.

WAVEx collects:

- Literal names, with literal `family:`/`variant:`: `@icon name:box`.
- The string literals that can be the value of a dynamic name — ternary
  branches, `||`/`??` operands, the last `&&` operand — never the operands of
  a comparison. `@icon name:{{ status === "done" ? "box" : "truck-fast" }}`
  collects `box` and `truck-fast`, not `done`.
- `icon("…")` declarations for names chosen in TypeScript. `icon` from
  `@wavex/runtime` returns its argument; WAVEx finds literal calls in the
  app's `src/` files and `.wx` preludes (non-literal calls are WX104 errors):

  ```ts
  import { icon } from "@wavex/runtime"

  const SUBJECT_ICONS = {
    survey: icon("clipboard-list"),
    payment: icon("credit-card"),
    brand: icon("github", { family: "brands" })
  } as const
  export const subjectIcon = (subject: keyof typeof SUBJECT_ICONS) => SUBJECT_ICONS[subject]
  ```

  ```wx
  @icon name:{{ subjectIcon(item.subject) }}
  ```

- The icons Web Awesome's own components request from the default library,
  such as `<wa-page>`'s navigation toggle.

Anything else — a name assembled at runtime, a dynamic `family:` or
`variant:` — is not collected. In dev, requesting an icon that was not
collected answers 404 and logs which icon to declare, because the build would
not include it either. Compiled `.wx` modules import `virtual:wavex/icons`
(which points Web Awesome at the app's icons) before their Web Awesome
components, so apps need no icon setup code. Custom kit icons
(`icons/svgs/custom-icons`) have no Web Awesome family and are not served;
use `src:` or a custom icon library for them.
