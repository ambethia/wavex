import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { CodeMapping, LanguagePlugin, VirtualCode } from "@volar/language-core";
import { forEachEmbeddedCode } from "@volar/language-core";
// Side-effect import: augments LanguagePlugin with the `typescript` integration hook.
import "@volar/typescript";
import {
  extractAttrsTypeKeys,
  parseWavex,
  type ResourceBinding,
  type SourceRange,
  type TemplateNode,
  type WavexFile
} from "@wavex/core";
import type * as ts from "typescript";
import type { URI } from "vscode-uri";

/** The LSP language id for `.wx` documents. */
export const WAVEX_LANGUAGE_ID = "wavex";

const FULL_CAPABILITIES: CodeMapping["data"] = {
  completion: true,
  format: false,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true
};

/**
 * Volar language plugin: recognizes `.wx` files and produces a
 * {@link WavexVirtualCode} per document, with the embedded TypeScript code
 * registered as the TypeScript service script so prelude and template
 * expressions are type-checked by the real TS language service.
 */
export function createWavexLanguagePlugin(): LanguagePlugin<URI> {
  return {
    getLanguageId(uri) {
      return uri.path.endsWith(".wx") ? WAVEX_LANGUAGE_ID : undefined;
    },
    createVirtualCode(uri, languageId, snapshot) {
      if (languageId !== WAVEX_LANGUAGE_ID) return undefined;
      return new WavexVirtualCode(snapshot, uri.scheme === "file" ? uri.fsPath : undefined);
    },
    typescript: {
      extraFileExtensions: [{ extension: "wx", isMixedContent: true, scriptKind: 7 }],
      getServiceScript(root: VirtualCode) {
        for (const code of forEachEmbeddedCode(root)) {
          if (code.id === "ts") {
            return { code, extension: ".ts", scriptKind: 3 satisfies ts.ScriptKind.TS };
          }
        }
        return undefined;
      }
    }
  };
}

interface MappedExpression {
  sourceOffset: number;
  text: string;
}

/**
 * The Volar virtual code for one `.wx` document: parses with the
 * `@wavex/core` parser (the single parser), keeps the AST for non-TS
 * features, and emits an embedded TypeScript document that maps the prelude
 * and every `{{ … }}` / attribute expression back to its `.wx` source range.
 */
export class WavexVirtualCode implements VirtualCode {
  id = "root";
  languageId = WAVEX_LANGUAGE_ID;
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];
  ast: WavexFile;

  constructor(public snapshot: ts.IScriptSnapshot, fsPath?: string) {
    const source = snapshot.getText(0, snapshot.getLength());
    this.ast = parseWavex(source);
    // The root code keeps the document text for non-TS features.
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [source.length],
        data: FULL_CAPABILITIES
      }
    ];
    this.embeddedCodes = [createTypeScriptCode(source, this.ast, fsPath)];
  }
}

/** Relative import to convex/_generated/api from the .wx file, when the app has one. */
function convexApiImportPath(fsPath: string | undefined): string | undefined {
  if (!fsPath) return undefined;
  let dir = dirname(fsPath);
  for (let depth = 0; depth < 20; depth += 1) {
    if (existsSync(join(dir, "convex", "_generated", "api.d.ts"))) {
      const relativePath = relative(dirname(fsPath), join(dir, "convex", "_generated", "api"))
        .split("\\")
        .join("/");
      return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

function createTypeScriptCode(source: string, ast: WavexFile, fsPath?: string): VirtualCode {
  const mappings: CodeMapping[] = [];
  let generated = "";

  const append = (text: string) => {
    generated += text;
  };
  const appendMapped = (text: string, sourceOffset: number) => {
    mappings.push({
      sourceOffsets: [sourceOffset],
      generatedOffsets: [generated.length],
      lengths: [text.length],
      data: FULL_CAPABILITIES
    });
    generated += text;
  };

  // 1. Prelude maps verbatim at offset 0.
  if (ast.prelude.length > 0) {
    appendMapped(ast.prelude, 0);
    append("\n");
  }

  // 2. Ambient template context (unmapped scaffolding).
  append("\ndeclare const route: { path: string; params: Record<string, string>; query: Record<string, string> };\n");
  // Components declaring `type Attrs = { ... }` get typed attrs plus each
  // attribute as a bare, typed local — mirroring page-level resource bindings.
  const attrsKeys = extractAttrsTypeKeys(ast.prelude);
  if (attrsKeys) {
    append("declare const attrs: Attrs;\n");
    for (const key of attrsKeys) {
      if (/^[A-Za-z_$][\w$]*$/.test(key)) append(`declare const ${key}: Attrs[${JSON.stringify(key)}];\n`);
    }
  } else {
    append("declare const attrs: Record<string, any>;\n");
  }
  append("declare const state: Record<string, any>;\n");
  append("declare const resourceStates: Record<string, any>;\n");
  append("declare const actionStates: Record<string, any>;\n");
  append(
    "declare const navigation: { pending: boolean; to?: { path: string; params: Record<string, string>; query: Record<string, string> } };\n"
  );

  // 2b. Resource bindings typed from the app's generated Convex api: the
  //     query's return type (or any when no generated api is found).
  const apiImport = ast.resources.length > 0 ? convexApiImportPath(fsPath) : undefined;
  if (apiImport) {
    append(`import type { api as __wxApi } from ${JSON.stringify(apiImport)};\n`);
    append(`import type { FunctionReturnType as __WxReturn } from "convex/server";\n`);
  }
  const declaredResources = new Set<string>();
  for (const resource of ast.resources) {
    if (!/^[A-Za-z_$][\w$]*$/.test(resource.name) || declaredResources.has(resource.name)) continue;
    declaredResources.add(resource.name);
    if (apiImport) {
      append(`declare const ${resource.name}: __WxReturn<typeof __wxApi`);
      appendMappedConvexApiPath(source, resource, { append, appendMapped });
      append(`> | undefined;\n`);
    } else {
      append(`declare const ${resource.name}: any;\n`);
    }
  }

  // 3. Template expressions type-check inside their template scopes (+for
  //    items, +error bindings), mapped back to source.
  append("export function __wxTemplateExpressions() {\n");
  emitNodes(source, ast.nodes, { append, appendMapped });
  append("}\n");
  append("export {};\n");

  const snapshot: ts.IScriptSnapshot = {
    getText: (start, end) => generated.slice(start, end),
    getLength: () => generated.length,
    getChangeRange: () => undefined
  };

  return { id: "ts", languageId: "typescript", snapshot, mappings };
}

interface Emitter {
  append(text: string): void;
  appendMapped(text: string, sourceOffset: number): void;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function appendMappedConvexApiPath(source: string, resource: ResourceBinding, emitter: Emitter): void {
  const rawAddress = resource.address.raw;
  const rawOffset = source.indexOf(rawAddress, resource.range.start.offset);
  if (rawOffset === -1 || rawOffset >= resource.range.end.offset) {
    throw new Error(`Unable to locate Convex resource address ${JSON.stringify(rawAddress)} in source range.`);
  }

  const withoutSigilsOffset = rawOffset + (rawAddress.startsWith("$$") ? 2 : 1);
  const withoutSigils = rawAddress.slice(rawAddress.startsWith("$$") ? 2 : 1);
  const splitIndex = withoutSigils.lastIndexOf(":");
  const rawModulePath = withoutSigils.slice(0, splitIndex);
  const expectedSegments = [...resource.address.modulePath.split("/"), resource.address.functionName];
  const sourceSegments = [...rawModulePath.matchAll(/[^/:]+/g)].map((match) => ({
    text: match[0],
    offset: withoutSigilsOffset + (match.index ?? 0)
  }));
  sourceSegments.push({
    text: withoutSigils.slice(splitIndex + 1),
    offset: withoutSigilsOffset + splitIndex + 1
  });

  if (sourceSegments.length !== expectedSegments.length) {
    throw new Error(`Convex resource address ${JSON.stringify(rawAddress)} did not match normalized API path.`);
  }

  for (const [index, expected] of expectedSegments.entries()) {
    const sourceSegment = sourceSegments[index]!;
    if (sourceSegment.text.replace(/:/g, "/") !== expected) {
      throw new Error(`Convex resource segment ${JSON.stringify(sourceSegment.text)} did not match ${JSON.stringify(expected)}.`);
    }

    if (IDENTIFIER.test(expected)) {
      emitter.append(".");
      emitter.appendMapped(expected, sourceSegment.offset);
    } else {
      emitter.append("[");
      emitter.append(JSON.stringify(expected).slice(0, 1));
      emitter.appendMapped(expected, sourceSegment.offset);
      emitter.append(JSON.stringify(expected).slice(-1));
      emitter.append("]");
    }
  }
}

/**
 * Emit template expressions as checked statements, introducing the bindings
 * template directives create: +for items (typed from the collection), +error /
 * +mutation-error / +boundary error bindings (unknown), and handler references
 * from raw and custom semantic events (so prelude functions count as used).
 */
function emitNodes(source: string, nodes: readonly TemplateNode[], emitter: Emitter): void {
  const seenOffsets = new Set<number>();

  const sourceForRange = (range: SourceRange | undefined) => (range ? source.slice(range.start.offset, range.end.offset) : undefined);

  const emitExpressionAt = (text: string | undefined, sourceOffset: number) => {
    if (!text) return;
    const leadingWhitespace = /^\s*/.exec(text)?.[0].length ?? 0;
    const trimmed = text.trim();
    if (!trimmed) return;
    const offset = sourceOffset + leadingWhitespace;
    if (seenOffsets.has(offset)) return;
    seenOffsets.add(offset);
    emitter.append("  void (");
    emitter.appendMapped(trimmed, offset);
    emitter.append(");\n");
  };

  const emitExpressionRange = (range: SourceRange | undefined) => {
    if (!range) return;
    emitExpressionAt(sourceForRange(range), range.start.offset);
  };

  const errorBinding = (expression: string | undefined): string =>
    IDENTIFIER.test(expression?.trim() ?? "") ? expression!.trim() : "err";

  const visit = (node: TemplateNode) => {
    // {{ interpolations }} in parsed text and attribute value ranges. These
    // anchors come from parser-owned sub-line ranges instead of searching the
    // whole raw line, so repeated snippets map to the token that produced them.
    const emitInterpolations = (range: SourceRange | undefined) => {
      const rangeText = sourceForRange(range);
      if (rangeText === undefined || range === undefined) return;
      for (const match of rangeText.matchAll(/{{([\s\S]*?)}}/g)) {
        emitExpressionAt(match[1], range.start.offset + (match.index ?? 0) + 2);
      }
    };

    if (node.kind === "element" || node.kind === "component") emitInterpolations(node.inlineTextRange);
    if (node.kind === "text") emitInterpolations(node.textRange);

    if (node.kind === "expression") {
      emitExpressionRange(node.expressionRange);
    }

    if (node.kind === "element" || node.kind === "component" || node.kind === "convex-reference" || node.kind === "convex-call") {
      for (const attribute of node.attributes) {
        emitInterpolations(attribute.range);
        // Bare expression attributes (checked:todo.completed) outside mustaches.
        if (attribute.kind === "expression" && !attribute.raw?.includes("{{")) {
          emitExpressionRange(attribute.expressionRange);
        }
        // Same-name shorthand (task:) references the in-scope value.
        if (attribute.kind === "same-name" && IDENTIFIER.test(attribute.name)) {
          emitExpressionRange(attribute.expressionRange);
        }
        // Raw-event handlers (on:wa-show:faqOpened) compile to identifier
        // references, so they count as prelude usage. Semantic-event targets
        // (:click:openMenu, :track:todos_cleared) are dispatched by name at
        // runtime and are NOT module identifiers.
        if (attribute.kind === "raw-event" && IDENTIFIER.test(attribute.handler)) {
          emitExpressionRange(attribute.expressionRange);
        }
      }
    }

    if (node.kind === "directive") {
      if (node.name === "if" && node.expression && node.expressionRange) {
        emitExpressionRange(node.expressionRange);
      }

      if (node.name === "for" && node.for) {
        const { itemName, collectionExpression, keyExpression } = node.for;
        emitter.append("  ;((");
        if (node.for.collectionExpressionRange) {
          const collectionRange = node.for.collectionExpressionRange;
          emitter.appendMapped(
            source.slice(collectionRange.start.offset, collectionRange.end.offset),
            collectionRange.start.offset
          );
        } else emitter.append(collectionExpression);
        emitter.append(`) ?? []).forEach((${itemName}, index) => {\n  void index;\n`);
        if (keyExpression && node.for.keyExpressionRange) {
          emitExpressionRange(node.for.keyExpressionRange);
        }
        for (const child of node.children) visit(child);
        emitter.append("  });\n");
        return;
      }

      if (node.name === "error" || node.name === "mutation-error") {
        const binding = errorBinding(node.expression);
        emitter.append(`  ;((${binding}: unknown) => {\n  void ${binding};\n`);
        for (const child of node.children) visit(child);
        emitter.append("  })(undefined);\n");
        return;
      }
    }

    for (const child of node.children) visit(child);
  };

  for (const node of nodes) visit(node);
}
