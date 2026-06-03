import { componentReferenceToTag, expandUtilityClassList, toKebabCase } from "@wavex/core";
import { parseWavex } from "@wavex/language-core";
import type {
  Attribute,
  ComponentNode,
  ConvexCallNode,
  DirectiveNode,
  ElementNode,
  TemplateNode,
  WavexFile
} from "@wavex/language-core";

export interface CompileWavexOptions {
  id?: string;
  localComponents?: readonly string[];
  webAwesomeComponents?: readonly string[];
}

export interface CompileWavexResult {
  ast: WavexFile;
  code: string;
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export function compileWavexModule(source: string, options: CompileWavexOptions = {}): CompileWavexResult {
  const ast = parseWavex(source, { fileName: options.id });
  const renderNodes = ast.nodes.filter((node) => !(node.kind === "directive" && node.name === "head"));
  const headNodes = ast.nodes.filter((node): node is DirectiveNode => node.kind === "directive" && node.name === "head");
  const resourceNames = [...new Set(ast.resources.map((resource) => resource.name).filter(isIdentifierName))];
  const prelude = ast.prelude.trim() ? `${ast.prelude.trim()}\n\n` : "";
  const localComponents = options.localComponents ?? [];
  const resourceDeclarations = resourceNames
    .map((name) => `  const ${name} = context.resources?.[${JSON.stringify(name)}];`)
    .join("\n");
  const renderBody = compileNodes(renderNodes, options);
  const headBody = compileNodes(headNodes.flatMap((node) => node.children), options);

  const code = [
    `import { html, nothing } from "lit";`,
    `import { repeat } from "lit/directives/repeat.js";`,
    `import type { RenderContext } from "@wavex/runtime";`,
    "",
    prelude + `export const wxFile = ${JSON.stringify({ id: options.id ?? "<inline>", localComponents })} as const;`,
    `export const resources = ${JSON.stringify(
      ast.resources.map((resource) => ({
        name: resource.name,
        modulePath: resource.address.modulePath,
        functionName: resource.address.functionName,
        raw: resource.address.raw
      })),
      null,
      2
    )} as const;`,
    "",
    `export function head(context: RenderContext = {}) {`,
    `  const route = context.route ?? { path: "/", params: {}, query: {} };`,
    `  const props = context.props ?? {};`,
    `  const state = context.state ?? {};`,
    resourceDeclarations,
    `  void route; void props; void state;`,
    `  return html\`${headBody}\`;`,
    `}`,
    "",
    `export function render(context: RenderContext = {}) {`,
    `  const route = context.route ?? { path: "/", params: {}, query: {} };`,
    `  const props = context.props ?? {};`,
    `  const state = context.state ?? {};`,
    resourceDeclarations,
    `  void route; void props; void state;`,
    `  return html\`${renderBody}\`;`,
    `}`,
    "",
    `export default render;`,
    ""
  ].join("\n");

  return { ast, code };
}

function compileNodes(nodes: readonly TemplateNode[], options: CompileWavexOptions): string {
  return nodes.map((node) => compileNode(node, options)).join("");
}

function compileNode(node: TemplateNode, options: CompileWavexOptions): string {
  switch (node.kind) {
    case "element":
      return compileElement(node, options);
    case "component":
      return compileComponent(node, options);
    case "directive":
      return compileDirective(node, options);
    case "text":
      return compileInlineText(node.text);
    case "expression":
      return `\${${node.expression}}`;
    case "convex-reference":
      return "";
    case "convex-call":
      return compileConvexCall(node, options);
    default:
      return "";
  }
}

function compileElement(node: ElementNode, options: CompileWavexOptions): string {
  const attrs = compileAttributes(node.attributes, node.utilities);
  const inlineText = node.inlineText ? compileInlineText(node.inlineText) : "";
  const children = compileNodes(node.children, options);
  if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${inlineText}${children}</${node.tag}>`;
}

function compileComponent(node: ComponentNode, options: CompileWavexOptions): string {
  const tag = componentReferenceToTag(node.reference, {
    localComponents: options.localComponents,
    webAwesomeComponents: options.webAwesomeComponents
  });
  const attrs = compileAttributes(node.attributes, node.utilities);
  const inlineText = node.inlineText ? compileInlineText(node.inlineText) : "";
  const children = compileNodes(node.children, options);
  return `<${tag}${attrs}>${inlineText}${children}</${tag}>`;
}

function compileDirective(node: DirectiveNode, options: CompileWavexOptions): string {
  if (node.name === "head") return "";
  if (node.name === "if") {
    const expression = node.expression?.trim() || "false";
    return `\${${expression} ? html\`${compileNodes(node.children, options)}\` : nothing}`;
  }
  if (node.name === "for" && node.for) {
    const { itemName, collectionExpression, keyExpression } = node.for;
    const key = keyExpression || `(${itemName} as any)?._id ?? (${itemName} as any)?.id ?? (${itemName} as any)?.key ?? index`;
    return `\${repeat(${collectionExpression} ?? [], (${itemName}, index) => ${key}, (${itemName}, index) => html\`${compileNodes(
      node.children,
      options
    )}\`)}`;
  }
  return compileNodes(node.children, options);
}

function compileConvexCall(node: ConvexCallNode, options: CompileWavexOptions): string {
  if (node.children.length === 0) return "";
  return compileNodes(node.children, options);
}

function compileAttributes(attributes: readonly Attribute[], utilities: readonly string[]): string {
  const emitted: string[] = [];
  const staticClasses: string[] = expandUtilityClassList(utilities);
  const dynamicClasses: string[] = [];

  for (const attribute of attributes) {
    if (attribute.name === "class") {
      if (attribute.kind === "literal") staticClasses.unshift(attribute.value);
      else if (attribute.kind === "expression") dynamicClasses.push(attribute.expression);
      else if (attribute.kind === "same-name") dynamicClasses.push(attribute.name);
      continue;
    }

    switch (attribute.kind) {
      case "boolean":
        emitted.push(` ?${attribute.name}=\${true}`);
        break;
      case "literal":
        emitted.push(` ${attribute.name}=\"${escapeStaticAttribute(attribute.value)}\"`);
        break;
      case "expression":
        emitted.push(compileExpressionAttribute(attribute.name, attribute.expression));
        break;
      case "same-name":
        emitted.push(compileExpressionAttribute(attribute.name, attribute.name));
        break;
      case "semantic-event":
        emitted.push(` data-wx-${attribute.event}=\"${escapeStaticAttribute(attribute.target)}\"`);
        break;
      case "raw-event":
        emitted.push(` @${attribute.event}=\${${attribute.handler}}`);
        break;
    }
  }

  if (staticClasses.length > 0 || dynamicClasses.length > 0) {
    if (dynamicClasses.length === 0) {
      emitted.unshift(` class=\"${escapeStaticAttribute(staticClasses.join(" "))}\"`);
    } else {
      const staticClassExpr = JSON.stringify(staticClasses.join(" "));
      emitted.unshift(` class=\${[${[...dynamicClasses, staticClassExpr].join(", ")}].filter(Boolean).join(" ")}`);
    }
  }

  return emitted.join("");
}

function compileExpressionAttribute(name: string, expression: string): string {
  if (/^[A-Za-z_$][\w$]*$/.test(name)) return ` .${name}=\${${expression}}`;
  return ` ${name}=\${${expression}}`;
}

function compileInlineText(text: string): string {
  let output = "";
  let cursor = 0;
  const interpolation = /{{([\s\S]*?)}}/g;
  for (const match of text.matchAll(interpolation)) {
    output += compileStaticInlineProse(text.slice(cursor, match.index));
    output += `\${${(match[1] ?? "").trim()}}`;
    cursor = (match.index ?? 0) + match[0].length;
  }
  output += compileStaticInlineProse(text.slice(cursor));
  return output;
}

function compileStaticInlineProse(text: string): string {
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    const tag = inlineTagForDelimiter(char);
    if (!tag) {
      output += escapeTemplateStatic(escapeHtml(char));
      continue;
    }

    const close = text.indexOf(char, index + 1);
    if (close === -1) {
      output += escapeTemplateStatic(escapeHtml(char));
      continue;
    }

    const inner = text.slice(index + 1, close);
    if (inner.length === 0) {
      output += escapeTemplateStatic(escapeHtml(char + char));
    } else {
      output += `<${tag}>${escapeTemplateStatic(escapeHtml(inner))}</${tag}>`;
    }
    index = close;
  }
  return output;
}

function inlineTagForDelimiter(char: string): string | undefined {
  if (char === "`") return "code";
  if (char === "*") return "strong";
  if (char === "_") return "em";
  if (char === "~") return "mark";
  return undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeStaticAttribute(value: string): string {
  return escapeTemplateStatic(
    value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  );
}

function escapeTemplateStatic(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

export function componentTagForReference(reference: string, options: CompileWavexOptions = {}): string {
  return componentReferenceToTag(reference, options);
}

export function utilityClassForToken(token: string): string {
  return `wa-${toKebabCase(token.replace(/:/g, "-"))}`;
}
