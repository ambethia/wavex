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
  utilities: string[];
  inlineText?: string;
  inlineTextRange?: SourceRange;
}

interface TokenRecord {
  raw: string;
  start: number;
  end: number;
}

const ATTRIBUTE_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

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
  if (trimmed.startsWith("+")) return parseDirective(trimmed, content, range, diagnostics);
  if (trimmed.startsWith("@")) return parseComponent(trimmed, content, range, diagnostics);
  return parseElement(trimmed, content, range, diagnostics);
}

function parseElement(trimmed: string, raw: string, range: SourceRange, diagnostics: Diagnostic[]): ElementNode {
  const [tagToken, ...tokens] = tokenizeWithRanges(trimmed);
  const tag = tagToken?.raw ?? "div";
  const parsed = parseAttributesUtilitiesAndInlineText(tokens, range, diagnostics);
  return {
    kind: "element",
    tag,
    attributes: parsed.attributes,
    utilities: parsed.utilities,
    inlineText: parsed.inlineText,
    inlineTextRange: parsed.inlineTextRange,
    children: [],
    raw,
    range
  };
}

function parseComponent(trimmed: string, raw: string, range: SourceRange, diagnostics: Diagnostic[]): ComponentNode {
  const [referenceToken, ...tokens] = tokenizeWithRanges(trimmed);
  const reference = referenceToken?.raw ?? "@missing";
  const parsed = parseAttributesUtilitiesAndInlineText(tokens, range, diagnostics);
  return {
    kind: "component",
    reference: reference.slice(1),
    attributes: parsed.attributes,
    utilities: parsed.utilities,
    inlineText: parsed.inlineText,
    inlineTextRange: parsed.inlineTextRange,
    children: [],
    raw,
    range
  };
}

function parseDirective(trimmed: string, raw: string, range: SourceRange, diagnostics: Diagnostic[]): DirectiveNode {
  const [headToken, ...tokens] = tokenizeWithRanges(trimmed);
  const head = headToken?.raw ?? "+unknown";
  const name = head.slice(1);
  const attributes: Attribute[] = [];
  let expression: string | undefined;
  let expressionRange: SourceRange | undefined;
  let forDirective: ForDirective | undefined;
  const nonHeadUtilityMessage = "Directive expressions cannot contain utility groups; bracket utility groups are only valid in element or component heads.";

  if (name === "for") {
    const parsedFor = parseForDirective(tokens, range, diagnostics, nonHeadUtilityMessage);
    forDirective = parsedFor.forDirective;
    attributes.push(...parsedFor.attributes);
    expression = tokens.map((token) => token.raw).join(" ") || undefined;
    expressionRange = rangeForTokenSpan(range, tokens);
  } else if (name === "head" || name === "boundary") {
    attributes.push(...parseAttributeTokens(tokens, range, diagnostics, nonHeadUtilityMessage));
  } else if (name === "suspense") {
    const parsed = parseAttributesAndInlineText(tokens, range, diagnostics, nonHeadUtilityMessage);
    attributes.push(...parsed.attributes);
    expression = parsed.inlineText;
    expressionRange = parsed.inlineTextRange;
  } else {
    diagnoseNonHeadUtilityGroups(tokens, range, diagnostics, nonHeadUtilityMessage);
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

function parseForDirective(
  tokens: TokenRecord[],
  range: SourceRange,
  diagnostics: Diagnostic[],
  utilityGroupMessage: string
): { forDirective?: ForDirective; attributes: Attribute[] } {
  const keyTokenIndex = tokens.findIndex((token) => token.raw.startsWith("key:"));
  const loopTokens = keyTokenIndex === -1 ? tokens : tokens.slice(0, keyTokenIndex);
  const attrTokens = keyTokenIndex === -1 ? [] : tokens.slice(keyTokenIndex);
  diagnoseNonHeadUtilityGroups(loopTokens, range, diagnostics, utilityGroupMessage);
  const attributes = parseAttributeTokens(attrTokens, range, diagnostics, utilityGroupMessage);
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
    attributes: parseAttributeTokens(
      tokens,
      range,
      diagnostics,
      "Convex references cannot contain utility groups; bracket utility groups are only valid in element or component heads."
    ),
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
  const attributes = parseAttributeTokens(
    tokens,
    range,
    diagnostics,
    "Convex calls cannot contain utility groups; bracket utility groups are only valid in element or component heads."
  );
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

function parseAttributesUtilitiesAndInlineText(tokens: TokenRecord[], range: SourceRange, diagnostics: Diagnostic[]): ParsedHead {
  const attributes: Attribute[] = [];
  const utilities: string[] = [];
  let inlineText: string | undefined;
  let inlineTextRange: SourceRange | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (isUtilityGroupToken(token.raw)) {
      utilities.push(...parseUtilityGroupToken(token, range, diagnostics));
      continue;
    }

    if (isLikelyUnclosedUtilityGroupToken(token.raw)) {
      diagnoseUnclosedUtilityGroupToken(token, range, diagnostics);
      const inlineTokens = tokens.slice(index);
      inlineText = inlineTokens.map((inlineToken) => inlineToken.raw).join(" ");
      inlineTextRange = rangeForTokenSpan(range, inlineTokens);
      break;
    }

    if (!isAttributeLike(token.raw)) {
      const inlineTokens = tokens.slice(index);
      diagnoseHeadTokensAfterInlineText(inlineTokens, range, diagnostics, "Utility groups must appear in the element or component head before inline text.");
      inlineText = inlineTokens.map((inlineToken) => inlineToken.raw).join(" ");
      inlineTextRange = rangeForTokenSpan(range, inlineTokens);
      break;
    }

    const attribute = parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end));
    if (attribute) attributes.push(attribute);
    else diagnoseInvalidAttributeToken(token, range, diagnostics);
  }

  return { attributes, utilities, inlineText, inlineTextRange };
}

function parseAttributesAndInlineText(tokens: TokenRecord[], range: SourceRange, diagnostics: Diagnostic[], utilityGroupMessage: string): ParsedHead {
  const attributes: Attribute[] = [];
  let inlineText: string | undefined;
  let inlineTextRange: SourceRange | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isAttributeLike(token.raw)) {
      const inlineTokens = tokens.slice(index);
      diagnoseHeadTokensAfterInlineText(inlineTokens, range, diagnostics, utilityGroupMessage);
      inlineText = inlineTokens.map((inlineToken) => inlineToken.raw).join(" ");
      inlineTextRange = rangeForTokenSpan(range, inlineTokens);
      break;
    }

    const attribute = parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end));
    if (attribute) attributes.push(attribute);
    else diagnoseInvalidAttributeToken(token, range, diagnostics);
  }

  return { attributes, utilities: [], inlineText, inlineTextRange };
}

function isUtilityGroupToken(token: string): boolean {
  return token.startsWith("[") && token.endsWith("]");
}

function parseUtilityGroupToken(token: TokenRecord, range: SourceRange, diagnostics: Diagnostic[]): string[] {
  const values = utilityGroupValueTokens(token.raw);
  for (const value of values) {
    if (value.raw.includes(":")) {
      diagnostics.push({
        code: "WX005",
        severity: "error",
        line: range.start.line,
        column: range.start.column + token.start + value.start,
        message: `Utility token "${value.raw}" is invalid: utilities are literal wa-* suffixes in dash form (e.g. "gap-xl" -> wa-gap-xl); ":" is not allowed inside a utility group.`
      });
    }
  }
  return values.map((value) => value.raw);
}

function utilityGroupValueTokens(token: string): TokenRecord[] {
  const values: TokenRecord[] = [];
  const innerStart = 1;
  const innerEnd = token.endsWith("]") ? token.length - 1 : token.length;
  let currentStart: number | undefined;

  for (let index = innerStart; index < innerEnd; index += 1) {
    const char = token[index]!;
    if (/\s/.test(char)) {
      if (currentStart !== undefined) values.push({ raw: token.slice(currentStart, index), start: currentStart, end: index });
      currentStart = undefined;
    } else {
      currentStart ??= index;
    }
  }

  if (currentStart !== undefined) values.push({ raw: token.slice(currentStart, innerEnd), start: currentStart, end: innerEnd });
  return values;
}

function diagnoseHeadTokensAfterInlineText(tokens: TokenRecord[], range: SourceRange, diagnostics: Diagnostic[], utilityGroupMessage: string): void {
  for (const token of tokens) {
    if (isUtilityGroupToken(token.raw)) {
      diagnostics.push({
        code: "WX006",
        severity: "error",
        line: range.start.line,
        column: range.start.column + token.start,
        message: utilityGroupMessage
      });
    } else if (isLikelyUnclosedUtilityGroupToken(token.raw)) {
      diagnoseUnclosedUtilityGroupToken(token, range, diagnostics);
    } else if (isAttributeLike(token.raw)) {
      diagnostics.push({
        code: "WX007",
        severity: "error",
        line: range.start.line,
        column: range.start.column + token.start,
        message: `Attribute token "${token.raw}" must appear before inline text; use an explicit text line (|) if this is prose.`
      });
    }
  }
}

function diagnoseInvalidAttributeToken(token: TokenRecord, range: SourceRange, diagnostics: Diagnostic[]): void {
  diagnostics.push({
    code: "WX008",
    severity: "error",
    line: range.start.line,
    column: range.start.column + token.start,
    message: `Invalid attribute token "${token.raw}". Attribute names must start with a lowercase letter and use lowercase letters, numbers, underscores, or dashes.`
  });
}

function diagnoseNonHeadUtilityGroups(tokens: TokenRecord[], range: SourceRange, diagnostics: Diagnostic[], message: string): void {
  for (const token of tokens) {
    if (isLikelyUtilityGroupToken(token.raw)) diagnoseUtilityGroupToken(token, range, diagnostics, message);
    else if (isLikelyUnclosedUtilityGroupToken(token.raw)) diagnoseUnclosedUtilityGroupToken(token, range, diagnostics);
  }
}

function diagnoseUtilityGroupToken(token: TokenRecord, range: SourceRange, diagnostics: Diagnostic[], message: string): void {
  diagnostics.push({
    code: "WX006",
    severity: "error",
    line: range.start.line,
    column: range.start.column + token.start,
    message
  });
}

function diagnoseUnclosedUtilityGroupToken(token: TokenRecord, range: SourceRange, diagnostics: Diagnostic[]): void {
  diagnostics.push({
    code: "WX005",
    severity: "error",
    line: range.start.line,
    column: range.start.column + token.start,
    message: `Utility group "${token.raw}" is invalid: missing closing "]".`
  });
}

function isLikelyUtilityGroupToken(token: string): boolean {
  if (!isUtilityGroupToken(token)) return false;
  return isLikelyUtilityGroupValues(token.slice(1, -1));
}

function isLikelyUnclosedUtilityGroupToken(token: string): boolean {
  if (!token.startsWith("[") || token.endsWith("]")) return false;
  return isLikelyUtilityGroupValues(token.slice(1));
}

function isLikelyUtilityGroupValues(value: string): boolean {
  const values = value.trim().split(/\s+/).filter(Boolean);
  return (
    values.length > 0 &&
    (values.length > 1 || values.some((entry) => entry.includes("-") || entry.includes(":"))) &&
    values.every((entry) => /^[A-Za-z][A-Za-z0-9_:-]*$/.test(entry))
  );
}

/**
 * Parse one attribute token into its {@link Attribute} form: boolean
 * (`required`), literal (`variant:brand`), expression-shaped value
 * (`checked:task.done` or `checked:{{ task.done }}`), same-name shorthand
 * (`task:`), semantic event (`:click:save`), or raw DOM event
 * (`on:wa-show:opened`).
 */
export function parseAttributeToken(token: string, range?: SourceRange): Attribute | undefined {
  if (!token) return undefined;

  const nameRange = (start: number, end: number) => (range ? makeSubRange(range, start, end) : undefined);
  const valueRange = (start: number, end: number) => (range ? makeSubRange(range, start, end) : undefined);
  const base = { raw: token, range };

  if (token.startsWith("on:")) {
    const [, event, ...handlerParts] = token.split(":");
    const handler = handlerParts.join(":");
    if (!event || !handler) return undefined;
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

  if (token.startsWith(":")) {
    const body = token.slice(1);
    const split = body.indexOf(":");
    if (split === -1) return undefined;
    const event = body.slice(0, split);
    const target = body.slice(split + 1);
    if (!event || !target) return undefined;
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

  const colonIndex = token.indexOf(":");
  if (colonIndex === -1) {
    if (!ATTRIBUTE_NAME_PATTERN.test(token)) return undefined;
    return { kind: "boolean", name: token, ...base, nameRange: range };
  }

  const name = token.slice(0, colonIndex);
  const value = token.slice(colonIndex + 1);
  const valueStart = colonIndex + 1;
  if (!ATTRIBUTE_NAME_PATTERN.test(name)) return undefined;
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
  const colonIndex = token.indexOf(":");
  if (colonIndex !== -1) return ATTRIBUTE_NAME_PATTERN.test(token.slice(0, colonIndex));
  if (BOOLEAN_ATTRIBUTE_NAMES.has(token)) return true;
  return /^[a-z][a-z0-9_-]*-[a-z0-9_-]+$/.test(token);
}

function parseAttributeTokens(tokens: TokenRecord[], range: SourceRange, diagnostics: Diagnostic[], utilityGroupMessage?: string): Attribute[] {
  const attributes: Attribute[] = [];
  for (const token of tokens) {
    if (utilityGroupMessage) {
      if (isUtilityGroupToken(token.raw)) {
        diagnoseUtilityGroupToken(token, range, diagnostics, utilityGroupMessage);
        continue;
      }
      if (isLikelyUnclosedUtilityGroupToken(token.raw)) {
        diagnoseUnclosedUtilityGroupToken(token, range, diagnostics);
        continue;
      }
    }

    const attribute = parseAttributeToken(token.raw, makeSubRange(range, token.start, token.end));
    if (attribute) attributes.push(attribute);
    else diagnoseInvalidAttributeToken(token, range, diagnostics);
  }
  return attributes;
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
  if (/^(true|false|null|undefined)$/.test(value)) return true;
  if (/^(route|attrs|state|api|ctx|context)(?:$|[.(\[]|\?\.)/.test(value)) return true;
  // URL/URI values like href:/tasks, href:https://example.com, or href:tel:+123 are literals.
  if (/^\/[\w\-./:?=&%#~]*$/.test(value)) return false;
  if (/^[a-z][a-z0-9+.-]*:\S+$/i.test(value)) return false;
  if (/^!\S+/.test(value)) return true;
  return /[.()[\]{}]|=>|[+*/%]|===?|!==?|[<>]=?|&&|\|\||\?\?|\?.+:/.test(value);
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
