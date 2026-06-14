import { componentReferenceToTag, expandUtilityClassList, extractAttrsTypeKeys, toKebabCase } from "@wavex/core";
import { parseWavex } from "@wavex/core";
import { convexSemanticEventTargetReference, validateConvexReferences, type ConvexFunctionKind } from "@wavex/core/capabilities";
import type {
  Attribute,
  ComponentNode,
  ConvexCallNode,
  ConvexFunctionAddress,
  DirectiveNode,
  ElementNode,
  ResourceBinding,
  TemplateNode,
  WavexFile
} from "@wavex/core";

/** Options for {@link compileWavexModule}. */
export interface CompileWavexOptions {
  /** Module id used in diagnostics and the generated `wxFile` metadata (usually the file path). */
  id?: string;
  /** Local `src/components/` references; these shadow Web Awesome names in `@` lookup. */
  localComponents?: readonly string[];
  /** Web Awesome component names (without `wa-`) detected from the installed package. */
  webAwesomeComponents?: readonly string[];
  /** Detected Convex function kind map keyed by normalized `module/path:function`. */
  convexFunctionKinds?: Readonly<Record<string, ConvexFunctionKind>>;
}

/** Result of {@link compileWavexModule}: the parsed AST plus the generated module source. */
export interface CompileWavexResult {
  ast: WavexFile;
  /** Generated TypeScript module source (render function, resources, head entries). */
  code: string;
  /** Web Awesome component names (without the wa- prefix) referenced by this template. */
  usedWebAwesomeComponents: readonly string[];
}

interface InternalCompileOptions extends CompileWavexOptions {
  usedLocalComponents?: Set<string>;
  usedWebAwesomeComponents?: Set<string>;
}

interface CompileScope {
  /** Binding name of the enclosing $$ resource block. */
  resource?: string;
  /** Semantic action target ($$module:fn) of the enclosing element. */
  action?: string;
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * Compile `.wx` source into a Lit render module.
 *
 * The generated module preserves the TypeScript prelude verbatim, then
 * exports: a `render(context)` function built on Lit `html`/`repeat`, a
 * `resources` array of inferred Convex query definitions, and a
 * `headEntries(context)` function for `+head` content. Components declaring
 * `type Attrs = { … }` in their prelude get each attribute destructured as a
 * bare typed local in template scope. Parse and compile problems are reported
 * on `result.ast.diagnostics`, not thrown.
 */
export function compileWavexModule(source: string, options: CompileWavexOptions = {}): CompileWavexResult {
  const ast = parseWavex(source, { fileName: options.id });
  ast.diagnostics.push(...validateConvexReferences(ast, { functionKinds: options.convexFunctionKinds }));
  const renderNodes = ast.nodes.filter((node) => !(node.kind === "directive" && node.name === "head"));
  const headNodes = ast.nodes.filter((node): node is DirectiveNode => node.kind === "directive" && node.name === "head");
  const resourceNames = [
    ...new Set(ast.resources.filter((resource) => isQueryResource(resource, options.convexFunctionKinds)).map((resource) => resource.name).filter(isIdentifierName))
  ];
  const prelude = ast.prelude.trim() ? `${ast.prelude.trim()}\n\n` : "";
  const localComponents = options.localComponents ?? [];
  const usedLocalComponents = new Set<string>();
  const usedWebAwesomeComponents = new Set<string>();
  const compileOptions: InternalCompileOptions = { ...options, usedLocalComponents, usedWebAwesomeComponents };
  const resourceDeclarations = resourceNames
    .map((name) => `  const ${name} = context.resources?.[${JSON.stringify(name)}];`)
    .join("\n");
  // Components declaring `type Attrs = { ... }` get each attribute as a bare local.
  const attrsKeys = (extractAttrsTypeKeys(ast.prelude) ?? []).filter(isIdentifierName);
  const attrsDeclarations =
    attrsKeys.length > 0
      ? `  const { ${attrsKeys.join(", ")} } = attrs as Attrs;\n  void ${attrsKeys.join("; void ")};`
      : "";
  const resourceDefinitions = compileResourceDefinitions(ast.resources, resourceNames, options.convexFunctionKinds);
  const renderBody = compileNodes(renderNodes, compileOptions);
  const headEntriesBody = compileHeadEntries(headNodes.flatMap((node) => node.children));
  const componentImports = [...usedLocalComponents]
    .sort()
    .map((reference) => `import * as ${localComponentModuleName(reference)} from ${JSON.stringify(`/src/components/${reference}.wx`)};`);

  const code = [
    `import { html, nothing } from "lit";`,
    `import { repeat } from "lit/directives/repeat.js";`,
    `import type { HeadEntry, RenderContext, ResourceDefinition } from "@wavex/runtime";`,
    ...componentImports,
    "",
    prelude + `export const wxFile = ${JSON.stringify({ id: options.id ?? "<inline>", localComponents })} as const;`,
    resourceDefinitions,
    "",
    `export function headEntries(context: RenderContext = {}): HeadEntry[] {`,
    `  const route = context.route ?? { path: "/", params: {}, query: {} };`,
    `  const attrs = context.attrs ?? {};`,
    `  const state = context.state ?? {};`,
    `  const resourceStates = context.resourceStates ?? {};`,
    `  const actionStates = context.actionStates ?? {};`,
    `  const navigation = context.navigation ?? { pending: false };`,
    resourceDeclarations,
    attrsDeclarations,
    `  void route; void attrs; void state; void resourceStates; void actionStates; void navigation;`,
    `  return [${headEntriesBody}];`,
    `}`,
    "",
    `export function render(context: RenderContext = {}) {`,
    `  const route = context.route ?? { path: "/", params: {}, query: {} };`,
    `  const attrs = context.attrs ?? {};`,
    `  const state = context.state ?? {};`,
    `  const resourceStates = context.resourceStates ?? {};`,
    `  const actionStates = context.actionStates ?? {};`,
    `  const navigation = context.navigation ?? { pending: false };`,
    resourceDeclarations,
    attrsDeclarations,
    `  void route; void attrs; void state; void resourceStates; void actionStates; void navigation;`,
    `  return html\`${renderBody}\`;`,
    `}`,
    "",
    `export default render;`,
    ""
  ].join("\n");

  return { ast, code, usedWebAwesomeComponents: [...usedWebAwesomeComponents].sort() };
}

function compileResourceDefinitions(
  resources: readonly ResourceBinding[],
  resourceNames: readonly string[],
  convexFunctionKinds: Readonly<Record<string, ConvexFunctionKind>> | undefined
): string {
  const queryResources = resources.filter((resource) => isQueryResource(resource, convexFunctionKinds));
  if (queryResources.length === 0) return `export const resources = [] as const satisfies readonly ResourceDefinition[];`;

  const entries = queryResources.map((resource) => {
    const argsGetter = compileResourceArgsGetter(resource.attributes, resourceNames);
    return [
      `  {`,
      `    name: ${JSON.stringify(resource.name)},`,
      `    modulePath: ${JSON.stringify(resource.address.modulePath)},`,
      `    functionName: ${JSON.stringify(resource.address.functionName)},`,
      `    raw: ${JSON.stringify(resource.address.raw)},`,
      `    kind: "query",`,
      argsGetter,
      `  }`
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [`export const resources = [`, entries.join(",\n"), `] as const satisfies readonly ResourceDefinition[];`].join("\n");
}

/** Args names reserved for WAVEx itself on $$ calls. */
const RESERVED_RESOURCE_ATTRIBUTES = new Set(["as", "args"]);

function isQueryResource(resource: ResourceBinding, convexFunctionKinds: Readonly<Record<string, ConvexFunctionKind>> | undefined): boolean {
  return isQueryConvexAddress(resource.address, convexFunctionKinds);
}

function isQueryConvexAddress(address: ConvexFunctionAddress, convexFunctionKinds: Readonly<Record<string, ConvexFunctionKind>> | undefined): boolean {
  const kind = convexFunctionKinds?.[`${address.modulePath}:${address.functionName}`];
  return kind === undefined || kind === "query";
}

function compileResourceArgsGetter(attributes: readonly Attribute[], resourceNames: readonly string[]): string {
  const parts: string[] = [];

  // Explicit object form: args:{ ... } spreads first so attribute args win.
  const argsAttribute = attributes.find((attribute) => attribute.name === "args");
  const argsExpression = attributeValueExpression(argsAttribute);
  if (argsExpression) parts.push(`...(${argsExpression})`);

  // The wavex-native form: every other attribute is an arg.
  // $$talks:get slug:route.params.slug
  for (const attribute of attributes) {
    if (RESERVED_RESOURCE_ATTRIBUTES.has(attribute.name)) continue;
    const key = JSON.stringify(attribute.name);
    if (attribute.kind === "expression") parts.push(`${key}: ${attribute.expression}`);
    else if (attribute.kind === "literal") parts.push(`${key}: ${JSON.stringify(attribute.value)}`);
    else if (attribute.kind === "same-name") parts.push(`${key}: ${attribute.name}`);
    else if (attribute.kind === "boolean") parts.push(`${key}: true`);
  }

  if (parts.length === 0) return "";
  const expression = `{ ${parts.join(", ")} }`;

  const declarations = resourceNames
    .filter(isIdentifierName)
    .map((name) => `      const ${name} = contextResources[${JSON.stringify(name)}];`)
    .join("\n");

  return [
    `    getArgs(context: RenderContext) {`,
    `      const route = context.route ?? { path: "/", params: {}, query: {} };`,
    `      const attrs = context.attrs ?? {};`,
    `      const state = context.state ?? {};`,
    `      const navigation = context.navigation ?? { pending: false };`,
    `      const contextResources = context.resources ?? {};`,
    declarations,
    `      void route; void attrs; void state; void navigation; void contextResources;`,
    `      return ${expression};`,
    `    },`
  ]
    .filter(Boolean)
    .join("\n");
}

/** Compile +head children (title/meta/link elements) into HeadEntry object literals. */
function compileHeadEntries(nodes: readonly TemplateNode[]): string {
  const entries: string[] = [];
  for (const node of nodes) {
    if (node.kind !== "element") continue;
    if (node.tag === "title") {
      entries.push(`{ tag: "title", text: ${compileTextToStringLiteral(node.inlineText ?? "")} }`);
      continue;
    }
    if (node.tag !== "meta" && node.tag !== "link") continue;
    const attributes = node.attributes
      .flatMap((attribute) => {
        const key = JSON.stringify(attribute.name);
        if (attribute.kind === "literal") return [`${key}: ${JSON.stringify(attribute.value)}`];
        if (attribute.kind === "expression") return [`${key}: String(${attribute.expression})`];
        if (attribute.kind === "same-name") return [`${key}: String(${attribute.name})`];
        if (attribute.kind === "boolean") return [`${key}: ""`];
        return [];
      })
      .join(", ");
    entries.push(`{ tag: ${JSON.stringify(node.tag)}, attributes: { ${attributes} } }`);
  }
  return entries.join(", ");
}

/** Inline text with {{ interpolations }} as a plain JS template literal (no HTML escaping or prose spans). */
function compileTextToStringLiteral(text: string): string {
  let output = "";
  let cursor = 0;
  const interpolation = /{{([\s\S]*?)}}/g;
  for (const match of text.matchAll(interpolation)) {
    output += escapeTemplateStatic(text.slice(cursor, match.index));
    output += `\${${(match[1] ?? "").trim()}}`;
    cursor = (match.index ?? 0) + match[0].length;
  }
  output += escapeTemplateStatic(text.slice(cursor));
  return `\`${output}\``;
}

function attributeValueExpression(attribute: Attribute | undefined): string | undefined {
  if (!attribute) return undefined;
  if (attribute.kind === "expression") return attribute.expression;
  if (attribute.kind === "same-name") return attribute.name;
  if (attribute.kind === "literal") return JSON.stringify(attribute.value);
  return undefined;
}

function compileNodes(nodes: readonly TemplateNode[], options: InternalCompileOptions, scope: CompileScope = {}): string {
  return nodes.map((node) => compileNode(node, options, scope)).join("");
}

function compileNode(node: TemplateNode, options: InternalCompileOptions, scope: CompileScope = {}): string {
  switch (node.kind) {
    case "element":
      return compileElement(node, options, scope);
    case "component":
      return compileComponent(node, options, scope);
    case "directive":
      return compileDirective(node, options, scope);
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

function compileElement(node: ElementNode, options: InternalCompileOptions, scope: CompileScope = {}): string {
  if (node.tag === "slot") {
    // Semantic slot projection: layouts and local components receive their
    // composed content through context.slots; fallback content renders when
    // the slot is unfilled. slot: *attributes* on elements stay native.
    const nameAttribute = node.attributes.find((attribute) => attribute.name === "name");
    const slotName = nameAttribute?.kind === "literal" ? nameAttribute.value : "default";
    const fallback = node.children.length > 0 ? `html\`${compileNodes(node.children, options, scope)}\`` : "nothing";
    return `\${context.slots?.[${JSON.stringify(slotName)}] ?? ${fallback}}`;
  }
  const attrs = compileAttributes(node.attributes, node.utilities, options);
  const inlineText = node.inlineText ? compileInlineText(node.inlineText) : "";
  const children = compileNodes(node.children, options, scopeForChildren(node.attributes, scope, options.convexFunctionKinds));
  if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${inlineText}${children}</${node.tag}>`;
}

function compileComponent(node: ComponentNode, options: InternalCompileOptions, scope: CompileScope = {}): string {
  const localReference = resolveLocalComponentReference(node.reference, options);
  if (localReference) {
    options.usedLocalComponents?.add(localReference);
    return compileLocalComponentInvocation(node, localReference, options, scope);
  }

  const tag = componentReferenceToTag(node.reference, {
    localComponents: options.localComponents,
    webAwesomeComponents: options.webAwesomeComponents
  });
  if (tag.startsWith("wa-")) options.usedWebAwesomeComponents?.add(tag.slice(3));
  const attrs = compileAttributes(node.attributes, node.utilities, options);
  const inlineText = node.inlineText ? compileInlineText(node.inlineText) : "";
  const children = compileNodes(node.children, options, scopeForChildren(node.attributes, scope, options.convexFunctionKinds));
  return `<${tag}${attrs}>${inlineText}${children}</${tag}>`;
}

function resolveLocalComponentReference(reference: string, options: InternalCompileOptions): string | undefined {
  const normalized = reference.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (normalized.startsWith("wa/")) return undefined;
  const candidates = new Set(options.localComponents ?? []);
  if (normalized.startsWith("components/")) {
    const direct = normalized.slice("components/".length);
    return candidates.has(direct) ? direct : direct;
  }
  return candidates.has(normalized) ? normalized : undefined;
}

function compileLocalComponentInvocation(
  node: ComponentNode,
  reference: string,
  options: InternalCompileOptions,
  scope: CompileScope = {}
): string {
  const moduleName = localComponentModuleName(reference);
  const attrArgs: string[] = [];
  for (const attribute of node.attributes) {
    if (attribute.kind === "semantic-event" || attribute.kind === "raw-event") continue;
    const key = JSON.stringify(attribute.name);
    if (attribute.kind === "boolean") attrArgs.push(`${key}: true`);
    else if (attribute.kind === "literal") attrArgs.push(`${key}: ${JSON.stringify(attribute.value)}`);
    else if (attribute.kind === "expression") attrArgs.push(`${key}: ${attribute.expression}`);
    else if (attribute.kind === "same-name") attrArgs.push(`${key}: ${attribute.name}`);
  }

  const slotEntries = new Map<string, string[]>();
  const pushSlot = (name: string, compiled: string) => {
    const bucket = slotEntries.get(name) ?? [];
    bucket.push(compiled);
    slotEntries.set(name, bucket);
  };
  for (const child of node.children) {
    const slotTarget = slotTargetForNode(child);
    if (slotTarget) {
      pushSlot(slotTarget.name, compileNode(slotTarget.node, options, scope));
    } else {
      pushSlot("default", compileNode(child, options, scope));
    }
  }
  if (node.inlineText) pushSlot("default", compileInlineText(node.inlineText));

  const slots = [...slotEntries.entries()]
    .map(([name, parts]) => `${JSON.stringify(name)}: html\`${parts.join("")}\``)
    .join(", ");

  return `\${(${moduleName}.default ?? ${moduleName}.render)({ ...context, attrs: { ${attrArgs.join(", ")} }, slots: { ${slots} } })}`;
}

/** Children with a literal slot:name attribute fill named slots; the attribute is consumed. */
function slotTargetForNode(node: TemplateNode): { name: string; node: TemplateNode } | undefined {
  if (node.kind !== "element" && node.kind !== "component") return undefined;
  const slotAttribute = node.attributes.find(
    (attribute) => attribute.name === "slot" && attribute.kind === "literal"
  );
  if (!slotAttribute || slotAttribute.kind !== "literal") return undefined;
  return {
    name: slotAttribute.value,
    node: { ...node, attributes: node.attributes.filter((attribute) => attribute !== slotAttribute) }
  };
}

function localComponentModuleName(reference: string): string {
  return `__wxc_${reference.replace(/[^a-zA-Z0-9_$]+/g, "_")}`;
}

function scopeForChildren(
  attributes: readonly Attribute[],
  scope: CompileScope,
  convexFunctionKinds: Readonly<Record<string, ConvexFunctionKind>> | undefined
): CompileScope {
  const semanticTarget = attributes.find(
    (attribute) => attribute.kind === "semantic-event" && attribute.event !== "track" && attribute.target.startsWith("$$")
  );
  if (!semanticTarget || semanticTarget.kind !== "semantic-event" || !isAllowedSemanticEventTarget(semanticTarget.target, convexFunctionKinds)) return scope;
  return { ...scope, action: semanticEventRuntimeTarget(semanticTarget.target).target };
}

const ACTION_STATE_DIRECTIVES = new Set(["pending", "idle", "mutation-error"]);

function compileActionStateDirective(node: DirectiveNode, options: InternalCompileOptions, scope: CompileScope): string {
  const target = JSON.stringify(scope.action);
  const status = `context.actionStates?.[${target}]?.status`;
  const body = compileNodes(node.children, options, scope);

  if (node.name === "pending") {
    return `\${${status} === "pending" ? html\`${body}\` : nothing}`;
  }
  if (node.name === "idle") {
    return `\${${status} !== "pending" ? html\`${body}\` : nothing}`;
  }
  // +mutation-error err
  const binding = isIdentifierName(node.expression?.trim() ?? "") ? node.expression!.trim() : "err";
  return `\${${status} === "error" ? ((${binding}: unknown) => { void ${binding}; return html\`${body}\`; })(context.actionStates?.[${target}]?.error) : nothing}`;
}

/**
 * +suspense reveal:together gates its content until every resource declared
 * inside is ready; reveal:progressive renders immediately (each resource
 * handles its own states). refresh:background is the resource controller's
 * default behavior (previous values stay visible while re-subscribing).
 */
function compileSuspenseDirective(node: DirectiveNode, options: InternalCompileOptions, scope: CompileScope): string {
  const names = new Set<string>();
  const collect = (candidate: TemplateNode) => {
    if (candidate.kind === "convex-call") names.add((candidate as ConvexCallNode).bindingName);
    for (const child of candidate.children) collect(child);
  };
  for (const child of node.children) collect(child);

  const body = compileNodes(node.children, options, scope);
  const reveal = node.attributes.find((attribute) => attribute.name === "reveal");
  const together = !(reveal?.kind === "literal" && reveal.value === "progressive");
  if (!together || names.size === 0) return body;

  const ready = [...names]
    .map((name) => {
      const key = JSON.stringify(name);
      return `((context.resourceStates?.[${key}]?.status ?? (context.resources?.[${key}] === undefined ? "loading" : "ready")) === "ready")`;
    })
    .join(" && ");
  return `\${${ready} ? html\`${body}\` : nothing}`;
}

const RESOURCE_STATE_DIRECTIVES = new Set(["loading", "empty", "error"]);

function compileDirective(node: DirectiveNode, options: InternalCompileOptions, scope: CompileScope = {}): string {
  if (node.name === "head") return "";
  if (node.name === "if") {
    const expression = node.expression?.trim() || "false";
    return `\${${expression} ? html\`${compileNodes(node.children, options, scope)}\` : nothing}`;
  }
  if (node.name === "for" && node.for) {
    const { itemName, collectionExpression, keyExpression } = node.for;
    const key = keyExpression || `(${itemName} as any)?._id ?? (${itemName} as any)?.id ?? (${itemName} as any)?.key ?? index`;
    return `\${repeat(${collectionExpression} ?? [], (${itemName}, index) => ${key}, (${itemName}, index) => html\`${compileNodes(
      node.children,
      options,
      scope
    )}\`)}`;
  }
  if (node.name === "boundary") {
    return compileBoundaryDirective(node, options, scope);
  }
  if (scope.action && ACTION_STATE_DIRECTIVES.has(node.name)) {
    return compileActionStateDirective(node, options, scope);
  }
  if (node.name === "suspense") {
    return compileSuspenseDirective(node, options, scope);
  }
  if (scope.resource && RESOURCE_STATE_DIRECTIVES.has(node.name)) {
    return compileResourceStateDirective(node, options, scope);
  }
  return compileNodes(node.children, options, scope);
}

/**
 * +boundary catches synchronous template-evaluation errors in its children and
 * renders the nested +error fallback instead. Lit template expressions are
 * evaluated eagerly during template construction, so a try/catch IIFE is the
 * right containment for render-time errors.
 */
function compileBoundaryDirective(node: DirectiveNode, options: InternalCompileOptions, scope: CompileScope = {}): string {
  const errorDirectives = node.children.filter(
    (child): child is DirectiveNode => child.kind === "directive" && child.name === "error"
  );
  const contentNodes = node.children.filter((child) => !errorDirectives.includes(child as DirectiveNode));
  const body = compileNodes(contentNodes, options, scope);

  const fallbackDirective = errorDirectives[0];
  const binding = isIdentifierName(fallbackDirective?.expression?.trim() ?? "")
    ? fallbackDirective!.expression!.trim()
    : "err";
  const fallback = fallbackDirective ? `html\`${compileNodes(fallbackDirective.children, options, scope)}\`` : "nothing";

  return `\${(() => { try { return html\`${body}\`; } catch (__wxBoundaryError) { return ((${binding}: unknown) => { void ${binding}; return ${fallback}; })(__wxBoundaryError); } })()}`;
}

function compileResourceStateDirective(node: DirectiveNode, options: InternalCompileOptions, scope: CompileScope): string {
  const name = JSON.stringify(scope.resource);
  const value = `context.resources?.[${name}]`;
  const status = `(context.resourceStates?.[${name}]?.status ?? (${value} === undefined ? "loading" : "ready"))`;
  const body = compileNodes(node.children, options, scope);

  if (node.name === "loading") {
    return `\${${status} === "loading" ? html\`${body}\` : nothing}`;
  }
  if (node.name === "empty") {
    const empty = `(${value} == null || (Array.isArray(${value}) && (${value} as unknown[]).length === 0))`;
    return `\${${status} === "ready" && ${empty} ? html\`${body}\` : nothing}`;
  }
  // +error err — bind the resource error to the declared identifier (default: err)
  const binding = isIdentifierName(node.expression?.trim() ?? "") ? node.expression!.trim() : "err";
  return `\${${status} === "error" ? ((${binding}: unknown) => html\`${body}\`)(context.resourceStates?.[${name}]?.error) : nothing}`;
}

function compileConvexCall(node: ConvexCallNode, options: InternalCompileOptions): string {
  if (node.children.length === 0 || !isQueryConvexAddress(node.address, options.convexFunctionKinds)) return "";
  return compileNodes(node.children, options, { resource: node.bindingName });
}

function compileSemanticEventAttribute(attribute: Extract<Attribute, { kind: "semantic-event" }>, options: InternalCompileOptions): string[] {
  if (!isAllowedSemanticEventTarget(attribute.target, options.convexFunctionKinds)) return [];
  const runtimeTarget = semanticEventRuntimeTarget(attribute.target);
  const emitted = [` data-wx-${attribute.event}=\"${escapeStaticAttribute(runtimeTarget.target)}\"`];
  if (runtimeTarget.argsExpression) emitted.push(` .args=\${${runtimeTarget.argsExpression}}`);
  return emitted;
}

function isAllowedSemanticEventTarget(target: string, convexFunctionKinds: Readonly<Record<string, ConvexFunctionKind>> | undefined): boolean {
  const reference = convexSemanticEventTargetReference(target);
  if (!reference) return true;
  const kind = convexFunctionKinds?.[reference];
  return kind === undefined || kind === "mutation" || kind === "action";
}

function semanticEventRuntimeTarget(target: string): { target: string; argsExpression?: string } {
  if (!target.startsWith("$$")) return { target };
  const openParenIndex = target.indexOf("(");
  if (openParenIndex === -1 || !target.endsWith(")")) return { target };

  const actionTarget = target.slice(0, openParenIndex);
  if (!isConvexActionTarget(actionTarget)) return { target };

  const argsExpression = target.slice(openParenIndex + 1, -1).trim();
  return argsExpression ? { target: actionTarget, argsExpression } : { target: actionTarget };
}

function isConvexActionTarget(target: string): boolean {
  const withoutSigils = target.replace(/^\$\$/, "");
  const splitIndex = withoutSigils.lastIndexOf(":");
  const modulePath = splitIndex === -1 ? "" : withoutSigils.slice(0, splitIndex).replace(/:/g, "/");
  const functionName = splitIndex === -1 ? "" : withoutSigils.slice(splitIndex + 1);
  return /^[A-Za-z0-9_./-]+$/.test(modulePath) && /^[A-Za-z_$][\w$]*$/.test(functionName);
}

function compileAttributes(attributes: readonly Attribute[], utilities: readonly string[], options: InternalCompileOptions): string {
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
        emitted.push(...compileSemanticEventAttribute(attribute, options));
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

/**
 * Resolve an `@name` reference to its custom-element tag using the compile
 * options' component sets (local components shadow Web Awesome).
 */
export function componentTagForReference(reference: string, options: CompileWavexOptions = {}): string {
  return componentReferenceToTag(reference, options);
}

/** Expand one `[utility]` token to its `wa-` class (plain prefix expansion, no mapping table). */
export function utilityClassForToken(token: string): string {
  return `wa-${toKebabCase(token)}`;
}
