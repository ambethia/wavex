---
title: Reserved syntax and exclusions
---

# Reserved syntax and MVP exclusions

Reserved or excluded for MVP:

- `::` is reserved for a future high-value primitive (a possible `name::expr`
  shorthand for `name:{{ expr }}` has been considered but is not syntax).
- Markdown block syntax is not supported; inline prose spans are a strict,
  non-Markdown subset.
- Public custom `@` providers are out of scope — `@` resolves only local
  components and detected Web Awesome packages.
- Convex `internal` functions are not client-template callable (referencing
  one is a diagnostic).
- Convex `httpAction` functions are not template-callable.
- Inline JavaScript statements, declarations, and block bodies are not part of
  the template grammar. Template heads accept TypeScript expressions in the
  documented expression positions (`+if`, `+for`, `=`, `{{ ... }}`, and dynamic
  attribute values), including calls and arrow callbacks for derived values.
  Move reusable or multi-statement logic into the TypeScript prelude.
