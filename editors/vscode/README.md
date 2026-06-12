# WAVEx for VS Code

Language support for `.wx` files:

- Syntax highlighting via a thin TextMate grammar (TypeScript injected into the
  prelude and `{{ … }}` interpolations) until the language server's semantic
  tokens take over.
- Diagnostics, completions (`@` components, `+` directives, `$$` Convex
  functions), hover, and typed template expressions via `@wavex/lsp`
  (Volar-based, driven by the `@wavex/core` parser).

The server type-checks against your workspace's own TypeScript
(`node_modules/typescript/lib`); override with the `wavex.typescript.tsdk`
setting.

## Development

```sh
pnpm install
pnpm --filter wavex-vscode build      # bundles dist/extension.cjs + dist/server.cjs
pnpm --filter wavex-vscode package    # produces the .vsix
```

Or open this folder in VS Code and press F5 for an Extension Development Host.
