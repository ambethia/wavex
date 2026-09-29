import { dirname, resolve } from "node:path";
import { createTypeScriptInferredChecker } from "@volar/kit";
import type { Diagnostic } from "@wavex/core";
import ts from "typescript";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { createWavexLanguagePlugin, type WavexParseOptionsResolver } from "./language.js";
import { parseOptionsForFile } from "./project-context.js";

/** Inputs for {@link typeCheckWavexFiles}. */
export interface WavexTypeCheckOptions {
  /** The app root; its nearest tsconfig.json (searching upward, like the editor) configures the check. */
  appRoot: string;
  /** Absolute paths of the `.wx` files to check. */
  files: readonly string[];
  /** Parse context per file; defaults to the language server's (detected local components and Web Awesome booleans). */
  parseOptionsFor?: WavexParseOptionsResolver;
}

/** Result of {@link typeCheckWavexFiles}. */
export interface WavexTypeCheckResult {
  /** The tsconfig.json used, or undefined when none was found (nothing was checked). */
  tsconfig?: string;
  /** Problems reading or parsing the tsconfig, positioned in the tsconfig file. */
  configErrors: Diagnostic[];
  /**
   * Checked files the tsconfig's `include`/`files` do not cover. The check
   * still uses the tsconfig's options for them, but an editor places such
   * files in an inferred project with default options, so the two can disagree
   * until the tsconfig includes `.wx` files.
   */
  notIncluded: string[];
  /** TypeScript errors and warnings per file, positioned in the `.wx` source (1-based), codes like `TS2339`. */
  diagnostics: Map<string, Diagnostic[]>;
}

const WX_EXTENSION: ts.FileExtensionInfo = { extension: "wx", isMixedContent: true, scriptKind: ts.ScriptKind.Deferred };

/**
 * Type-check `.wx` files exactly as the language server does: the same
 * Volar virtual code (prelude, template expressions, `+for`/`+error` scopes,
 * Convex resource types, registered `state`) run through the TypeScript
 * language service with the app's tsconfig options. The checked files join
 * the tsconfig's root files, so ambient declarations the app includes (such
 * as its `Register` augmentation) are visible.
 *
 * Uses the TypeScript this package depends on, so apps compiled with a
 * native TypeScript (7.x, no JavaScript API) can still be checked.
 */
export async function typeCheckWavexFiles(options: WavexTypeCheckOptions): Promise<WavexTypeCheckResult> {
  const tsconfig = ts.findConfigFile(resolve(options.appRoot), ts.sys.fileExists, "tsconfig.json");
  const result: WavexTypeCheckResult = { tsconfig, configErrors: [], notIncluded: [], diagnostics: new Map() };
  if (!tsconfig) return result;

  const syntax = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (syntax.error) {
    result.configErrors = [toWavexDiagnostic(syntax.error)];
    return result;
  }
  const config = ts.readJsonConfigFile(tsconfig, ts.sys.readFile);
  const parsed = ts.parseJsonSourceFileConfigFileContent(config, ts.sys, dirname(tsconfig), undefined, tsconfig, undefined, [WX_EXTENSION]);
  // "No inputs were found" only means the include patterns match nothing yet; the checked files are added below.
  result.configErrors = parsed.errors.filter((error) => error.code !== 18003).map(toWavexDiagnostic);

  const included = new Set(parsed.fileNames.map((fileName) => resolve(fileName)));
  const files = options.files.map((file) => resolve(file));
  result.notIncluded = files.filter((file) => !included.has(file));
  const rootFiles = [...new Set([...parsed.fileNames.map((fileName) => resolve(fileName)), ...files])];

  const checker = createTypeScriptInferredChecker(
    [createWavexLanguagePlugin(options.parseOptionsFor ?? parseOptionsForFile)],
    createTypeScriptServices(ts),
    () => rootFiles,
    parsed.options
  );
  for (const file of files) {
    const diagnostics = (await checker.check(file))
      .filter((diagnostic) => diagnostic.source === "ts" && (diagnostic.severity === 1 || diagnostic.severity === 2))
      .map(
        (diagnostic): Diagnostic => ({
          code: `TS${diagnostic.code}`,
          severity: diagnostic.severity === 1 ? "error" : "warning",
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          message: typeof diagnostic.message === "string" ? diagnostic.message : diagnostic.message.value
        })
      );
    if (diagnostics.length > 0) result.diagnostics.set(file, diagnostics);
  }
  return result;
}

function toWavexDiagnostic(diagnostic: ts.Diagnostic): Diagnostic {
  const position = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : undefined;
  return {
    code: `TS${diagnostic.code}`,
    severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
    line: (position?.line ?? 0) + 1,
    column: (position?.character ?? 0) + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  };
}
