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

  // 3. Each template expression type-checks in its own scope, mapped to source.
  append("export function __wxTemplateExpressions() {\n");
  for (const expression of collectExpressions(source, ast.nodes)) {
    append("  void (");
    appendMapped(expression.text, expression.sourceOffset);
    append(");\n");
  }
  append("}\n");
  append("export {};\n");

  const snapshot: ts.IScriptSnapshot = {
    getText: (start, end) => generated.slice(start, end),
    getLength: () => generated.length,
    getChangeRange: () => undefined
  };

  return { id: "ts", languageId: "typescript", snapshot, mappings };
}

function collectExpressions(source: string, nodes: readonly TemplateNode[]): MappedExpression[] {
  const expressions: MappedExpression[] = [];
  const seenOffsets = new Set<number>();

  const pushExpression = (text: string | undefined, searchBase: number, searchText: string) => {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const index = searchText.indexOf(trimmed);
    if (index === -1) return;
    const offset = searchBase + index;
    if (seenOffsets.has(offset)) return;
    seenOffsets.add(offset);
    expressions.push({ sourceOffset: offset, text: trimmed });
  };

  const visit = (node: TemplateNode) => {
    const base = node.range.start.offset;
    const raw = node.raw;

    if (node.kind === "expression") pushExpression(node.expression, base, raw);
    if (node.kind === "directive") {
      if (node.name === "if") pushExpression(node.expression, base, raw);
      if (node.name === "for" && node.for) pushExpression(node.for.collectionExpression, base, raw);
    }

    // {{ interpolations }} anywhere on the line (inline text, attribute values).
    for (const match of raw.matchAll(/{{([\s\S]*?)}}/g)) {
      pushExpression(match[1], base + (match.index ?? 0), raw.slice(match.index ?? 0));
    }

    // Bare expression attributes (checked:todo.completed) outside mustaches.
    if (node.kind === "element" || node.kind === "component" || node.kind === "convex-call") {
      for (const attribute of node.attributes) {
        if (attribute.kind === "expression" && !attribute.raw?.includes("{{")) {
          pushExpression(attribute.expression, base, raw);
        }
      }
    }

    for (const child of node.children) visit(child);
  };

  for (const node of nodes) visit(node);
  return expressions;
}
