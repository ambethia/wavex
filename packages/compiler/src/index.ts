/**
 * Compiles parsed `.wx` files to Lit render modules.
 *
 * Compilation targets Lit templates directly — there is deliberately no
 * neutral render IR in between (decided 2026-06). The compiler lowers the
 * `@wavex/core` AST into a TypeScript module that exports a render function,
 * inferred Convex resource definitions, and head entries, leaving DOM
 * patching to the `@wavex/runtime/lit` backend.
 *
 * Key lowering rules carried by this package:
 * - `@name` component references resolve local `src/components/` templates
 *   first, then Web Awesome components — local components intentionally
 *   shadow Web Awesome without warning (see {@link componentTagForReference}).
 * - `[stack gap-xl]` utility groups are plain `wa-` prefix expansion with no
 *   semantic mapping table (see {@link utilityClassForToken}).
 * - `$module:fn` / `$$module:fn` Convex references lower to typed resource
 *   definitions and action targets dispatched by the runtime.
 *
 * @module @wavex/compiler
 */
export { compileWavexModule, componentTagForReference, utilityClassForToken } from "./compiler.js";
export type { CompileWavexOptions, CompileWavexResult } from "./compiler.js";
