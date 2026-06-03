# @wavex/grammar

Tree-sitter grammar for WAVEx `.wx` files.

This package is intentionally separate from `@wavex/language-core`: Tree-sitter powers editor features such as syntax highlighting, injections, outline/folding, and structural selection, while `@wavex/language-core` remains the semantic parser used by the compiler and CLI.

## Development

```sh
cd wavex
pnpm --filter @wavex/grammar generate
pnpm --filter @wavex/grammar test
```

The initial grammar is line-oriented so Zed can highlight `.wx` files early. Semantic checks such as strict two-space indentation are still reported by `@wavex/language-core` and, later, the WAVEx LSP.
