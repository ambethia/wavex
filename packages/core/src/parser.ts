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

/** Options for {@link parseWavex}. */
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
  inlineTextRange?: SourceRange;
}

interface TokenRecord {
  raw: string;
  start: number;
  end: number;
}

const BOOLEAN_ATTRIBUTE_NAMES = new Set([
  "async",
  "autofocus",
  "checked",
  "defer",
  "disabled",
  "hidden",
  "indeterminate",
  "multiple",
  "open",
  "readonly",
  "required",
  "selected",
  "with-footer",
  "with-header"
]);

/**
 * Parse a complete `.wx` source file into a {@link WavexFile}.
 *
 * The TypeScript prelude (everything before the `~~~` wave separator) is kept
 * as raw text for TypeScript tooling; the indentation-based template body is
 * parsed into {@link TemplateNode} trees with source ranges. Parse problems
 * are collected as diagnostics on the result rather than thrown, so a file
 * with errors still yields a best-effort AST for the LSP and compiler.
 */
export function parseWavex(source: string, _options: ParseWavexOptions = {}): WavexFile {
  const diagnostics: Diagnostic[] = [];
  const allLines = source.split(/\r?\n/);
  const lineStartOffsets = computeLineStartOffsets(source);
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

  const preludeEndOffset = hasWaveSeparator ? lineStartOffsets[separatorIndex]! : 0;
  const bodyStartOffset = hasWaveSeparator ? (lineStartOffsets[separatorIndex + 1] ?? source.length) : 0;
  const prelude = hasWaveSeparator ? source.slice(0, preludeEndOffset) : "";
  const bodyLines = hasWaveSeparator ? allLines.slice(separatorIndex + 1) : allLines;
  const bodyStartLine = hasWaveSeparator ? separatorIndex + 2 : 1;
  const body = hasWaveSeparator ? source.slice(bodyStartOffset) : source;

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
    const range = makeRange(line, leadingWhitespace.length, line.raw.length);
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
    const textStart = 1 + leadingWhitespaceLength(trimmed.slice(1));
    return {
      kind: "text",
      text: trimmed.slice(1).trimStart(),
      textRange: makeSubRange(range, textStart, trimmed.length),
      children: [],
      raw: content,
      range
    };
  }

  if (trimmed.startsWith("=")) {
    const expressionStart = 1 + leadingWhitespaceLength(trimmed.slice(1));
    const expressionEnd = trimEndIndex(trimmed);
    return {
      kind: "expression",
      expression: trimmed.slice(1).trim(),
      expressionRange: makeSubRange(range, expressionStart, expressionEnd),
      children: [],
      raw: content,
      range
    };
  }

  if (trimmed.startsWith("$$")) return parseConvexCall(trimmed, content, range, diagnostics, resources);
  if (trimmed.startsWith("$")) return parseConvexReference(trimmed, content, range, diagnostics);
  if (trimmed.startsWith("+")) return parseDirective(trimmed, content, range);
  if (trimmed.startsWith("@")) return parseComponent(trimmed, content, range);
  return parseElement(trimmed, content, range);
}

function parseElement(trimmed: string, raw: string, range: SourceRange): ElementNode {
  const { withoutUtilities, utilities } = extractUtilityGroups(trimmed);
  const [tagToken, ...tokens] = tokenizeWithRanges(withoutUtilities);
  const tag = tagToken?.raw ?? "div";
  const parsed = parseAttributesAndInlineText(tokens, range);
  return {
    kind: "element",
    tag,
    attributes: parsed.attributes,
    utilities,
    inlineText: parsed.inlineText,
    inlineTextRange: parsed.inlineTextRange,
    children: [],
    raw,
    range
  };
}

function parseComponent(trimmed: string, raw: string, range: SourceRange): ComponentNode {
  const { withoutUtilities, utilities } = extractUtilityGroups(trimmed);
  const [referenceToken, ...tokens] = tokenizeWithRanges(withoutUtilities);
  const reference = referenceToken?.raw ?? "@missing";
  const parsed = parseAttributesAndInlineText(tokens, range);
  return {
    kind: "component",
    reference: reference.slice(1),
    attributes: parsed.attributes,
    utilities,
    inlineText: parsed.inlineText,
    inlineTextRange: parsed.inlineTextRange,
    children: [],
    raw,
    range
  };
}

function parseDirective(trimmed: string, raw: string, range: SourceRange): DirectiveNode {
  const { withoutUtilities } = extractUtilityGroups(trimmed);
  const [headToken, ...tokens] = tokenizeWithRanges(withoutUtilities);
  const head = headToken?.raw ?? "+unknown";
  const name = head.slice(1);
  const attributes: Attribute[] = [];
  let expression: string | undefined;
  let expressionRange: SourceRange | undefined;
  let forDirective: ForDirective | undefined;

  if (name === "for") {
    const parsedFor = parseForDirective(tokens, range);
    forDirective = parsedFor.forDirective;
    attributes.push(...parsedFor.attributes);
    expression = tokens.map((token) => token.raw).join(" ") || undefined;
    expressionRange = rangeForTokenSpan(range, tokens);
  } else if (name === "head" || name === "boundary") {
    attributes.push(...tokens.map((token) => parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end))).filter(isAttribute));
  } else if (name === "suspense") {
    const parsed = parseAttributesAndInlineText(tokens, range);
    attributes.push(...parsed.attributes);
    expression = parsed.inlineText;
    expressionRange = parsed.inlineTextRange;
  } else {
    expression = tokens.map((token) => token.raw).join(" ") || undefined;
    expressionRange = rangeForTokenSpan(range, tokens);
  }

  return {
    kind: "directive",
    name,
    expression,
    expressionRange,
    attributes,
    for: forDirective,
    children: [],
    raw,
    range
  };
}

function parseForDirective(tokens: TokenRecord[], range: SourceRange): { forDirective?: ForDirective; attributes: Attribute[] } {
  const keyTokenIndex = tokens.findIndex((token) => token.raw.startsWith("key:"));
  const loopTokens = keyTokenIndex === -1 ? tokens : tokens.slice(0, keyTokenIndex);
  const attrTokens = keyTokenIndex === -1 ? [] : tokens.slice(keyTokenIndex);
  const attributes = attrTokens.map((token) => parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end))).filter(isAttribute);
  const keyAttribute = attributes.find((attribute) => attribute.name === "key");
  const inTokenIndex = loopTokens.findIndex((token) => token.raw === "in");
  const itemToken = loopTokens[0];
  const collectionTokens = inTokenIndex === -1 ? [] : loopTokens.slice(inTokenIndex + 1);

  if (!itemToken || inTokenIndex !== 1 || collectionTokens.length === 0 || !/^[A-Za-z_$][\w$]*$/.test(itemToken.raw)) return { attributes };
  const collectionExpression = collectionTokens.map((token) => token.raw).join(" ");
  return {
    forDirective: {
      itemName: itemToken.raw,
      itemNameRange: makeSubRange(range, itemToken.start, itemToken.end),
      collectionExpression,
      collectionExpressionRange: rangeForTokenSpan(range, collectionTokens),
      keyExpression: attributeExpressionValue(keyAttribute),
      keyExpressionRange: keyAttribute?.expressionRange ?? keyAttribute?.valueRange
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
  const [headToken, ...tokens] = tokenizeWithRanges(trimmed);
  const head = headToken?.raw ?? "$missing:missing";
  const address = parseConvexAddress(head, range, diagnostics);
  return {
    kind: "convex-reference",
    address,
    attributes: tokens.map((token) => parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end))).filter(isAttribute),
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
  const [headToken, ...tokens] = tokenizeWithRanges(trimmed);
  const head = headToken?.raw ?? "$$missing:missing";
  const address = parseConvexAddress(head, range, diagnostics);
  const attributes = tokens.map((token) => parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end))).filter(isAttribute);
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

function parseAttributesAndInlineText(tokens: TokenRecord[], range: SourceRange): ParsedHead {
  const attributes: Attribute[] = [];
  let inlineText: string | undefined;
  let inlineTextRange: SourceRange | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isAttributeLike(token.raw)) {
      const inlineTokens = tokens.slice(index);
      inlineText = inlineTokens.map((inlineToken) => inlineToken.raw).join(" ");
      inlineTextRange = rangeForTokenSpan(range, inlineTokens);
      break;
    }
    const attribute = parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end));
    if (attribute) attributes.push(attribute);
  }

  return { attributes, inlineText, inlineTextRange };
}

/**
 * Parse one attribute token into its {@link Attribute} form: boolean
 * (`required`), literal (`variant:brand`), expression
 * (`checked:{{ task.done }}`), same-name shorthand (`task:`), semantic event
 * (`:click:save`), or raw DOM event (`on:wa-show:opened`).
 */
export function parseAttributeToken(token: string, range?: SourceRange): Attribute | undefined {
  if (!token) return undefined;

  const nameRange = (start: number, end: number) => (range ? makeSubRange(range, start, end) : undefined);
  const valueRange = (start: number, end: number) => (range ? makeSubRange(range, start, end) : undefined);
  const base = { raw: token, range };

  if (token.startsWith("on:")) {
    const [, event, ...handlerParts] = token.split(":");
    const handler = handlerParts.join(":");
    if (event && handler) {
      const handlerStart = token.length - handler.length;
      return {
        kind: "raw-event",
        name: `on:${event}`,
        event,
        handler,
        ...base,
        nameRange: nameRange(0, `on:${event}`.length),
        valueRange: valueRange(handlerStart, token.length),
        expressionRange: valueRange(handlerStart, token.length)
      };
    }
  }

  if (token.startsWith(":")) {
    const body = token.slice(1);
    const split = body.indexOf(":");
    if (split !== -1) {
      const event = body.slice(0, split);
      const target = body.slice(split + 1);
      const targetStart = split + 2;
      return {
        kind: "semantic-event",
        name: `:${event}`,
        event,
        target,
        ...base,
        nameRange: nameRange(0, split + 1),
        valueRange: valueRange(targetStart, token.length)
      };
    }
  }

  const colonIndex = token.indexOf(":");
  if (colonIndex === -1) return { kind: "boolean", name: token, ...base, nameRange: range };

  const name = token.slice(0, colonIndex);
  const value = token.slice(colonIndex + 1);
  const valueStart = colonIndex + 1;
  if (!name) return undefined;
  if (value === "") return { kind: "same-name", name, ...base, nameRange: nameRange(0, colonIndex), expressionRange: nameRange(0, colonIndex) };

  const expression = unwrapMustacheExpression(value);
  if (expression !== undefined) {
    const expressionStartInValue = value.indexOf(expression);
    const expressionStart = valueStart + (expressionStartInValue === -1 ? 0 : expressionStartInValue);
    return {
      kind: "expression",
      name,
      expression,
      ...base,
      nameRange: nameRange(0, colonIndex),
      valueRange: valueRange(valueStart, token.length),
      expressionRange: valueRange(expressionStart, expressionStart + expression.length)
    };
  }

  const quoted = unwrapQuotedString(value);
  if (quoted !== undefined) {
    return {
      kind: "literal",
      name,
      value: quoted,
      quoted: true,
      ...base,
      nameRange: nameRange(0, colonIndex),
      valueRange: valueRange(valueStart, token.length)
    };
  }

  if (looksLikeExpression(value)) {
    return {
      kind: "expression",
      name,
      expression: value,
      ...base,
      nameRange: nameRange(0, colonIndex),
      valueRange: valueRange(valueStart, token.length),
      expressionRange: valueRange(valueStart, token.length)
    };
  }
  return {
    kind: "literal",
    name,
    value,
    quoted: false,
    ...base,
    nameRange: nameRange(0, colonIndex),
    valueRange: valueRange(valueStart, token.length)
  };
}

function isAttributeLike(token: string): boolean {
  if (!token) return false;
  // {{ interpolation }} tokens are inline text, even when the expression contains ":".
  if (token.startsWith("{{")) return false;
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
  if (/^(route|attrs|state|api|ctx|context)\b/.test(value)) return true;
  // URL-path values like href:/tasks or src:/assets/logo.svg are literals.
  if (/^\/[\w\-./:?=&%#~]*$/.test(value)) return false;
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

    // Utility groups are whitespace-delimited bracket groups. A "[" attached to
    // the preceding token is member access (actionStates["..."], items[0]).
    const startsToken = index === 0 || /\s/.test(input[index - 1]!);
    if (char === "[" && curlyDepth === 0 && startsToken) {
      const close = input.indexOf("]", index + 1);
      if (close !== -1) {
        utilities.push(...input.slice(index + 1, close).trim().split(/\s+/).filter(Boolean));
        withoutUtilities += " ".repeat(close - index + 1);
        index = close;
        continue;
      }
    }

    withoutUtilities += char;
  }

  return { withoutUtilities, utilities };
}

function tokenizeWithRanges(input: string): TokenRecord[] {
  const tokens: TokenRecord[] = [];
  let current = "";
  let currentStart: number | undefined;
  let quote: string | undefined;
  let curlyDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  const append = (char: string, index: number) => {
    currentStart ??= index;
    current += char;
  };
  const push = (end: number) => {
    if (current !== "" && currentStart !== undefined) tokens.push({ raw: current, start: currentStart, end });
    current = "";
    currentStart = undefined;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (quote) {
      append(char, index);
      if (char === "\\") {
        index += 1;
        append(input[index] ?? "", index);
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      append(char, index);
      continue;
    }

    if (char === "{") curlyDepth += 1;
    else if (char === "}" && curlyDepth > 0) curlyDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (char === "(") parenDepth += 1;
    else if (char === ")" && parenDepth > 0) parenDepth -= 1;

    if (/\s/.test(char) && curlyDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      push(index);
      continue;
    }

    append(char, index);
  }

  push(input.length);
  return tokens;
}

function computeLineStartOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\r") {
      if (source[index + 1] === "\n") index += 1;
      offsets.push(index + 1);
    } else if (char === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function makeRange(line: LineRecord, leadingWhitespaceLength: number, lineLength: number): SourceRange {
  const start: SourceLocation = {
    line: line.sourceLine,
    column: leadingWhitespaceLength + 1,
    offset: line.sourceOffset + leadingWhitespaceLength
  };
  const end: SourceLocation = {
    line: line.sourceLine,
    column: lineLength + 1,
    offset: line.sourceOffset + lineLength
  };
  return { start, end };
}

function makeSubRange(parent: SourceRange, relativeStart: number, relativeEnd: number): SourceRange {
  return {
    start: {
      line: parent.start.line,
      column: parent.start.column + relativeStart,
      offset: parent.start.offset + relativeStart
    },
    end: {
      line: parent.start.line,
      column: parent.start.column + relativeEnd,
      offset: parent.start.offset + relativeEnd
    }
  };
}

function rangeForTokenSpan(parent: SourceRange, tokens: readonly TokenRecord[]): SourceRange | undefined {
  const first = tokens[0];
  const last = tokens.at(-1);
  return first && last ? makeSubRange(parent, first.start, last.end) : undefined;
}

function leadingWhitespaceLength(value: string): number {
  return /^\s*/.exec(value)?.[0].length ?? 0;
}

function trimEndIndex(value: string): number {
  return value.length - (/\s*$/.exec(value)?.[0].length ?? 0);
}
