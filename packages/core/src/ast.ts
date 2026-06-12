import type { Diagnostic } from "./model.js";

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface WavexFile {
  prelude: string;
  body: string;
  nodes: TemplateNode[];
  diagnostics: Diagnostic[];
  resources: ResourceBinding[];
  hasWaveSeparator: boolean;
}

export type TemplateNode =
  | ElementNode
  | ComponentNode
  | DirectiveNode
  | TextNode
  | ExpressionNode
  | ConvexReferenceNode
  | ConvexCallNode;

export interface BaseNode {
  kind: string;
  range: SourceRange;
  children: TemplateNode[];
  raw: string;
}

export interface ElementNode extends BaseNode {
  kind: "element";
  tag: string;
  attributes: Attribute[];
  utilities: string[];
  inlineText?: string;
}

export interface ComponentNode extends BaseNode {
  kind: "component";
  reference: string;
  attributes: Attribute[];
  utilities: string[];
  inlineText?: string;
}

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

export interface DirectiveNode extends BaseNode {
  kind: "directive";
  name: DirectiveName;
  expression?: string;
  attributes: Attribute[];
  for?: ForDirective;
}

export interface ForDirective {
  itemName: string;
  collectionExpression: string;
  keyExpression?: string;
}

export interface TextNode extends BaseNode {
  kind: "text";
  text: string;
}

export interface ExpressionNode extends BaseNode {
  kind: "expression";
  expression: string;
}

export interface ConvexFunctionAddress {
  modulePath: string;
  functionName: string;
  raw: string;
}

export interface ConvexReferenceNode extends BaseNode {
  kind: "convex-reference";
  address: ConvexFunctionAddress;
  attributes: Attribute[];
}

export interface ConvexCallNode extends BaseNode {
  kind: "convex-call";
  address: ConvexFunctionAddress;
  attributes: Attribute[];
  bindingName: string;
}

export interface ResourceBinding {
  name: string;
  address: ConvexFunctionAddress;
  attributes: Attribute[];
  range: SourceRange;
}

export type Attribute =
  | BooleanAttribute
  | LiteralAttribute
  | ExpressionAttribute
  | SameNameAttribute
  | SemanticEventAttribute
  | RawEventAttribute;

export interface BaseAttribute {
  kind: Attribute["kind"];
  name: string;
  raw: string;
}

export interface BooleanAttribute extends BaseAttribute {
  kind: "boolean";
}

export interface LiteralAttribute extends BaseAttribute {
  kind: "literal";
  value: string;
  quoted: boolean;
}

export interface ExpressionAttribute extends BaseAttribute {
  kind: "expression";
  expression: string;
}

export interface SameNameAttribute extends BaseAttribute {
  kind: "same-name";
}

export interface SemanticEventAttribute extends BaseAttribute {
  kind: "semantic-event";
  event: string;
  target: string;
}

export interface RawEventAttribute extends BaseAttribute {
  kind: "raw-event";
  event: string;
  handler: string;
}
