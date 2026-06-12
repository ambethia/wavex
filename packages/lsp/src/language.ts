import type { CodeMapping, LanguagePlugin, VirtualCode } from "@volar/language-core";
import { forEachEmbeddedCode } from "@volar/language-core";
// Side-effect import: augments LanguagePlugin with the `typescript` integration hook.
import "@volar/typescript";
import { parseWavex, type TemplateNode, type WavexFile } from "@wavex/core";
import type * as ts from "typescript";
import type { URI } from "vscode-uri";

export const WAVEX_LANGUAGE_ID = "wavex";

const FULL_CAPABILITIES: CodeMapping["data"] = {
  completion: true,
  format: false,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true
};

export function createWavexLanguagePlugin(): LanguagePlugin<URI> {
  return {
    getLanguageId(uri) {
      return uri.path.endsWith(".wx") ? WAVEX_LANGUAGE_ID : undefined;
    },
    createVirtualCode(_uri, languageId, snapshot) {
      if (languageId !== WAVEX_LANGUAGE_ID) return undefined;
      return new WavexVirtualCode(snapshot);
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

export class WavexVirtualCode implements VirtualCode {
  id = "root";
  languageId = WAVEX_LANGUAGE_ID;
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];
  ast: WavexFile;

  constructor(public snapshot: ts.IScriptSnapshot) {
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
    this.embeddedCodes = [createTypeScriptCode(source, this.ast)];
  }
}

function createTypeScriptCode(source: string, ast: WavexFile): VirtualCode {
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
  append("declare const props: Record<string, any>;\n");
  append("declare const state: Record<string, any>;\n");
  append("declare const actionStates: Record<string, any>;\n");
  for (const name of new Set(ast.resources.map((resource) => resource.name))) {
    if (/^[A-Za-z_$][\w$]*$/.test(name)) append(`declare const ${name}: any;\n`);
  }

  // 3. Template expressions type-check inside their template scopes (+for
  //    items, +error bindings), mapped back to source.
  append("export function __wxTemplateExpressions() {\n");
  emitNodes(ast.nodes, { append, appendMapped });
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

/**
 * Emit template expressions as checked statements, introducing the bindings
 * template directives create: +for items (typed from the collection), +error /
 * +mutation-error / +boundary error bindings (unknown), and handler references
 * from raw and custom semantic events (so prelude functions count as used).
 */
function emitNodes(nodes: readonly TemplateNode[], emitter: Emitter): void {
  const seenOffsets = new Set<number>();

  const emitExpression = (text: string | undefined, searchBase: number, searchText: string) => {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const index = searchText.indexOf(trimmed);
    if (index === -1) return;
    const offset = searchBase + index;
    if (seenOffsets.has(offset)) return;
    seenOffsets.add(offset);
    emitter.append("  void (");
    emitter.appendMapped(trimmed, offset);
    emitter.append(");\n");
  };

  const errorBinding = (expression: string | undefined): string =>
    IDENTIFIER.test(expression?.trim() ?? "") ? expression!.trim() : "err";

  const visit = (node: TemplateNode) => {
    const base = node.range.start.offset;
    const raw = node.raw;

    // {{ interpolations }} anywhere on the line (inline text, attribute values).
    for (const match of raw.matchAll(/{{([\s\S]*?)}}/g)) {
      emitExpression(match[1], base + (match.index ?? 0), raw.slice(match.index ?? 0));
    }

    if (node.kind === "expression") emitExpression(node.expression, base, raw);

    if (node.kind === "element" || node.kind === "component" || node.kind === "convex-call") {
      for (const attribute of node.attributes) {
        // Bare expression attributes (checked:todo.completed) outside mustaches.
        if (attribute.kind === "expression" && !attribute.raw?.includes("{{")) {
          emitExpression(attribute.expression, base, raw);
        }
        // Same-name shorthand (task:) references the in-scope value.
        if (attribute.kind === "same-name" && IDENTIFIER.test(attribute.name)) {
          emitExpression(attribute.name, base, raw);
        }
        // Raw-event handlers (on:wa-show:faqOpened) and custom semantic
        // targets (:click:openMenu) reference prelude declarations.
        if (attribute.kind === "raw-event" && IDENTIFIER.test(attribute.handler)) {
          emitExpression(attribute.handler, base, raw);
        }
        if (attribute.kind === "semantic-event" && IDENTIFIER.test(attribute.target)) {
          emitExpression(attribute.target, base, raw);
        }
      }
    }

    if (node.kind === "directive") {
      if (node.name === "if") emitExpression(node.expression, base, raw);

      if (node.name === "for" && node.for) {
        const { itemName, collectionExpression, keyExpression } = node.for;
        emitter.append("  ;((");
        const collectionIndex = raw.indexOf(collectionExpression);
        if (collectionIndex !== -1) emitter.appendMapped(collectionExpression, base + collectionIndex);
        else emitter.append(collectionExpression);
        emitter.append(`) ?? []).forEach((${itemName}, index) => {\n  void index;\n`);
        if (keyExpression) emitExpression(keyExpression, base, raw);
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
