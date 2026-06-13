/**
 * Volar-based language tooling for `.wx` files.
 *
 * The LSP is built on Volar over the `@wavex/core` AST — the same parser the
 * compiler uses, so editor diagnostics cannot drift from compiler behavior.
 * Volar's virtual-code machinery maps `.wx` TypeScript preludes and template
 * expressions into virtual TypeScript documents, so completions, diagnostics,
 * hover, and go-to-definition come from the real TypeScript language service
 * plus Convex, Web Awesome, and Font Awesome metadata, then map back to `.wx`
 * source positions. Editor syntax highlighting comes from LSP semantic tokens
 * rather than per-editor grammars.
 *
 * @module @wavex/lsp
 */
export { createWavexLanguagePlugin, WavexVirtualCode, WAVEX_LANGUAGE_ID } from "./language.js";
export { createWavexServicePlugin, type WavexServiceOptions, type WavexServiceOptionsResolver } from "./service.js";
