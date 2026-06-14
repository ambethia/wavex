# @wavex/lsp

Volar-based language tooling for `.wx` files, including the
`wavex-language-server` binary (`@wavex/lsp/server`).

Built on Volar over the `@wavex/core` AST — the same parser the compiler
uses, so editor diagnostics cannot drift from compiler behavior. Volar's
virtual-code machinery maps `.wx` preludes and template expressions into
virtual TypeScript documents: completions, diagnostics, hover, and
go-to-definition come from the real TypeScript language service plus project
metadata, then map back to `.wx` source positions.

The service plugin adds the WAVEx-specific features: completions and
diagnostics for `@` components (local + installed Web Awesome), `+`
directives, `$`/`$$` Convex function references, and `[utility]` tokens, with
hover docs from Web Awesome's `custom-elements.json`. Project context comes
from `@wavex/core/capabilities` per workspace.

## Design notes

- Typed templates are the main reason `.wx` beats TSX, so the LSP depends
  only on the parser — not the runtime — and TypeScript-native sources
  (TS language service, Convex generated types, Web Awesome metadata,
  installed Font Awesome packages) provide the intelligence.
- Editor syntax highlighting is provided by the VS Code TextMate grammar in
  `editors/vscode/syntaxes/wavex.tmLanguage.json`. The grammar is cosmetic and
  drift-tolerant; the `@wavex/core` parser remains the only parsing input for
  diagnostics, completions, and type-aware language features.
- **Deferral:** no per-editor extensions beyond the LSP baseline.
