/**
 * Parser, AST, diagnostics, and the shared project model for `.wx` files.
 *
 * This package is the single source of truth for the WAVEx language. The
 * TypeScript parser exported here is the only `.wx` parser definition,
 * consumed by both the compiler and the Volar-based LSP. Cosmetic editor
 * grammars, such as the VS Code TextMate grammar, must stay drift-tolerant and
 * never become parser inputs.
 *
 * `.wx` is an indentation-based template language with an optional TypeScript
 * prelude separated by `~~~`. The parser produces an AST with source ranges
 * (so LSP features can map back to `.wx` positions) plus structured
 * diagnostics instead of throwing. The language itself is documented in the
 * guides under `packages/core/docs/`.
 *
 * @module @wavex/core
 */
export * from "./model.js";
export type * from "./ast.js";
export { parseAttributeToken, parseWavex, type ParseWavexOptions } from "./parser.js";
