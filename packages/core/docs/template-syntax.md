---
title: Template syntax
---

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

## Attributes and values

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
