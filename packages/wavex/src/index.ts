/**
 * The `wavex` CLI package: agent- and CI-friendly commands over the language
 * core (`wavex check`, route inspection, compilation), plus programmatic
 * re-exports of the most common compiler and core entry points.
 *
 * @module wavex
 */
export { compileWavexModule } from "@wavex/compiler";
export { createDefaultConfig, createRouteDefinition, parseWavex, routePathFromPageFile } from "@wavex/core";
