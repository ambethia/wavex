# Changelog

WAVEx follows semantic versioning. During the alpha series, breaking changes
may still land between prereleases and are called out here.

## 0.1.0-alpha.0 (unreleased)

The first installable WAVEx alpha:

- `.wx` parser, diagnostics, project model, and capability detection.
- Lit compiler and browser runtime with Convex resources and actions.
- File-based routing, nested layouts, error routes, head management, and
  static prerendering.
- Vite+ integration, the `wavex` CLI, a Volar language server, and a VS Code
  extension.
- Todo and Swell Conf validation apps.

Alpha-readiness work adds repeatable CI, package and editor artifact checks,
browser smoke coverage, and router scroll restoration.

Changes existing apps should know about:

- `wavex check` type-checks `.wx` templates with the app's tsconfig (the same
  virtual TypeScript as the editor), so type errors now fail it. It requires a
  tsconfig.json, warns (WX105) when its `include` misses `.wx` files, and
  prints diagnostics as `file:line:col SEVERITY CODE message`.
- Template `state` is typed by augmenting `Register` in `@wavex/runtime`; the
  same type checks `mountLitApp`'s initial state and `app.update`.
- Bare boolean attributes on `@component` heads come from the installed Web
  Awesome manifest (`@button with-caret`). The hardcoded `indeterminate`,
  `with-header`, and `with-footer` list is gone, so native elements and local
  components no longer promote those words.
- With a Font Awesome kit or SVG package installed, the app's icons are
  validated (WX103/WX104) and served by the app instead of the Font Awesome
  CDN; name icons computed in TypeScript with `icon()` from `@wavex/runtime`.
- A monorepo's shared `convex/` directory is found from a workspace package.
- `+for` bodies and keys can use `index`; `index` cannot be the item name.
- `wavex check` takes any mix of directories and files: named `.wx` files are
  checked (grouped by app root) and other named files only contribute their
  `icon()` declarations, so a commit hook can pass every staged path.
