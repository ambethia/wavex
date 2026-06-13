---
title: Convex and forms
---

# Convex references, calls, and forms

## Convex references and calls

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

## Forms, events, and actions

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
