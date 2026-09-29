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

The runtime stores each mutation/action lifecycle under `actionStates["$$module:function"]`. The key is the normalized target without inline args, even when the event used `({ ... })`. `+pending`, `+idle`, and `+mutation-error` cover the common loading/error UI inside the triggering element; read `actionStates` directly when the page needs the settled result elsewhere.

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
- Resource binding names must be safe JavaScript binding identifiers and must not reuse compiler-provided render locals (`actionStates`, `attrs`, `context`, `html`, `navigation`, `nothing`, `repeat`, `resourceStates`, `route`, `state`). The compiler reports a diagnostic instead of emitting a local that would shadow or break template scope.

```wx
$$tasks:list as:openTasks status:"open"
```

### Resource arguments

Query arguments use the same colon-attribute syntax as everything else in WAVEx. Every attribute on a `$$` call other than the reserved `as:`, `args:`, and `paginate:` becomes a Convex argument:

```wx
$$tasks:get id:route.params.id
$$talks:list track:{{ route.query.track || undefined }}
$$questions:listByTalk talkSlug:route.params.slug
```

The explicit object form remains available for computed or spread-style argument objects, and may be combined with attribute args (attributes win on conflicts):

```wx
$$tasks:search args:{ ...savedFilters, query: state.query }
```

Args are re-evaluated on every render — navigation, resource updates, local
handlers, and `app.update({ state })` from an app-owned entry — so a resource
follows the values it reads. When its args change, WAVEx subscribes with the
new args and unsubscribes the old ones; the previous value stays bound (with
status `loading`) until the new result arrives.

### Conditional resources

A `$$` resource subscribes only while the template would render its line:
while every enclosing `+if` holds. When a condition stops holding, WAVEx
unsubscribes and removes the binding and its `resourceStates` entry; when it
holds again, the resource subscribes afresh. This is WAVEx's form of Convex's
`"skip"`, so a query that needs a signed-in user, or an id the page does not
have yet, is simply written inside the `+if` that guards the UI using it.

```wx
+if state.auth.user
  $$pledges:list paginate:20
    +for pledge in pledges key:pledge.id
      p {{ pledge.campaignName }}

  +if state.pledges.detailId
    $$pledges:detail as:pledgeDetail id:state.pledges.detailId
      +if pledgeDetail
        h2 {{ pledgeDetail.campaignName }}
```

Args are evaluated only while the conditions hold, so they can rely on the
guard's narrowing — `id:state.pledges.detailId` is never `null` above, both at
runtime and in the type checker. The same works for a query that depends on
another resource:

```wx
$$talks:get slug:route.params.slug
+if talk
  $$questions:listByTalk talkSlug:talk.slug
```

Only `+if` gates subscriptions; `+suspense`, `+boundary`, and the resource and
action state directives do not. Resources are per page, not per item, so a
`$$` line inside `+for` is an error (WX021): its args and conditions could not
see the loop item.

### Paginated resources

`paginate:N` binds a Convex paginated query one page of `N` items at a time.
The query takes `paginationOpts: paginationOptsValidator` alongside its other
args and returns `.paginate(args.paginationOpts)`; WAVEx supplies
`paginationOpts`, so it is never written in the template.

```ts
// convex/questions.ts
export const listByTalk = query({
  args: { talkSlug: v.string(), paginationOpts: paginationOptsValidator },
  handler: (ctx, args) =>
    ctx.db
      .query("questions")
      .withIndex("by_talk_votes", (q) => q.eq("talkSlug", args.talkSlug))
      .order("desc")
      .paginate(args.paginationOpts)
});
```

```wx
$$questions:listByTalk talkSlug:talk.slug paginate:10
  +loading
    @spinner
  +empty
    p No questions yet.
  +for question in questions key:question._id
    p {{ question.text }}
  +if resourceStates.questions?.hasPreviousPage || resourceStates.questions?.hasNextPage
    nav [cluster gap-s]
      @button :click:questions.previousPage disabled:{{ !resourceStates.questions?.hasPreviousPage }} Previous
      @button :click:questions.nextPage disabled:{{ !resourceStates.questions?.hasNextPage }} Next
```

- The binding (`questions`) is the current page's items, typed from the
  query's `PaginationResult`. `paginate:` must be a whole number (WX022).
- `resourceStates.questions.hasPreviousPage` is true past the first page;
  `hasNextPage` is true once the current page has loaded and is not the last
  (false while a page loads or after it fails).
- `:event:name.nextPage` and `:event:name.previousPage` move between pages.
  These targets are reserved for paginated resources declared in the same
  file (WX023); a move with no page in that direction does nothing.
- Each page is a live Convex subscription: items added to or removed from the
  current page's range appear on it immediately, so a page can hold more or
  fewer than `N` items. Moving to the next page starts where the current one
  ends, and moving back starts that page afresh, so every item stays reachable
  by paging. If Convex reports that a page read too much data to return
  completely, WAVEx ends the page at Convex's split point and the rest starts
  the next page.
- While another page loads, the previous page's items stay bound with status
  `loading`.
- `+empty` means the list is empty: the current page has no items and there
  is no other page. An empty first page of a filtered query can still have a
  next page.
- Changing the resource's args, or closing its `+if`, returns it to the first
  page. The page position is kept per resource while its query, args, and page
  size stay the same.

Pages replace each other; WAVEx does not accumulate pages into one growing
list.

### Signed-in resources and app-owned clients

A Convex client authenticated by the app (`convex.setAuth(…)` on the client
passed to `mountLitApp` as `resourceClient` and `actionClient`) serves both
`$$` resources and `:event:$$module:fn` actions, so they run as the signed-in
user. Put resources that require a user inside an `+if` on the app's auth
state, and publish that state when Convex has accepted the token (from
`setAuth`'s `onChange`):

```wx
+if state.auth.signedIn
  $$readiness:get
```

- Sign-in: `app.update({ state })` with the signed-in state subscribes every
  gated resource. Convex pauses its connection while `setAuth` fetches a
  token, so queries subscribed meanwhile run with that token.
- Sign-out: update the state first, so the gated resources unsubscribe, then
  clear the client's auth (`convex.setAuth(async () => null)`). In the other
  order, Convex re-runs the still-live queries without a user and they report
  errors.
- Convex re-runs live queries when the token changes, so a resource that is
  subscribed across a token refresh keeps updating as the same user.

See the `@wavex/vite-plugin` README for an app-owned entry module.

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

For semantic Convex events on non-form elements, `data-*` attributes become Convex args. WAVEx ignores `data-wx-*` because those are reserved for the compiler/runtime event bridge. Kebab-case data attributes are converted to camelCase argument names.

```wx
@checkbox data-id:todo._id :change:$$tasks:toggle
@button data-talk-slug:route.params.slug :click:$$questions:upvote
```

The runtime invokes the mutations with `{ id: todo._id }` and `{ talkSlug: route.params.slug }` respectively.

Semantic event directives use `:event:target`.

```wx
@button :click:reset Reset
@button :click:$$tasks:clearCompleted Clear completed
```

`name.nextPage` and `name.previousPage` move the paginated resource `name`
(see "Paginated resources"). Any other non-Convex target is the name of a
function in that `.wx` module's TypeScript prelude. The compiler attaches the function to the rendered element
without serializing it into HTML; the delegated runtime invokes it with the DOM
`Event` and rerenders the mounted page after it runs. Async handlers are
awaited.

```wx
let draft = ""

function reset(event: Event) {
  event.preventDefault()
  draft = ""
}

~~~
button :click:reset Reset
p
  | Draft: {{ draft }}
```

Semantic `submit` handlers prevent native submission automatically. A local
target that does not resolve to a prelude function falls through to an
app-provided render-context `dispatch`, when present; otherwise the runtime
reports a console diagnostic. The same applies to `$$module:fn` targets when
no Convex client is configured (for example, `VITE_CONVEX_URL` is unset): the
action is not marked successful and its form is not reset. Custom mounts can
replace that diagnostic with `onUnhandledAction`.

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
