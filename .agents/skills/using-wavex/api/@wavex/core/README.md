# @wavex/core

Parser, AST, diagnostics, and the shared project model for `.wx` files.

This package is the single source of truth for the WAVEx language. The
TypeScript parser exported here is the only `.wx` parser definition,
consumed by both the compiler and the Volar-based LSP. Cosmetic editor
grammars, such as the VS Code TextMate grammar, must stay drift-tolerant and
never become parser inputs.

`.wx` is an indentation-based template language with an optional TypeScript
prelude separated by `~~~`. The parser produces an AST with source ranges
(so LSP features can map back to `.wx` positions) plus structured
diagnostics instead of throwing. The language itself is documented in the
guides under `packages/core/docs/`.

## Interfaces

### BaseAttribute

Defined in: [packages/core/src/ast.ts:188](packages/core/src/ast.ts#L188)

Fields shared by all parsed attribute tokens, including source ranges for editor tooling.

#### Extended by

- [`BooleanAttribute`](#booleanattribute)
- [`LiteralAttribute`](#literalattribute)
- [`ExpressionAttribute`](#expressionattribute)
- [`SameNameAttribute`](#samenameattribute)
- [`SemanticEventAttribute`](#semanticeventattribute)
- [`RawEventAttribute`](#raweventattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

##### kind

```ts
kind: 
  | "boolean"
  | "expression"
  | "literal"
  | "same-name"
  | "semantic-event"
  | "raw-event";
```

Defined in: [packages/core/src/ast.ts:189](packages/core/src/ast.ts#L189)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

***

### BaseNode

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

Fields shared by every template AST node.

#### Extended by

- [`ElementNode`](#elementnode)
- [`ComponentNode`](#componentnode)
- [`DirectiveNode`](#directivenode)
- [`TextNode`](#textnode)
- [`ExpressionNode`](#expressionnode)
- [`ConvexReferenceNode`](#convexreferencenode)
- [`ConvexCallNode`](#convexcallnode)

#### Properties

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

##### kind

```ts
kind: string;
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

***

### BooleanAttribute

Defined in: [packages/core/src/ast.ts:199](packages/core/src/ast.ts#L199)

Boolean attribute token such as `disabled` or `with-footer`.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "boolean";
```

Defined in: [packages/core/src/ast.ts:200](packages/core/src/ast.ts#L200)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ComponentNode

Defined in: [packages/core/src/ast.ts:64](packages/core/src/ast.ts#L64)

Local/Web Awesome component reference written with WAVEx `@component` syntax.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:67](packages/core/src/ast.ts#L67)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### inlineText?

```ts
optional inlineText?: string;
```

Defined in: [packages/core/src/ast.ts:69](packages/core/src/ast.ts#L69)

##### inlineTextRange?

```ts
optional inlineTextRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:70](packages/core/src/ast.ts#L70)

##### kind

```ts
kind: "component";
```

Defined in: [packages/core/src/ast.ts:65](packages/core/src/ast.ts#L65)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### reference

```ts
reference: string;
```

Defined in: [packages/core/src/ast.ts:66](packages/core/src/ast.ts#L66)

##### utilities

```ts
utilities: string[];
```

Defined in: [packages/core/src/ast.ts:68](packages/core/src/ast.ts#L68)

***

### ComponentResolutionOptions

Defined in: [packages/core/src/model.ts:47](packages/core/src/model.ts#L47)

Known component names used by [componentReferenceToTag](#componentreferencetotag) to resolve
`@name` references. When omitted, a built-in set of common Web Awesome
component names is used; real projects should pass names detected by
`@wavex/core/capabilities`.

#### Properties

##### localComponents?

```ts
optional localComponents?: ReadonlySet<string> | readonly string[];
```

Defined in: [packages/core/src/model.ts:48](packages/core/src/model.ts#L48)

##### webAwesomeComponents?

```ts
optional webAwesomeComponents?: ReadonlySet<string> | readonly string[];
```

Defined in: [packages/core/src/model.ts:49](packages/core/src/model.ts#L49)

***

### ConvexCallNode

Defined in: [packages/core/src/ast.ts:147](packages/core/src/ast.ts#L147)

Bare `$$module:function` query binding node that becomes a runtime resource.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### address

```ts
address: ConvexFunctionAddress;
```

Defined in: [packages/core/src/ast.ts:149](packages/core/src/ast.ts#L149)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:150](packages/core/src/ast.ts#L150)

##### bindingName

```ts
bindingName: string;
```

Defined in: [packages/core/src/ast.ts:151](packages/core/src/ast.ts#L151)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "convex-call";
```

Defined in: [packages/core/src/ast.ts:148](packages/core/src/ast.ts#L148)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ConvexFunctionAddress

Defined in: [packages/core/src/ast.ts:133](packages/core/src/ast.ts#L133)

A `module:function` Convex address from `$`/`$$` source syntax. This is
WAVEx source syntax, not the runtime ABI — addresses resolve through
Convex's generated API (`api.tasks.list`) wherever possible rather than
string paths. Nested modules normalize to Convex's path form, e.g.
`convex/deeply/nested.ts` export `list` is `deeply/nested:list`.

#### Properties

##### functionName

```ts
functionName: string;
```

Defined in: [packages/core/src/ast.ts:135](packages/core/src/ast.ts#L135)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/core/src/ast.ts:134](packages/core/src/ast.ts#L134)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:136](packages/core/src/ast.ts#L136)

***

### ConvexReferenceNode

Defined in: [packages/core/src/ast.ts:140](packages/core/src/ast.ts#L140)

Inline `$module:function` Convex reference node used as an expression value.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### address

```ts
address: ConvexFunctionAddress;
```

Defined in: [packages/core/src/ast.ts:142](packages/core/src/ast.ts#L142)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:143](packages/core/src/ast.ts#L143)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "convex-reference";
```

Defined in: [packages/core/src/ast.ts:141](packages/core/src/ast.ts#L141)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### Diagnostic

Defined in: [packages/core/src/model.ts:33](packages/core/src/model.ts#L33)

A structured problem report with a 1-based source position. The parser and
compiler collect diagnostics instead of throwing, so tooling (CLI, LSP,
Vite plugin) can surface every problem in a file at once.

#### Properties

##### code

```ts
code: string;
```

Defined in: [packages/core/src/model.ts:34](packages/core/src/model.ts#L34)

##### column

```ts
column: number;
```

Defined in: [packages/core/src/model.ts:38](packages/core/src/model.ts#L38)

##### line

```ts
line: number;
```

Defined in: [packages/core/src/model.ts:37](packages/core/src/model.ts#L37)

##### message

```ts
message: string;
```

Defined in: [packages/core/src/model.ts:35](packages/core/src/model.ts#L35)

##### severity

```ts
severity: "error" | "warning" | "info";
```

Defined in: [packages/core/src/model.ts:36](packages/core/src/model.ts#L36)

***

### DirectiveNode

Defined in: [packages/core/src/ast.ts:93](packages/core/src/ast.ts#L93)

`+directive` template node with its expression, attributes, and directive-specific metadata.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:98](packages/core/src/ast.ts#L98)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### expression?

```ts
optional expression?: string;
```

Defined in: [packages/core/src/ast.ts:96](packages/core/src/ast.ts#L96)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:97](packages/core/src/ast.ts#L97)

##### for?

```ts
optional for?: ForDirective;
```

Defined in: [packages/core/src/ast.ts:99](packages/core/src/ast.ts#L99)

##### kind

```ts
kind: "directive";
```

Defined in: [packages/core/src/ast.ts:94](packages/core/src/ast.ts#L94)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:95](packages/core/src/ast.ts#L95)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ElementNode

Defined in: [packages/core/src/ast.ts:54](packages/core/src/ast.ts#L54)

Native HTML/custom-element template node, including parsed attributes and utility shorthands.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:57](packages/core/src/ast.ts#L57)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### inlineText?

```ts
optional inlineText?: string;
```

Defined in: [packages/core/src/ast.ts:59](packages/core/src/ast.ts#L59)

##### inlineTextRange?

```ts
optional inlineTextRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:60](packages/core/src/ast.ts#L60)

##### kind

```ts
kind: "element";
```

Defined in: [packages/core/src/ast.ts:55](packages/core/src/ast.ts#L55)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### tag

```ts
tag: string;
```

Defined in: [packages/core/src/ast.ts:56](packages/core/src/ast.ts#L56)

##### utilities

```ts
utilities: string[];
```

Defined in: [packages/core/src/ast.ts:58](packages/core/src/ast.ts#L58)

***

### ExpressionAttribute

Defined in: [packages/core/src/ast.ts:211](packages/core/src/ast.ts#L211)

Dynamic attribute token whose value is a TypeScript expression.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expression

```ts
expression: string;
```

Defined in: [packages/core/src/ast.ts:213](packages/core/src/ast.ts#L213)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "expression";
```

Defined in: [packages/core/src/ast.ts:212](packages/core/src/ast.ts#L212)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ExpressionNode

Defined in: [packages/core/src/ast.ts:120](packages/core/src/ast.ts#L120)

Interpolation node for `={{ expression }}`-style template output.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### expression

```ts
expression: string;
```

Defined in: [packages/core/src/ast.ts:122](packages/core/src/ast.ts#L122)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:123](packages/core/src/ast.ts#L123)

##### kind

```ts
kind: "expression";
```

Defined in: [packages/core/src/ast.ts:121](packages/core/src/ast.ts#L121)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ForDirective

Defined in: [packages/core/src/ast.ts:103](packages/core/src/ast.ts#L103)

Parsed control variables for `+for item of collection` directives.

#### Properties

##### collectionExpression

```ts
collectionExpression: string;
```

Defined in: [packages/core/src/ast.ts:106](packages/core/src/ast.ts#L106)

##### collectionExpressionRange?

```ts
optional collectionExpressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:107](packages/core/src/ast.ts#L107)

##### itemName

```ts
itemName: string;
```

Defined in: [packages/core/src/ast.ts:104](packages/core/src/ast.ts#L104)

##### itemNameRange?

```ts
optional itemNameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:105](packages/core/src/ast.ts#L105)

##### keyExpression?

```ts
optional keyExpression?: string;
```

Defined in: [packages/core/src/ast.ts:108](packages/core/src/ast.ts#L108)

##### keyExpressionRange?

```ts
optional keyExpressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:109](packages/core/src/ast.ts#L109)

***

### LiteralAttribute

Defined in: [packages/core/src/ast.ts:204](packages/core/src/ast.ts#L204)

Static string attribute token parsed from quoted or literal `name:value` syntax.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "literal";
```

Defined in: [packages/core/src/ast.ts:205](packages/core/src/ast.ts#L205)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### quoted

```ts
quoted: boolean;
```

Defined in: [packages/core/src/ast.ts:207](packages/core/src/ast.ts#L207)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### value

```ts
value: string;
```

Defined in: [packages/core/src/ast.ts:206](packages/core/src/ast.ts#L206)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ParseWavexOptions

Defined in: [packages/core/src/parser.ts:19](packages/core/src/parser.ts#L19)

Options for [parseWavex](#parsewavex).

#### Properties

##### fileName?

```ts
optional fileName?: string;
```

Defined in: [packages/core/src/parser.ts:20](packages/core/src/parser.ts#L20)

***

### RawEventAttribute

Defined in: [packages/core/src/ast.ts:229](packages/core/src/ast.ts#L229)

Raw event-listener escape hatch parsed from `on:event:handler` syntax.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### event

```ts
event: string;
```

Defined in: [packages/core/src/ast.ts:231](packages/core/src/ast.ts#L231)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### handler

```ts
handler: string;
```

Defined in: [packages/core/src/ast.ts:232](packages/core/src/ast.ts#L232)

##### kind

```ts
kind: "raw-event";
```

Defined in: [packages/core/src/ast.ts:230](packages/core/src/ast.ts#L230)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ResourceBinding

Defined in: [packages/core/src/ast.ts:161](packages/core/src/ast.ts#L161)

A live Convex query resource inferred from a bare `$$module:function` line.
Only public queries may appear as bare bindings — mutations and actions
require an explicit trigger (`:click:`, `:submit:`) so renders stay free of
side effects. The binding name follows `inferResourceBindingName` unless
overridden with `as:name`.

#### Properties

##### address

```ts
address: ConvexFunctionAddress;
```

Defined in: [packages/core/src/ast.ts:163](packages/core/src/ast.ts#L163)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:164](packages/core/src/ast.ts#L164)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:162](packages/core/src/ast.ts#L162)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:165](packages/core/src/ast.ts#L165)

***

### RouteDefinition

Defined in: [packages/core/src/model.ts:15](packages/core/src/model.ts#L15)

A file-derived route: `src/pages/tasks/[id].wx` → `/tasks/:id`.

#### Extended by

- [`ClientRoute`](../runtime/README.md#clientroute)

#### Properties

##### file

```ts
file: string;
```

Defined in: [packages/core/src/model.ts:17](packages/core/src/model.ts#L17)

##### id

```ts
id: string;
```

Defined in: [packages/core/src/model.ts:16](packages/core/src/model.ts#L16)

##### path

```ts
path: string;
```

Defined in: [packages/core/src/model.ts:18](packages/core/src/model.ts#L18)

##### segments

```ts
segments: RouteSegment[];
```

Defined in: [packages/core/src/model.ts:19](packages/core/src/model.ts#L19)

***

### RouteMatch

Defined in: [packages/core/src/model.ts:158](packages/core/src/model.ts#L158)

Successful route match result, including the matched route definition and decoded params.

#### Properties

##### params

```ts
params: Record<string, string>;
```

Defined in: [packages/core/src/model.ts:160](packages/core/src/model.ts#L160)

##### route

```ts
route: RouteDefinition;
```

Defined in: [packages/core/src/model.ts:159](packages/core/src/model.ts#L159)

***

### SameNameAttribute

Defined in: [packages/core/src/ast.ts:217](packages/core/src/ast.ts#L217)

Shorthand `name:` attribute that passes the in-scope value with the same name.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "same-name";
```

Defined in: [packages/core/src/ast.ts:218](packages/core/src/ast.ts#L218)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### SemanticEventAttribute

Defined in: [packages/core/src/ast.ts:222](packages/core/src/ast.ts#L222)

WAVEx semantic action attribute parsed from `:event:target` syntax.

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### event

```ts
event: string;
```

Defined in: [packages/core/src/ast.ts:224](packages/core/src/ast.ts#L224)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:195](packages/core/src/ast.ts#L195)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "semantic-event";
```

Defined in: [packages/core/src/ast.ts:223](packages/core/src/ast.ts#L223)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:190](packages/core/src/ast.ts#L190)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### target

```ts
target: string;
```

Defined in: [packages/core/src/ast.ts:225](packages/core/src/ast.ts#L225)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### SourceLocation

Defined in: [packages/core/src/ast.ts:4](packages/core/src/ast.ts#L4)

A 1-based line/column position plus 0-based character offset in `.wx` source.

#### Properties

##### column

```ts
column: number;
```

Defined in: [packages/core/src/ast.ts:6](packages/core/src/ast.ts#L6)

##### line

```ts
line: number;
```

Defined in: [packages/core/src/ast.ts:5](packages/core/src/ast.ts#L5)

##### offset

```ts
offset: number;
```

Defined in: [packages/core/src/ast.ts:7](packages/core/src/ast.ts#L7)

***

### SourceRange

Defined in: [packages/core/src/ast.ts:11](packages/core/src/ast.ts#L11)

Half-open source range spanning from the first character to the character after the node or token.

#### Properties

##### end

```ts
end: SourceLocation;
```

Defined in: [packages/core/src/ast.ts:13](packages/core/src/ast.ts#L13)

##### start

```ts
start: SourceLocation;
```

Defined in: [packages/core/src/ast.ts:12](packages/core/src/ast.ts#L12)

***

### TextNode

Defined in: [packages/core/src/ast.ts:113](packages/core/src/ast.ts#L113)

Literal text node emitted from `|` lines or inline text.

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:49](packages/core/src/ast.ts#L49)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "text";
```

Defined in: [packages/core/src/ast.ts:114](packages/core/src/ast.ts#L114)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:50](packages/core/src/ast.ts#L50)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### text

```ts
text: string;
```

Defined in: [packages/core/src/ast.ts:115](packages/core/src/ast.ts#L115)

##### textRange?

```ts
optional textRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:116](packages/core/src/ast.ts#L116)

***

### WavexConfig

Defined in: [packages/core/src/model.ts:6](packages/core/src/model.ts#L6)

Fixed directory layout of a WAVEx app. The structure is framework law, not
configuration: routes live in `src/pages`, reusable template components in
`src/components`, Convex functions in `convex`, static assets in `public`.

#### Properties

##### apiDir

```ts
apiDir: string;
```

Defined in: [packages/core/src/model.ts:10](packages/core/src/model.ts#L10)

##### componentsDir

```ts
componentsDir: string;
```

Defined in: [packages/core/src/model.ts:9](packages/core/src/model.ts#L9)

##### pagesDir

```ts
pagesDir: string;
```

Defined in: [packages/core/src/model.ts:8](packages/core/src/model.ts#L8)

##### publicDir

```ts
publicDir: string;
```

Defined in: [packages/core/src/model.ts:11](packages/core/src/model.ts#L11)

##### sourceDir

```ts
sourceDir: string;
```

Defined in: [packages/core/src/model.ts:7](packages/core/src/model.ts#L7)

***

### WavexFile

Defined in: [packages/core/src/ast.ts:22](packages/core/src/ast.ts#L22)

The parsed form of one `.wx` file: the raw TypeScript prelude, the template
AST, collected diagnostics, and the Convex resource bindings inferred from
bare `$$module:function` lines. Every node carries a [SourceRange](#sourcerange) so
downstream tooling (LSP, compiler diagnostics) can map back to source.

#### Properties

##### body

```ts
body: string;
```

Defined in: [packages/core/src/ast.ts:24](packages/core/src/ast.ts#L24)

##### diagnostics

```ts
diagnostics: Diagnostic[];
```

Defined in: [packages/core/src/ast.ts:26](packages/core/src/ast.ts#L26)

##### hasWaveSeparator

```ts
hasWaveSeparator: boolean;
```

Defined in: [packages/core/src/ast.ts:28](packages/core/src/ast.ts#L28)

##### nodes

```ts
nodes: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:25](packages/core/src/ast.ts#L25)

##### prelude

```ts
prelude: string;
```

Defined in: [packages/core/src/ast.ts:23](packages/core/src/ast.ts#L23)

##### resources

```ts
resources: ResourceBinding[];
```

Defined in: [packages/core/src/ast.ts:27](packages/core/src/ast.ts#L27)

## Type Aliases

### Attribute

```ts
type Attribute = 
  | BooleanAttribute
  | LiteralAttribute
  | ExpressionAttribute
  | SameNameAttribute
  | SemanticEventAttribute
  | RawEventAttribute;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

One parsed attribute token. The colon grammar is the language's backbone:
bare names are booleans in attribute contexts (element and component heads
only promote recognized bare names before inline text), unquoted
`name:value` is a static string unless the value is expression-shaped,
numeric, or a bare identifier on a boolean attribute,
`name:{{ expr }}` is an explicit TypeScript
expression, `name:` passes the in-scope value of the same name,
`:event:target` is a semantic WAVEx action, and `on:event:handler` is the
raw `addEventListener` escape hatch.

***

### DirectiveName

```ts
type DirectiveName = 
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
```

Defined in: [packages/core/src/ast.ts:78](packages/core/src/ast.ts#L78)

`+` directive names. Directives are WAVEx control primitives that compile
away or lower to runtime behavior — they are not components and do not
necessarily become DOM nodes.

***

### RouteSegment

```ts
type RouteSegment = 
  | {
  kind: "static";
  value: string;
}
  | {
  kind: "param";
  name: string;
}
  | {
  kind: "splat";
  name: string;
};
```

Defined in: [packages/core/src/model.ts:23](packages/core/src/model.ts#L23)

One path segment: static text, a `[param]`, or a `[...splat]` catch-all.

***

### TemplateNode

```ts
type TemplateNode = 
  | ElementNode
  | ComponentNode
  | DirectiveNode
  | TextNode
  | ExpressionNode
  | ConvexReferenceNode
  | ConvexCallNode;
```

Defined in: [packages/core/src/ast.ts:36](packages/core/src/ast.ts#L36)

Any node in a `.wx` template body. The shapes mirror the language's
shorthand: native elements, `@` components, `+` directives, text,
`{{ … }}` expressions, and `$`/`$$` Convex references and calls.

## Functions

### componentReferenceToTag()

```ts
function componentReferenceToTag(reference, options?): string;
```

Defined in: [packages/core/src/model.ts:328](packages/core/src/model.ts#L328)

Resolve an `@name` component reference to a custom-element tag.

Lookup order: local `src/components/` templates first, then Web Awesome —
local components intentionally shadow Web Awesome components without
warning, so an app can define its own `card.wx` that wraps `<wa-card>`.
Explicit prefixes bypass the lookup: `@wa/card` always means `<wa-card>`,
`@components/card` always means the local component.

#### Parameters

##### reference

`string`

##### options?

[`ComponentResolutionOptions`](#componentresolutionoptions) = `{}`

#### Returns

`string`

***

### createDefaultConfig()

```ts
function createDefaultConfig(): WavexConfig;
```

Defined in: [packages/core/src/model.ts:80](packages/core/src/model.ts#L80)

The standard WAVEx app layout (see [WavexConfig](#wavexconfig)).

#### Returns

[`WavexConfig`](#wavexconfig)

***

### createRouteDefinition()

```ts
function createRouteDefinition(file, pagesDir?): RouteDefinition | undefined;
```

Defined in: [packages/core/src/model.ts:146](packages/core/src/model.ts#L146)

Build a full [RouteDefinition](#routedefinition) from a page file path, or undefined if the file is not routable.

#### Parameters

##### file

`string`

##### pagesDir?

`string` = `"src/pages"`

#### Returns

[`RouteDefinition`](#routedefinition) \| `undefined`

***

### expandUtilityClassList()

```ts
function expandUtilityClassList(tokens): string[];
```

Defined in: [packages/core/src/model.ts:297](packages/core/src/model.ts#L297)

Expand `[utility]` tokens into concrete `wa-*` class names, dropping empty tokens.

#### Parameters

##### tokens

readonly `string`[]

#### Returns

`string`[]

***

### expandUtilityToken()

```ts
function expandUtilityToken(token): string;
```

Defined in: [packages/core/src/model.ts:290](packages/core/src/model.ts#L290)

Expand one `[utility]` token to its class name. This is plain `wa-` prefix
expansion by design — there is no semantic mapping table or `name:value`
utility grammar, so `[stack gap-xl]` is exactly `wa-stack wa-gap-xl`.

#### Parameters

##### token

`string`

#### Returns

`string`

***

### extractAttrsTypeKeys()

```ts
function extractAttrsTypeKeys(prelude): string[] | undefined;
```

Defined in: [packages/core/src/model.ts:358](packages/core/src/model.ts#L358)

Top-level keys of a component's `type Attrs = { ... }` (or `interface Attrs`)
prelude declaration. Components declaring Attrs get each attribute as a bare,
typed local in their template. Returns undefined when no Attrs is declared.

#### Parameters

##### prelude

`string`

#### Returns

`string`[] \| `undefined`

***

### formatDiagnostic()

```ts
function formatDiagnostic(diagnostic): string;
```

Defined in: [packages/core/src/model.ts:345](packages/core/src/model.ts#L345)

Render a diagnostic as a single `SEVERITY code line:column message` line for CLI/log output.

#### Parameters

##### diagnostic

[`Diagnostic`](#diagnostic)

#### Returns

`string`

***

### inferResourceBindingName()

```ts
function inferResourceBindingName(modulePath, functionName): string;
```

Defined in: [packages/core/src/model.ts:257](packages/core/src/model.ts#L257)

Infer the template binding name for a `$$module:function` Convex resource.
The rules are intentionally simple: the last module path segment is the
base name; collection-style functions (`list`, `all`, `search`, …) bind
plural, singleton-style functions (`get`, `byId`, `me`, …) bind singular.
`as:name` in the template overrides the inference on collisions.

#### Parameters

##### modulePath

`string`

##### functionName

`string`

#### Returns

`string`

***

### lastPathSegment()

```ts
function lastPathSegment(path): string;
```

Defined in: [packages/core/src/model.ts:264](packages/core/src/model.ts#L264)

Return the final non-empty slash-delimited segment from a module or file path.

#### Parameters

##### path

`string`

#### Returns

`string`

***

### matchRoutePath()

```ts
function matchRoutePath(routes, pathname): RouteMatch | undefined;
```

Defined in: [packages/core/src/model.ts:169](packages/core/src/model.ts#L169)

Match a pathname against route definitions using the same segment
semantics as createRouteDefinition. Static segments win over params,
params win over splats, and exact matches win over empty splats; among
equals the more specific (longer static prefix) route wins.

#### Parameters

##### routes

readonly [`RouteDefinition`](#routedefinition)[]

##### pathname

`string`

#### Returns

[`RouteMatch`](#routematch) \| `undefined`

***

### mergeClassNames()

```ts
function mergeClassNames(...values): string;
```

Defined in: [packages/core/src/model.ts:302](packages/core/src/model.ts#L302)

Join whitespace-separated class name fragments while ignoring falsey values.

#### Parameters

##### values

...(`string` \| `false` \| `null` \| `undefined`)[]

#### Returns

`string`

***

### normalizeSlashes()

```ts
function normalizeSlashes(path): string;
```

Defined in: [packages/core/src/model.ts:91](packages/core/src/model.ts#L91)

Normalize Windows path separators to the POSIX-style slash form used by route and component IDs.

#### Parameters

##### path

`string`

#### Returns

`string`

***

### parseAttributeToken()

```ts
function parseAttributeToken(token, range?): Attribute | undefined;
```

Defined in: [packages/core/src/parser.ts:665](packages/core/src/parser.ts#L665)

Parse one attribute token into its [Attribute](#attribute) form: boolean
(`required`), literal (`variant:brand`), expression-shaped value
(`checked:task.done`, `checked:isDone`, `count:42`, or `checked:{{ task.done }}`), same-name shorthand
(`task:`), semantic event (`:click:save`), or raw DOM event
(`on:wa-show:opened`).

#### Parameters

##### token

`string`

##### range?

[`SourceRange`](#sourcerange)

#### Returns

[`Attribute`](#attribute) \| `undefined`

***

### parseQueryString()

```ts
function parseQueryString(search): Record<string, string>;
```

Defined in: [packages/core/src/model.ts:234](packages/core/src/model.ts#L234)

Parse a search string into a flat record; the first occurrence of a repeated key wins.

#### Parameters

##### search

`string`

#### Returns

`Record`\<`string`, `string`\>

***

### parseWavex()

```ts
function parseWavex(source, _options?): WavexFile;
```

Defined in: [packages/core/src/parser.ts:111](packages/core/src/parser.ts#L111)

Parse a complete `.wx` source file into a [WavexFile](#wavexfile).

The TypeScript prelude (everything before the `~~~` wave separator) is kept
as raw text for TypeScript tooling; the indentation-based template body is
parsed into [TemplateNode](#templatenode) trees with source ranges. Parse problems
are collected as diagnostics on the result rather than thrown, so a file
with errors still yields a best-effort AST for the LSP and compiler.

#### Parameters

##### source

`string`

##### \_options?

[`ParseWavexOptions`](#parsewavexoptions) = `{}`

#### Returns

[`WavexFile`](#wavexfile)

***

### pluralize()

```ts
function pluralize(name): string;
```

Defined in: [packages/core/src/model.ts:279](packages/core/src/model.ts#L279)

Lightweight English pluralization used for inferred Convex resource binding names.

#### Parameters

##### name

`string`

#### Returns

`string`

***

### routeIdFromFile()

```ts
function routeIdFromFile(file): string;
```

Defined in: [packages/core/src/model.ts:138](packages/core/src/model.ts#L138)

Convert a page file path into the stable dotted route id used by generated modules.

#### Parameters

##### file

`string`

#### Returns

`string`

***

### routePathFromPageFile()

```ts
function routePathFromPageFile(file, pagesDir?): string | undefined;
```

Defined in: [packages/core/src/model.ts:100](packages/core/src/model.ts#L100)

Derive a route path from a page file path, or undefined for non-routable
files (`+layout.wx`, `+error.wx`, non-`.wx` files). `index.wx` maps to the
directory path, `[id]` to `:id`, and `[...slug]` to `*slug`.

#### Parameters

##### file

`string`

##### pagesDir?

`string` = `"src/pages"`

#### Returns

`string` \| `undefined`

***

### routeSegmentsFromPath()

```ts
function routeSegmentsFromPath(path): RouteSegment[];
```

Defined in: [packages/core/src/model.ts:126](packages/core/src/model.ts#L126)

Convert a route path (`/tasks/:id`) into matchable route segment records.

#### Parameters

##### path

`string`

#### Returns

[`RouteSegment`](#routesegment)[]

***

### singularize()

```ts
function singularize(name): string;
```

Defined in: [packages/core/src/model.ts:269](packages/core/src/model.ts#L269)

Lightweight English singularization used for inferred Convex resource binding names.

#### Parameters

##### name

`string`

#### Returns

`string`

***

### toKebabCase()

```ts
function toKebabCase(value): string;
```

Defined in: [packages/core/src/model.ts:310](packages/core/src/model.ts#L310)

Convert component and property identifiers to kebab-case custom-element names.

#### Parameters

##### value

`string`

#### Returns

`string`
