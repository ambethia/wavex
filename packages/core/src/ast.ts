import type { Diagnostic } from "./model.js";

/** A 1-based line/column position plus 0-based character offset in `.wx` source. */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/** Half-open source range spanning from the first character to the character after the node or token. */
export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

/**
 * The parsed form of one `.wx` file: the raw TypeScript prelude, the template
 * AST, collected diagnostics, and the Convex resource bindings inferred from
 * bare `$$module:function` lines. Every node carries a {@link SourceRange} so
 * downstream tooling (LSP, compiler diagnostics) can map back to source.
 */
export interface WavexFile {
  prelude: string;
  body: string;
  nodes: TemplateNode[];
  diagnostics: Diagnostic[];
  resources: ResourceBinding[];
  hasWaveSeparator: boolean;
}

/**
 * Any node in a `.wx` template body. The shapes mirror the language's
 * shorthand: native elements, `@` components, `+` directives, text,
 * `{{ … }}` expressions, and `$`/`$$` Convex references and calls.
 */
export type TemplateNode =
  | ElementNode
  | ComponentNode
  | DirectiveNode
  | TextNode
  | ExpressionNode
  | ConvexReferenceNode
  | ConvexCallNode;

/** Fields shared by every template AST node. */
export interface BaseNode {
  kind: string;
  range: SourceRange;
  children: TemplateNode[];
  raw: string;
}

/** Native HTML/custom-element template node, including parsed attributes and utility shorthands. */
export interface ElementNode extends BaseNode {
  kind: "element";
  tag: string;
  attributes: Attribute[];
  utilities: string[];
  inlineText?: string;
  inlineTextRange?: SourceRange;
}

/** Local/Web Awesome component reference written with WAVEx `@component` syntax. */
export interface ComponentNode extends BaseNode {
  kind: "component";
  reference: string;
  attributes: Attribute[];
  utilities: string[];
  inlineText?: string;
  inlineTextRange?: SourceRange;
}

/**
 * `+` directive names. Directives are WAVEx control primitives that compile
 * away or lower to runtime behavior — they are not components and do not
 * necessarily become DOM nodes.
 */
export type DirectiveName =
  | "head"
  | "if"
  | "for"
  | "boundary"
  | "suspense"
  | "loading"
  | "empty"
  | "error"
  | "pending"
  | "idle"
  | "mutation-error"
  | string;

/** `+directive` template node with its expression, attributes, and directive-specific metadata. */
export interface DirectiveNode extends BaseNode {
  kind: "directive";
  name: DirectiveName;
  expression?: string;
  expressionRange?: SourceRange;
  attributes: Attribute[];
  for?: ForDirective;
}

/** Parsed control variables for `+for item of collection` directives. */
export interface ForDirective {
  itemName: string;
  itemNameRange?: SourceRange;
  collectionExpression: string;
  collectionExpressionRange?: SourceRange;
  keyExpression?: string;
  keyExpressionRange?: SourceRange;
}

/** Literal text node emitted from `|` lines or inline text. */
export interface TextNode extends BaseNode {
  kind: "text";
  text: string;
  textRange?: SourceRange;
}

/** Interpolation node for `={{ expression }}`-style template output. */
export interface ExpressionNode extends BaseNode {
  kind: "expression";
  expression: string;
  expressionRange?: SourceRange;
}

/**
 * A `module:function` Convex address from `$`/`$$` source syntax. This is
 * WAVEx source syntax, not the runtime ABI — addresses resolve through
 * Convex's generated API (`api.tasks.list`) wherever possible rather than
 * string paths. Nested modules normalize to Convex's path form, e.g.
 * `convex/deeply/nested.ts` export `list` is `deeply/nested:list`.
 */
export interface ConvexFunctionAddress {
  modulePath: string;
  functionName: string;
  raw: string;
}

/** Inline `$module:function` Convex reference node used as an expression value. */
export interface ConvexReferenceNode extends BaseNode {
  kind: "convex-reference";
  address: ConvexFunctionAddress;
  attributes: Attribute[];
}

/** Bare `$$module:function` query binding node that becomes a runtime resource. */
export interface ConvexCallNode extends BaseNode {
  kind: "convex-call";
  address: ConvexFunctionAddress;
  attributes: Attribute[];
  bindingName: string;
}

/**
 * A live Convex query resource inferred from a bare `$$module:function` line.
 * Only public queries may appear as bare bindings — mutations and actions
 * require an explicit trigger (`:click:`, `:submit:`) so renders stay free of
 * side effects. The binding name follows `inferResourceBindingName` unless
 * overridden with `as:name`.
 */
export interface ResourceBinding {
  name: string;
  address: ConvexFunctionAddress;
  attributes: Attribute[];
  range: SourceRange;
}

/**
 * One parsed attribute token. The colon grammar is the language's backbone:
 * bare names are booleans in attribute contexts (element and component heads
 * only promote recognized bare names before inline text), unquoted
 * `name:value` is a static string unless the value is expression-shaped,
 * numeric, or a bare identifier on a boolean attribute,
 * `name:{{ expr }}` is an explicit TypeScript
 * expression, `name:` passes the in-scope value of the same name,
 * `:event:target` is a semantic WAVEx action, and `on:event:handler` is the
 * raw `addEventListener` escape hatch.
 */
export type Attribute =
  | BooleanAttribute
  | LiteralAttribute
  | ExpressionAttribute
  | SameNameAttribute
  | SemanticEventAttribute
  | RawEventAttribute;

/** Fields shared by all parsed attribute tokens, including source ranges for editor tooling. */
export interface BaseAttribute {
  kind: Attribute["kind"];
  name: string;
  raw: string;
  range?: SourceRange;
  nameRange?: SourceRange;
  valueRange?: SourceRange;
  expressionRange?: SourceRange;
}

/** Boolean attribute token such as `disabled` or `with-footer`. */
export interface BooleanAttribute extends BaseAttribute {
  kind: "boolean";
}

/** Static string attribute token parsed from quoted or literal `name:value` syntax. */
export interface LiteralAttribute extends BaseAttribute {
  kind: "literal";
  value: string;
  quoted: boolean;
}

/** Dynamic attribute token whose value is a TypeScript expression. */
export interface ExpressionAttribute extends BaseAttribute {
  kind: "expression";
  expression: string;
}

/** Shorthand `name:` attribute that passes the in-scope value with the same name. */
export interface SameNameAttribute extends BaseAttribute {
  kind: "same-name";
}

/** WAVEx semantic action attribute parsed from `:event:target` syntax. */
export interface SemanticEventAttribute extends BaseAttribute {
  kind: "semantic-event";
  event: string;
  target: string;
}

/** Raw event-listener escape hatch parsed from `on:event:handler` syntax. */
export interface RawEventAttribute extends BaseAttribute {
  kind: "raw-event";
  event: string;
  handler: string;
}
