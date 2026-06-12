import type { LanguageServicePlugin } from "@volar/language-service";
import { formatDiagnostic, parseWavex, type Diagnostic as WavexDiagnostic } from "@wavex/core";
import type * as vscode from "vscode-languageserver-protocol";
import { WAVEX_LANGUAGE_ID } from "./language.js";

export interface WavexServiceOptions {
  /** Local component references (e.g. "talk-card", "tasks/item"). */
  localComponents?: readonly string[];
  /** Web Awesome component names without the wa- prefix. */
  webAwesomeComponents?: readonly string[];
  /** Convex function references (e.g. "tasks:list"). */
  convexFunctions?: readonly string[];
}

const DIRECTIVE_NAMES = [
  "head",
  "if",
  "for",
  "loading",
  "empty",
  "error",
  "pending",
  "idle",
  "boundary",
  "suspense",
  "mutation-error"
];

export function createWavexServicePlugin(options: WavexServiceOptions = {}): LanguageServicePlugin {
  return {
    name: "wavex",
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
      completionProvider: { triggerCharacters: ["@", "+", "$"] },
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["type", "class", "function", "keyword", "property", "variable"],
          tokenModifiers: []
        }
      }
    },
    create(context) {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const parsed = parseWavex(document.getText());
          return parsed.diagnostics.map((diagnostic) => toLspDiagnostic(document.getText(), diagnostic));
        },
        provideCompletionItems(document, position) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const text = document.getText();
          const offset = document.offsetAt(position);
          const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
          const linePrefix = text.slice(lineStart, offset);

          const componentTrigger = /(?:^|\s)@([\w/-]*)$/.exec(linePrefix);
          if (componentTrigger) {
            const items: vscode.CompletionItem[] = [
              ...(options.localComponents ?? []).map((name) => ({
                label: `@${name}`,
                kind: 7 as vscode.CompletionItemKind,
                detail: `src/components/${name}.wx`,
                insertText: `@${name}`
              })),
              ...(options.webAwesomeComponents ?? []).map((name) => ({
                label: `@${name}`,
                kind: 7 as vscode.CompletionItemKind,
                detail: `<wa-${name}>`,
                insertText: `@${name}`
              }))
            ];
            return { isIncomplete: false, items };
          }

          const directiveTrigger = /(?:^|\s)\+([\w-]*)$/.exec(linePrefix);
          if (directiveTrigger) {
            return {
              isIncomplete: false,
              items: DIRECTIVE_NAMES.map((name) => ({
                label: `+${name}`,
                kind: 14 as vscode.CompletionItemKind,
                insertText: `+${name}`
              }))
            };
          }

          const convexTrigger = /(?:^|\s|:)(\${1,2})([\w/:-]*)$/.exec(linePrefix);
          if (convexTrigger) {
            const prefix = convexTrigger[1]!;
            return {
              isIncomplete: false,
              items: (options.convexFunctions ?? []).map((reference) => ({
                label: `${prefix}${reference}`,
                kind: 3 as vscode.CompletionItemKind,
                detail: "Convex function",
                insertText: `${prefix}${reference}`
              }))
            };
          }

          void context;
          return undefined;
        },
        provideDocumentSemanticTokens(document, _range, legend) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const indexOf = (type: string) => Math.max(0, legend.tokenTypes.indexOf(type));
          const tokens: Array<[number, number, number, number, number]> = [];
          const text = document.getText();
          const parsed = parseWavex(text);

          const visit = (node: { kind: string; raw: string; children: readonly unknown[]; range: { start: { line: number; column: number } }; reference?: string; name?: string; tag?: string }) => {
            const line = node.range.start.line - 1;
            const column = node.range.start.column - 1;
            if (node.kind === "component" && node.reference) {
              tokens.push([line, column, node.reference.length + 1, indexOf("class"), 0]);
            } else if (node.kind === "directive" && node.name) {
              tokens.push([line, column, node.name.length + 1, indexOf("keyword"), 0]);
            } else if (node.kind === "convex-call" || node.kind === "convex-reference") {
              const head = node.raw.trim().split(/\s+/)[0] ?? "";
              tokens.push([line, column, head.length, indexOf("function"), 0]);
            } else if (node.kind === "element" && node.tag) {
              tokens.push([line, column, node.tag.length, indexOf("type"), 0]);
            }
            for (const child of node.children) visit(child as never);
          };
          for (const node of parsed.nodes) visit(node as never);
          return tokens;
        }
      };
    }
  };
}

function toLspDiagnostic(text: string, diagnostic: WavexDiagnostic): vscode.Diagnostic {
  const lines = text.split("\n");
  const lineText = lines[diagnostic.line - 1] ?? "";
  return {
    range: {
      start: { line: diagnostic.line - 1, character: Math.max(0, diagnostic.column - 1) },
      end: { line: diagnostic.line - 1, character: Math.max(diagnostic.column - 1, lineText.length) }
    },
    severity: (diagnostic.severity === "error" ? 1 : diagnostic.severity === "warning" ? 2 : 3) as vscode.DiagnosticSeverity,
    code: diagnostic.code,
    source: "wavex",
    message: diagnostic.message.length > 0 ? diagnostic.message : formatDiagnostic(diagnostic)
  };
}
