import { inferResourceBindingName, type Diagnostic } from "./model.js";
import type {
  Attribute,
  ComponentNode,
  ConvexCallNode,
  ConvexFunctionAddress,
  ConvexReferenceNode,
  DirectiveNode,
  ElementNode,
  ForDirective,
  ResourceBinding,
  SourceLocation,
  SourceRange,
  TemplateNode,
  WavexFile
} from "./ast.js";

export interface ParseWavexOptions {
  fileName?: string;
}

interface LineRecord {
  raw: string;
  bodyLineIndex: number;
  sourceLine: number;
  sourceOffset: number;
}

interface ParsedHead {
  attributes: Attribute[];
  inlineText?: string;
}

const BOOLEAN_ATTRIBUTE_NAMES = new Set([
  "async",
  "autofocus",
  "checked",
  "defer",
  "disabled",
  "hidden",
  "multiple",
  "open",
  "readonly",
  "required",
  "selected",
  "with-footer",
  "with-header"
]);

export function parseWavex(source: string, _options: ParseWavexOptions = {}): WavexFile {
  const diagnostics: Diagnostic[] = [];
  const allLines = source.split(/\r?\n/);
  const lineStartOffsets = computeLineStartOffsets(source, allLines);
  const separatorIndex = allLines.findIndex((line) => line.trim() === "~~~");
  const hasWaveSeparator = separatorIndex !== -1;

  if (!hasWaveSeparator) {
    diagnostics.push({
      code: "WX001",
      severity: "error",
      line: 1,
      column: 1,
      message: "Every .wx file must include a line containing only ~~~ before the template body."
    });
  }

  const prelude = hasWaveSeparator ? allLines.slice(0, separatorIndex).join("\n") : "";
  const bodyLines = hasWaveSeparator ? allLines.slice(separatorIndex + 1) : allLines;
  const bodyStartLine = hasWaveSeparator ? separatorIndex + 2 : 1;
  const bodyStartOffset = lineStartOffsets[hasWaveSeparator ? separatorIndex + 1 : 0] ?? 0;
  const body = bodyLines.join("\n");

  const resources: ResourceBinding[] = [];
  const nodes = parseTemplateLines(
    bodyLines.map((raw, index) => ({
      raw,
      bodyLineIndex: index,
      sourceLine: bodyStartLine + index,
      sourceOffset: (lineStartOffsets[bodyStartLine + index - 1] ?? bodyStartOffset) as number
    })),
    diagnostics,
    resources
  );

  return {
    prelude,
    body,
    nodes,
    diagnostics,
    resources,
    hasWaveSeparator
  };
}

function parseTemplateLines(
  lines: LineRecord[],
  diagnostics: Diagnostic[],
  resources: ResourceBinding[]
): TemplateNode[] {
  const roots: TemplateNode[] = [];
  const stack: Array<{ level: number; node: TemplateNode }> = [];

  for (const line of lines) {
    if (line.raw.trim() === "" || line.raw.trimStart().startsWith("//")) continue;

    const leadingWhitespace = /^\s*/.exec(line.raw)?.[0] ?? "";
    if (leadingWhitespace.includes("\t")) {
      diagnostics.push({
        code: "WX002",
        severity: "error",
        line: line.sourceLine,
        column: leadingWhitespace.indexOf("\t") + 1,
        message: "Tabs are not allowed in .wx indentation; use strict two-space indentation."
      });
    }

    const indentSpaces = leadingWhitespace.replace(/\t/g, "  ").length;
    if (indentSpaces % 2 !== 0) {
      diagnostics.push({
        code: "WX003",
        severity: "error",
        line: line.sourceLine,
        column: indentSpaces + 1,
        message: "Indentation must use multiples of exactly two spaces."
      });
    }

    const level = Math.floor(indentSpaces / 2);
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent && level > parent.level + 1) {
      diagnostics.push({
        code: "WX004",
        severity: "error",
        line: line.sourceLine,
        column: indentSpaces + 1,
        message: "Indentation cannot skip a nesting level."
      });
    }

    const content = line.raw.slice(leadingWhitespace.length);
    const range = makeRange(line, indentSpaces, line.raw.length);
    const node = parseLine(content, range, diagnostics, resources);
    if (!node) continue;

    if ("utilities" in node) {
      for (const token of (node as { utilities: string[] }).utilities) {
        if (token.includes(":")) {
          diagnostics.push({
            code: "WX005",
            severity: "error",
            line: line.sourceLine,
            column: indentSpaces + 1,
            message: `Utility token "${token}" is invalid: utilities are literal wa-* suffixes in dash form (e.g. "gap-xl" -> wa-gap-xl); ":" is not allowed inside a utility group.`
          });
        }
      }
    }

    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ level, node });
  }

  return roots;
}

function parseLine(
  content: string,
  range: SourceRange,
  diagnostics: Diagnostic[],
  resources: ResourceBinding[]
): TemplateNode | undefined {
  const trimmed = content.trim();
  if (trimmed === "") return undefined;

  if (trimmed.startsWith("|")) {
    return { kind: "text", text: trimmed.slice(1).trimStart(), children: [], raw: content, range };
  }

  if (trimmed.startsWith("=")) {
    return { kind: "expression", expression: trimmed.slice(1).trim(), children: [], raw: content, range };
  }

  if (trimmed.startsWith("$$")) return parseConvexCall(trimmed, content, range, diagnostics, resources);
  if (trimmed.startsWith("$")) return parseConvexReference(trimmed, content, range, diagnostics);
  if (trimmed.startsWith("+")) return parseDirective(trimmed, content, range);
  if (trimmed.startsWith("@")) return parseComponent(trimmed, content, range);
  return parseElement(trimmed, content, range);
}

function parseElement(trimmed: string, raw: string, range: SourceRange): ElementNode {
  const { withoutUtilities, utilities } = extractUtilityGroups(trimmed);
  const [tag = "div", ...tokens] = tokenize(withoutUtilities);
  const parsed = parseAttributesAndInlineText(tokens);
  return {
    kind: "element",
    tag,
    attributes: parsed.attributes,
    utilities,
    inlineText: parsed.inlineText,
    children: [],
    raw,
    range
  };
}

function parseComponent(trimmed: string, raw: string, range: SourceRange): ComponentNode {
  const { withoutUtilities, utilities } = extractUtilityGroups(trimmed);
  const [reference = "@missing", ...tokens] = tokenize(withoutUtilities);
  const parsed = parseAttributesAndInlineText(tokens);
  return {
    kind: "component",
    reference: reference.slice(1),
    attributes: parsed.attributes,
    utilities,
    inlineText: parsed.inlineText,
    children: [],
    raw,
    range
  };
}

function parseDirective(trimmed: string, raw: string, range: SourceRange): DirectiveNode {
  const { withoutUtilities } = extractUtilityGroups(trimmed);
  const [head = "+unknown", ...tokens] = tokenize(withoutUtilities);
  const name = head.slice(1);
  const attributes: Attribute[] = [];
  let expression: string | undefined;
  let forDirective: ForDirective | undefined;

  if (name === "for") {
    const parsedFor = parseForDirective(tokens);
    forDirective = parsedFor.forDirective;
    attributes.push(...parsedFor.attributes);
    expression = tokens.join(" ");
  } else if (name === "head" || name === "boundary") {
    attributes.push(...tokens.map(parseAttributeToken).filter(isAttribute));
  } else if (name === "suspense") {
    const parsed = parseAttributesAndInlineText(tokens);
    attributes.push(...parsed.attributes);
    expression = parsed.inlineText;
  } else if (name === "loading" || name === "empty" || name === "pending" || name === "idle") {
    expression = tokens.join(" ") || undefined;
  } else {
    expression = tokens.join(" ") || undefined;
  }

  return {
    kind: "directive",
    name,
    expression,
    attributes,
    for: forDirective,
    children: [],
    raw,
    range
  };
}

function parseForDirective(tokens: string[]): { forDirective?: ForDirective; attributes: Attribute[] } {
  const keyTokenIndex = tokens.findIndex((token) => token.startsWith("key:"));
  const loopTokens = keyTokenIndex === -1 ? tokens : tokens.slice(0, keyTokenIndex);
  const attrTokens = keyTokenIndex === -1 ? [] : tokens.slice(keyTokenIndex);
  const loopText = loopTokens.join(" ");
  const match = /^([A-Za-z_$][\w$]*)\s+in\s+(.+)$/.exec(loopText);
  const attributes = attrTokens.map(parseAttributeToken).filter(isAttribute);
  const keyAttribute = attributes.find((attribute) => attribute.name === "key");

  if (!match) return { attributes };
  return {
    forDirective: {
      itemName: match[1]!,
      collectionExpression: match[2]!.trim(),
      keyExpression: attributeExpressionValue(keyAttribute)
    },
    attributes
  };
}

function parseConvexReference(
  trimmed: string,
  raw: string,
  range: SourceRange,
  diagnostics: Diagnostic[]
): ConvexReferenceNode {
  const [head = "$missing:missing", ...tokens] = tokenize(trimmed);
  const address = parseConvexAddress(head, range, diagnostics);
  return {
    kind: "convex-reference",
    address,
    attributes: tokens.map(parseAttributeToken).filter(isAttribute),
    children: [],
    raw,
    range
  };
}

function parseConvexCall(
  trimmed: string,
  raw: string,
  range: SourceRange,
  diagnostics: Diagnostic[],
  resources: ResourceBinding[]
): ConvexCallNode {
  const [head = "$$missing:missing", ...tokens] = tokenize(trimmed);
  const address = parseConvexAddress(head, range, diagnostics);
  const attributes = tokens.map(parseAttributeToken).filter(isAttribute);
  const asAttribute = attributes.find((attribute) => attribute.name === "as");
  const bindingName = attributeLiteralValue(asAttribute) ?? inferResourceBindingName(address.modulePath, address.functionName);
  const node: ConvexCallNode = {
    kind: "convex-call",
    address,
    attributes,
    bindingName,
    children: [],
    raw,
    range
  };
  resources.push({ name: bindingName, address, attributes, range });
  return node;
}

function parseConvexAddress(rawHead: string, range: SourceRange, diagnostics: Diagnostic[]): ConvexFunctionAddress {
  const withoutSigils = rawHead.replace(/^\$\$?/, "");
  const splitIndex = withoutSigils.lastIndexOf(":");
  const modulePath = splitIndex === -1 ? "" : withoutSigils.slice(0, splitIndex).replace(/:/g, "/");
  const functionName = splitIndex === -1 ? "" : withoutSigils.slice(splitIndex + 1);

  if (!/^[A-Za-z0-9_./-]+$/.test(modulePath) || !/^[A-Za-z_$][\w$]*$/.test(functionName)) {
    diagnostics.push({
      code: "WX020",
      severity: "error",
      line: range.start.line,
      column: range.start.column,
      message: `Invalid Convex function address '${rawHead}'. Expected $module:function or $$module:function.`
    });
    return { modulePath: "missing", functionName: "missing", raw: rawHead };
  }
  return { modulePath, functionName, raw: rawHead };
}

function parseAttributesAndInlineText(tokens: string[]): ParsedHead {
  const attributes: Attribute[] = [];
  let inlineText: string | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isAttributeLike(token)) {
      inlineText = tokens.slice(index).join(" ");
      break;
    }
    const attribute = parseAttributeToken(token);
    if (attribute) attributes.push(attribute);
  }

  return { attributes, inlineText };
}

export function parseAttributeToken(token: string): Attribute | undefined {
  if (!token) return undefined;

  if (token.startsWith("on:")) {
    const [, event, ...handlerParts] = token.split(":");
    const handler = handlerParts.join(":");
    if (event && handler) {
      return { kind: "raw-event", name: `on:${event}`, event, handler, raw: token };
    }
  }

  if (token.startsWith(":")) {
    const body = token.slice(1);
    const split = body.indexOf(":");
    if (split !== -1) {
      const event = body.slice(0, split);
      const target = body.slice(split + 1);
      return { kind: "semantic-event", name: `:${event}`, event, target, raw: token };
    }
  }

  const colonIndex = token.indexOf(":");
  if (colonIndex === -1) return { kind: "boolean", name: token, raw: token };

  const name = token.slice(0, colonIndex);
  const value = token.slice(colonIndex + 1);
  if (!name) return undefined;
  if (value === "") return { kind: "same-name", name, raw: token };

  const expression = unwrapMustacheExpression(value);
  if (expression !== undefined) return { kind: "expression", name, expression, raw: token };

  const quoted = unwrapQuotedString(value);
  if (quoted !== undefined) return { kind: "literal", name, value: quoted, quoted: true, raw: token };

  if (looksLikeExpression(value)) return { kind: "expression", name, expression: value, raw: token };
  return { kind: "literal", name, value, quoted: false, raw: token };
}

function isAttributeLike(token: string): boolean {
  if (!token) return false;
  if (token.startsWith(":") || token.startsWith("on:")) return true;
  if (token.includes(":")) return true;
  if (BOOLEAN_ATTRIBUTE_NAMES.has(token)) return true;
  return /^[a-z][a-z0-9_-]*-[a-z0-9_-]+$/.test(token);
}

function isAttribute(attribute: Attribute | undefined): attribute is Attribute {
  return attribute !== undefined;
}

function attributeLiteralValue(attribute: Attribute | undefined): string | undefined {
  if (!attribute) return undefined;
  if (attribute.kind === "literal") return attribute.value;
  if (attribute.kind === "same-name") return attribute.name;
  if (attribute.kind === "expression") return attribute.expression;
  return undefined;
}

function attributeExpressionValue(attribute: Attribute | undefined): string | undefined {
  if (!attribute) return undefined;
  if (attribute.kind === "expression") return attribute.expression;
  if (attribute.kind === "same-name") return attribute.name;
  if (attribute.kind === "literal") return attribute.value;
  return undefined;
}

function unwrapMustacheExpression(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) return undefined;
  return trimmed.slice(2, -2).trim();
}

function unwrapQuotedString(value: string): string | undefined {
  if (value.length < 2) return undefined;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return undefined;
  return value.slice(1, -1).replace(/\\(["'\\])/g, "$1");
}

function looksLikeExpression(value: string): boolean {
  if (value.startsWith("{") || value.startsWith("[")) return true;
  if (/^(true|false|null|undefined)\b/.test(value)) return true;
  if (/^(route|props|state|api|ctx|context)\b/.test(value)) return true;
  return /[.()[\]{}]|=>|[+*/%]|===?|!==?|&&|\|\|/.test(value);
}

function extractUtilityGroups(input: string): { withoutUtilities: string; utilities: string[] } {
  let withoutUtilities = "";
  const utilities: string[] = [];
  let quote: string | undefined;
  let curlyDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quote) {
      withoutUtilities += char;
      if (char === "\\") {
        index += 1;
        withoutUtilities += input[index] ?? "";
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      withoutUtilities += char;
      continue;
    }

    if (char === "{") curlyDepth += 1;
    if (char === "}" && curlyDepth > 0) curlyDepth -= 1;

    if (char === "[" && curlyDepth === 0) {
      const close = input.indexOf("]", index + 1);
      if (close !== -1) {
        utilities.push(...input.slice(index + 1, close).trim().split(/\s+/).filter(Boolean));
        index = close;
        if (withoutUtilities && !withoutUtilities.endsWith(" ")) withoutUtilities += " ";
        continue;
      }
    }

    withoutUtilities += char;
  }

  return { withoutUtilities: withoutUtilities.replace(/\s+/g, " ").trim(), utilities };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | undefined;
  let curlyDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  const push = () => {
    if (current !== "") {
      tokens.push(current);
      current = "";
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (quote) {
      current += char;
      if (char === "\\") {
        index += 1;
        current += input[index] ?? "";
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "{") curlyDepth += 1;
    else if (char === "}" && curlyDepth > 0) curlyDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (char === "(") parenDepth += 1;
    else if (char === ")" && parenDepth > 0) parenDepth -= 1;

    if (/\s/.test(char) && curlyDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      push();
      continue;
    }

    current += char;
  }

  push();
  return tokens;
}

function computeLineStartOffsets(source: string, lines: string[]): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

function makeRange(line: LineRecord, indentSpaces: number, lineLength: number): SourceRange {
  const start: SourceLocation = {
    line: line.sourceLine,
    column: indentSpaces + 1,
    offset: line.sourceOffset + indentSpaces
  };
  const end: SourceLocation = {
    line: line.sourceLine,
    column: lineLength + 1,
    offset: line.sourceOffset + lineLength
  };
  return { start, end };
}
