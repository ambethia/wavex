# Template syntax

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

## Native elements

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

## Text and expressions

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

## Inline prose spans

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

## Template context values

Compiled templates receive a runtime context and expose its common entries as bare expression roots:

- `route` — current route (`route.path`, `route.params`, `route.query`).
- `attrs` — attributes passed to a local `.wx` component.
- `state` — app-provided local state. WAVEx does not mutate this object for you; pass it through the mount/update context when a host integration owns client-only state.
- Resource bindings such as `tasks` or `talk` — live values created by `$$` query resources.
- `resourceStates` — lifecycle details for those query resources; prefer `+loading`, `+empty`, and `+error` inside the resource block for ordinary UI states.
- `actionStates` — lifecycle details for semantic Convex mutation/action targets. Use this when UI needs an action result or error outside the built-in `+pending`, `+idle`, and `+mutation-error` children.
- `navigation` — client navigation lifecycle (`navigation.pending`, `navigation.to`).

```wx
@button :click:$$ai/summarize:run({ slug: talk.slug })
  +pending
    @spinner
    | Summarizing…
  +idle
    | AI summary

+if actionStates["$$ai/summarize:run"]?.result
  p {{ actionStates["$$ai/summarize:run"].result }}
```

## Attributes and values

Attributes use colon syntax.

```wx
@button variant:brand appearance:filled
@input label:"Full name" required
```

Recognized HTML and WAVEx-defined boolean attributes omit the value.

```wx
video autoplay muted loop
@card with-header
@input required
```

Bare prose is still text, so hyphenated text such as `p easy-going folks` does not become an attribute.

Quoted values are strings.

```wx
@input label:"New task"
meta name:description content:"Manage your tasks"
```

Unquoted values are static strings by default. This keeps Web Awesome enum-style
attributes concise.

```wx
@button variant:brand appearance:filled
@input autocomplete:off
```

Dynamic values use expression-shaped TypeScript: member paths, calls,
object/array literals, numeric literals, unambiguous operators, or one of the
built-in roots (`route`, `attrs`, `state`, `api`, `ctx`, `context`). Bare
identifier values on boolean attributes are also expressions so
`checked:isDone` binds the boolean value instead of the string `"isDone"`.
Ambiguous hyphenated bare values remain static strings; use `{{ ... }}` to mark
them explicitly as expressions.

```wx
@checkbox checked:isDone
@checkbox checked:task.isCompleted
@input maxlength:42
@button disabled:createTask.pending
$$tasks:get args:{ id: route.params.id }
@input value:{{ task }}
```

A trailing colon with no value passes the in-scope value with the same name. Use
this for bare identifier expressions; `task:task` is a static string value, while
`task:` passes the `task` binding.

```wx
@tasks/item task:
```

Explicit `id` and `class` are allowed.

```wx
section id:hero class:marketing-hero [stack gap-xl]
```

## Utility shorthand

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
