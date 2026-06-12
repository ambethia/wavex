import type { LanguageServicePlugin } from "@volar/language-service";
import { formatDiagnostic, parseWavex, type Diagnostic as WavexDiagnostic } from "@wavex/core";
import type { WebAwesomeComponentDetail } from "@wavex/core/capabilities";
import type * as vscode from "vscode-languageserver-protocol";
import { URI } from "vscode-uri";
import { WAVEX_LANGUAGE_ID } from "./language.js";

export interface WavexServiceOptions {
  /** Local component references (e.g. "talk-card", "tasks/item"). */
  localComponents?: readonly string[];
  /** Web Awesome component names without the wa- prefix. */
  webAwesomeComponents?: readonly string[];
  /** Full Web Awesome component metadata for attribute completions and hover. */
  webAwesomeDetails?: ReadonlyMap<string, WebAwesomeComponentDetail>;
  /** Utility class suffixes (stack, gap-xl, ...) for [bracket-group] completions. */
  utilityClasses?: readonly string[];
  /** Convex function references (e.g. "tasks:list"). */
  convexFunctions?: readonly string[];
}

export type WavexServiceOptionsResolver = WavexServiceOptions | ((documentUri: string) => WavexServiceOptions);

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

export function createWavexServicePlugin(optionsOrResolver: WavexServiceOptionsResolver = {}): LanguageServicePlugin {
  const optionsFor = (documentUri: string): WavexServiceOptions =>
    typeof optionsOrResolver === "function" ? optionsOrResolver(documentUri) : optionsOrResolver;

  return {
    name: "wavex",
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
      completionProvider: { triggerCharacters: ["@", "+", "$", "[", " "] },
      hoverProvider: true
    },
    create(context) {
      const sourceOptions = (documentUri: string): WavexServiceOptions => {
        const parsedUri = URI.parse(documentUri);
        const sourceUri = context.decodeEmbeddedDocumentUri?.(parsedUri)?.[0] ?? parsedUri;
        return optionsFor(sourceUri.toString());
      };

      return {
        provideDiagnostics(document) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const parsed = parseWavex(document.getText());
          return parsed.diagnostics.map((diagnostic) => toLspDiagnostic(document.getText(), diagnostic));
        },

        provideCompletionItems(document, position) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const options = sourceOptions(document.uri);
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
                insertText: `@${name}`,
                sortText: `0${name}`
              })),
              ...(options.webAwesomeComponents ?? []).map((name) => ({
                label: `@${name}`,
                kind: 7 as vscode.CompletionItemKind,
                detail: `<wa-${name}>`,
                documentation: markdownDoc(options.webAwesomeDetails?.get(name)?.summary),
                insertText: `@${name}`,
                sortText: `1${name}`
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

          // Inside an unclosed utility group: [stack gap-…
          const openBracket = linePrefix.lastIndexOf("[");
          if (openBracket !== -1 && linePrefix.indexOf("]", openBracket) === -1 && /[\s[][\w-]*$/.test(linePrefix)) {
            return {
              isIncomplete: false,
              items: (options.utilityClasses ?? []).map((token) => ({
                label: token,
                kind: 21 as vscode.CompletionItemKind,
                detail: `.wa-${token}`,
                insertText: token
              }))
            };
          }

          // Attribute completions for the line's Web Awesome component head.
          const componentHead = /^\s*@([\w/-]+)\s/.exec(text.slice(lineStart, text.indexOf("\n", lineStart) === -1 ? text.length : text.indexOf("\n", lineStart)));
          const detail = componentHead ? options.webAwesomeDetails?.get(componentHead[1]!) : undefined;
          if (detail && /\s[\w-]*$/.test(linePrefix)) {
            const items: vscode.CompletionItem[] = [
              ...detail.attributes.map((attribute) => ({
                label: attribute.name,
                kind: 10 as vscode.CompletionItemKind,
                detail: attribute.type ?? "attribute",
                documentation: markdownDoc(attributeDoc(attribute)),
                insertText: `${attribute.name}:`
              })),
              ...detail.slots
                .filter((slot) => slot.name)
                .map((slot) => ({
                  label: `slot:${slot.name}`,
                  kind: 10 as vscode.CompletionItemKind,
                  detail: "slot",
                  documentation: markdownDoc(slot.description),
                  insertText: `slot:${slot.name}`
                }))
            ];
            return { isIncomplete: false, items };
          }

          return undefined;
        },

        provideHover(document, position) {
          if (document.languageId !== WAVEX_LANGUAGE_ID) return undefined;
          const options = sourceOptions(document.uri);
          const text = document.getText();
          const offset = document.offsetAt(position);
          const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
          const lineEnd = text.indexOf("\n", offset);
          const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
          const column = offset - lineStart;

          // @component under the cursor
          for (const match of line.matchAll(/@([\w/-]+)/g)) {
            const start = match.index ?? 0;
            if (column < start || column > start + match[0].length) continue;
            const name = match[1]!;
            if (options.localComponents?.includes(name)) {
              return hover(`**@${name}** — local component \`src/components/${name}.wx\``);
            }
            const detail = options.webAwesomeDetails?.get(name.replace(/^wa\//, ""));
            if (detail) {
              const attrs = detail.attributes.slice(0, 8).map((attribute) => `\`${attribute.name}\``).join(" ");
              return hover(
                `**@${name}** — \`<wa-${detail.name}>\`\n\n${detail.summary ?? ""}${attrs ? `\n\nAttributes: ${attrs}` : ""}`
              );
            }
          }

          // attribute name on a component line
          const componentHead = /^\s*@([\w/-]+)/.exec(line);
          const headDetail = componentHead ? options.webAwesomeDetails?.get(componentHead[1]!) : undefined;
          if (headDetail) {
            for (const match of line.matchAll(/(?<=\s)([\w-]+)(?=:|\s|$)/g)) {
              const start = match.index ?? 0;
              if (column < start || column > start + match[1]!.length) continue;
              const attribute = headDetail.attributes.find((candidate) => candidate.name === match[1]);
              if (attribute) return hover(`**${attribute.name}**${attribute.type ? ` \`${attribute.type}\`` : ""}\n\n${attributeDoc(attribute) ?? ""}`);
            }
          }

          // utility token inside a bracket group
          const bracketStart = line.lastIndexOf("[", column);
          if (bracketStart !== -1 && (line.indexOf("]", bracketStart) === -1 || line.indexOf("]", bracketStart) >= column)) {
            for (const match of line.slice(bracketStart).matchAll(/[\w-]+/g)) {
              const start = bracketStart + (match.index ?? 0);
              if (column < start || column > start + match[0].length) continue;
              if (options.utilityClasses?.includes(match[0])) {
                return hover(`**${match[0]}** — Web Awesome utility class \`.wa-${match[0]}\``);
              }
            }
          }

          return undefined;
        }
      };
    }
  };
}

function hover(markdown: string): vscode.Hover {
  return { contents: { kind: "markdown", value: markdown } };
}

function markdownDoc(value: string | undefined): vscode.MarkupContent | undefined {
  return value ? { kind: "markdown", value } : undefined;
}

function attributeDoc(attribute: { description?: string; default?: string }): string | undefined {
  const parts = [attribute.description, attribute.default ? `Default: \`${attribute.default}\`` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
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
