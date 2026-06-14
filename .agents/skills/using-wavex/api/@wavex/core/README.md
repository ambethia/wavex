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

Defined in: [packages/core/src/ast.ts:177](packages/core/src/ast.ts#L177)

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

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

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

Defined in: [packages/core/src/ast.ts:178](packages/core/src/ast.ts#L178)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

***

### BaseNode

Defined in: [packages/core/src/ast.ts:44](packages/core/src/ast.ts#L44)

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

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

##### kind

```ts
kind: string;
```

Defined in: [packages/core/src/ast.ts:45](packages/core/src/ast.ts#L45)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

***

### BooleanAttribute

Defined in: [packages/core/src/ast.ts:187](packages/core/src/ast.ts#L187)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "boolean";
```

Defined in: [packages/core/src/ast.ts:188](packages/core/src/ast.ts#L188)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ComponentNode

Defined in: [packages/core/src/ast.ts:60](packages/core/src/ast.ts#L60)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:63](packages/core/src/ast.ts#L63)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### inlineText?

```ts
optional inlineText?: string;
```

Defined in: [packages/core/src/ast.ts:65](packages/core/src/ast.ts#L65)

##### inlineTextRange?

```ts
optional inlineTextRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:66](packages/core/src/ast.ts#L66)

##### kind

```ts
kind: "component";
```

Defined in: [packages/core/src/ast.ts:61](packages/core/src/ast.ts#L61)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### reference

```ts
reference: string;
```

Defined in: [packages/core/src/ast.ts:62](packages/core/src/ast.ts#L62)

##### utilities

```ts
utilities: string[];
```

Defined in: [packages/core/src/ast.ts:64](packages/core/src/ast.ts#L64)

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

Defined in: [packages/core/src/ast.ts:137](packages/core/src/ast.ts#L137)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### address

```ts
address: ConvexFunctionAddress;
```

Defined in: [packages/core/src/ast.ts:139](packages/core/src/ast.ts#L139)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:140](packages/core/src/ast.ts#L140)

##### bindingName

```ts
bindingName: string;
```

Defined in: [packages/core/src/ast.ts:141](packages/core/src/ast.ts#L141)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "convex-call";
```

Defined in: [packages/core/src/ast.ts:138](packages/core/src/ast.ts#L138)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ConvexFunctionAddress

Defined in: [packages/core/src/ast.ts:125](packages/core/src/ast.ts#L125)

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

Defined in: [packages/core/src/ast.ts:127](packages/core/src/ast.ts#L127)

##### modulePath

```ts
modulePath: string;
```

Defined in: [packages/core/src/ast.ts:126](packages/core/src/ast.ts#L126)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:128](packages/core/src/ast.ts#L128)

***

### ConvexReferenceNode

Defined in: [packages/core/src/ast.ts:131](packages/core/src/ast.ts#L131)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### address

```ts
address: ConvexFunctionAddress;
```

Defined in: [packages/core/src/ast.ts:133](packages/core/src/ast.ts#L133)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:134](packages/core/src/ast.ts#L134)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "convex-reference";
```

Defined in: [packages/core/src/ast.ts:132](packages/core/src/ast.ts#L132)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

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

Defined in: [packages/core/src/ast.ts:88](packages/core/src/ast.ts#L88)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:93](packages/core/src/ast.ts#L93)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### expression?

```ts
optional expression?: string;
```

Defined in: [packages/core/src/ast.ts:91](packages/core/src/ast.ts#L91)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:92](packages/core/src/ast.ts#L92)

##### for?

```ts
optional for?: ForDirective;
```

Defined in: [packages/core/src/ast.ts:94](packages/core/src/ast.ts#L94)

##### kind

```ts
kind: "directive";
```

Defined in: [packages/core/src/ast.ts:89](packages/core/src/ast.ts#L89)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:90](packages/core/src/ast.ts#L90)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ElementNode

Defined in: [packages/core/src/ast.ts:51](packages/core/src/ast.ts#L51)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:54](packages/core/src/ast.ts#L54)

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### inlineText?

```ts
optional inlineText?: string;
```

Defined in: [packages/core/src/ast.ts:56](packages/core/src/ast.ts#L56)

##### inlineTextRange?

```ts
optional inlineTextRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:57](packages/core/src/ast.ts#L57)

##### kind

```ts
kind: "element";
```

Defined in: [packages/core/src/ast.ts:52](packages/core/src/ast.ts#L52)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### tag

```ts
tag: string;
```

Defined in: [packages/core/src/ast.ts:53](packages/core/src/ast.ts#L53)

##### utilities

```ts
utilities: string[];
```

Defined in: [packages/core/src/ast.ts:55](packages/core/src/ast.ts#L55)

***

### ExpressionAttribute

Defined in: [packages/core/src/ast.ts:197](packages/core/src/ast.ts#L197)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expression

```ts
expression: string;
```

Defined in: [packages/core/src/ast.ts:199](packages/core/src/ast.ts#L199)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "expression";
```

Defined in: [packages/core/src/ast.ts:198](packages/core/src/ast.ts#L198)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ExpressionNode

Defined in: [packages/core/src/ast.ts:112](packages/core/src/ast.ts#L112)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### expression

```ts
expression: string;
```

Defined in: [packages/core/src/ast.ts:114](packages/core/src/ast.ts#L114)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:115](packages/core/src/ast.ts#L115)

##### kind

```ts
kind: "expression";
```

Defined in: [packages/core/src/ast.ts:113](packages/core/src/ast.ts#L113)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

***

### ForDirective

Defined in: [packages/core/src/ast.ts:97](packages/core/src/ast.ts#L97)

#### Properties

##### collectionExpression

```ts
collectionExpression: string;
```

Defined in: [packages/core/src/ast.ts:100](packages/core/src/ast.ts#L100)

##### collectionExpressionRange?

```ts
optional collectionExpressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:101](packages/core/src/ast.ts#L101)

##### itemName

```ts
itemName: string;
```

Defined in: [packages/core/src/ast.ts:98](packages/core/src/ast.ts#L98)

##### itemNameRange?

```ts
optional itemNameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:99](packages/core/src/ast.ts#L99)

##### keyExpression?

```ts
optional keyExpression?: string;
```

Defined in: [packages/core/src/ast.ts:102](packages/core/src/ast.ts#L102)

##### keyExpressionRange?

```ts
optional keyExpressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:103](packages/core/src/ast.ts#L103)

***

### LiteralAttribute

Defined in: [packages/core/src/ast.ts:191](packages/core/src/ast.ts#L191)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "literal";
```

Defined in: [packages/core/src/ast.ts:192](packages/core/src/ast.ts#L192)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### quoted

```ts
quoted: boolean;
```

Defined in: [packages/core/src/ast.ts:194](packages/core/src/ast.ts#L194)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### value

```ts
value: string;
```

Defined in: [packages/core/src/ast.ts:193](packages/core/src/ast.ts#L193)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

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

Defined in: [packages/core/src/ast.ts:212](packages/core/src/ast.ts#L212)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### event

```ts
event: string;
```

Defined in: [packages/core/src/ast.ts:214](packages/core/src/ast.ts#L214)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### handler

```ts
handler: string;
```

Defined in: [packages/core/src/ast.ts:215](packages/core/src/ast.ts#L215)

##### kind

```ts
kind: "raw-event";
```

Defined in: [packages/core/src/ast.ts:213](packages/core/src/ast.ts#L213)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### ResourceBinding

Defined in: [packages/core/src/ast.ts:151](packages/core/src/ast.ts#L151)

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

Defined in: [packages/core/src/ast.ts:153](packages/core/src/ast.ts#L153)

##### attributes

```ts
attributes: Attribute[];
```

Defined in: [packages/core/src/ast.ts:154](packages/core/src/ast.ts#L154)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:152](packages/core/src/ast.ts#L152)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:155](packages/core/src/ast.ts#L155)

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

Defined in: [packages/core/src/model.ts:154](packages/core/src/model.ts#L154)

#### Properties

##### params

```ts
params: Record<string, string>;
```

Defined in: [packages/core/src/model.ts:156](packages/core/src/model.ts#L156)

##### route

```ts
route: RouteDefinition;
```

Defined in: [packages/core/src/model.ts:155](packages/core/src/model.ts#L155)

***

### SameNameAttribute

Defined in: [packages/core/src/ast.ts:202](packages/core/src/ast.ts#L202)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "same-name";
```

Defined in: [packages/core/src/ast.ts:203](packages/core/src/ast.ts#L203)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`valueRange`](#valuerange)

***

### SemanticEventAttribute

Defined in: [packages/core/src/ast.ts:206](packages/core/src/ast.ts#L206)

#### Extends

- [`BaseAttribute`](#baseattribute)

#### Properties

##### event

```ts
event: string;
```

Defined in: [packages/core/src/ast.ts:208](packages/core/src/ast.ts#L208)

##### expressionRange?

```ts
optional expressionRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:184](packages/core/src/ast.ts#L184)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`expressionRange`](#expressionrange)

##### kind

```ts
kind: "semantic-event";
```

Defined in: [packages/core/src/ast.ts:207](packages/core/src/ast.ts#L207)

###### Overrides

[`BaseAttribute`](#baseattribute).[`kind`](#kind)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/ast.ts:179](packages/core/src/ast.ts#L179)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`name`](#name)

##### nameRange?

```ts
optional nameRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:182](packages/core/src/ast.ts#L182)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`nameRange`](#namerange)

##### range?

```ts
optional range?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:181](packages/core/src/ast.ts#L181)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`range`](#range)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:180](packages/core/src/ast.ts#L180)

###### Inherited from

[`BaseAttribute`](#baseattribute).[`raw`](#raw)

##### target

```ts
target: string;
```

Defined in: [packages/core/src/ast.ts:209](packages/core/src/ast.ts#L209)

##### valueRange?

```ts
optional valueRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:183](packages/core/src/ast.ts#L183)

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

Defined in: [packages/core/src/ast.ts:10](packages/core/src/ast.ts#L10)

#### Properties

##### end

```ts
end: SourceLocation;
```

Defined in: [packages/core/src/ast.ts:12](packages/core/src/ast.ts#L12)

##### start

```ts
start: SourceLocation;
```

Defined in: [packages/core/src/ast.ts:11](packages/core/src/ast.ts#L11)

***

### TextNode

Defined in: [packages/core/src/ast.ts:106](packages/core/src/ast.ts#L106)

#### Extends

- [`BaseNode`](#basenode)

#### Properties

##### children

```ts
children: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:47](packages/core/src/ast.ts#L47)

###### Inherited from

[`BaseNode`](#basenode).[`children`](#children)

##### kind

```ts
kind: "text";
```

Defined in: [packages/core/src/ast.ts:107](packages/core/src/ast.ts#L107)

###### Overrides

[`BaseNode`](#basenode).[`kind`](#kind-1)

##### range

```ts
range: SourceRange;
```

Defined in: [packages/core/src/ast.ts:46](packages/core/src/ast.ts#L46)

###### Inherited from

[`BaseNode`](#basenode).[`range`](#range-1)

##### raw

```ts
raw: string;
```

Defined in: [packages/core/src/ast.ts:48](packages/core/src/ast.ts#L48)

###### Inherited from

[`BaseNode`](#basenode).[`raw`](#raw-1)

##### text

```ts
text: string;
```

Defined in: [packages/core/src/ast.ts:108](packages/core/src/ast.ts#L108)

##### textRange?

```ts
optional textRange?: SourceRange;
```

Defined in: [packages/core/src/ast.ts:109](packages/core/src/ast.ts#L109)

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

Defined in: [packages/core/src/ast.ts:21](packages/core/src/ast.ts#L21)

The parsed form of one `.wx` file: the raw TypeScript prelude, the template
AST, collected diagnostics, and the Convex resource bindings inferred from
bare `$$module:function` lines. Every node carries a [SourceRange](#sourcerange) so
downstream tooling (LSP, compiler diagnostics) can map back to source.

#### Properties

##### body

```ts
body: string;
```

Defined in: [packages/core/src/ast.ts:23](packages/core/src/ast.ts#L23)

##### diagnostics

```ts
diagnostics: Diagnostic[];
```

Defined in: [packages/core/src/ast.ts:25](packages/core/src/ast.ts#L25)

##### hasWaveSeparator

```ts
hasWaveSeparator: boolean;
```

Defined in: [packages/core/src/ast.ts:27](packages/core/src/ast.ts#L27)

##### nodes

```ts
nodes: TemplateNode[];
```

Defined in: [packages/core/src/ast.ts:24](packages/core/src/ast.ts#L24)

##### prelude

```ts
prelude: string;
```

Defined in: [packages/core/src/ast.ts:22](packages/core/src/ast.ts#L22)

##### resources

```ts
resources: ResourceBinding[];
```

Defined in: [packages/core/src/ast.ts:26](packages/core/src/ast.ts#L26)

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

Defined in: [packages/core/src/ast.ts:169](packages/core/src/ast.ts#L169)

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

Defined in: [packages/core/src/ast.ts:74](packages/core/src/ast.ts#L74)

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

Defined in: [packages/core/src/ast.ts:35](packages/core/src/ast.ts#L35)

Any node in a `.wx` template body. The shapes mirror the language's
shorthand: native elements, `@` components, `+` directives, text,
`{{ … }}` expressions, and `$`/`$$` Convex references and calls.

## Functions

### componentReferenceToTag()

```ts
function componentReferenceToTag(reference, options?): string;
```

Defined in: [packages/core/src/model.ts:316](packages/core/src/model.ts#L316)

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

Defined in: [packages/core/src/model.ts:143](packages/core/src/model.ts#L143)

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

Defined in: [packages/core/src/model.ts:287](packages/core/src/model.ts#L287)

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

Defined in: [packages/core/src/model.ts:281](packages/core/src/model.ts#L281)

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

Defined in: [packages/core/src/model.ts:346](packages/core/src/model.ts#L346)

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

Defined in: [packages/core/src/model.ts:333](packages/core/src/model.ts#L333)

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

Defined in: [packages/core/src/model.ts:253](packages/core/src/model.ts#L253)

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

Defined in: [packages/core/src/model.ts:259](packages/core/src/model.ts#L259)

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

Defined in: [packages/core/src/model.ts:165](packages/core/src/model.ts#L165)

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

Defined in: [packages/core/src/model.ts:291](packages/core/src/model.ts#L291)

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

Defined in: [packages/core/src/model.ts:90](packages/core/src/model.ts#L90)

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

Defined in: [packages/core/src/parser.ts:612](packages/core/src/parser.ts#L612)

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

Defined in: [packages/core/src/model.ts:230](packages/core/src/model.ts#L230)

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

Defined in: [packages/core/src/parser.ts:97](packages/core/src/parser.ts#L97)

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

Defined in: [packages/core/src/model.ts:270](packages/core/src/model.ts#L270)

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

Defined in: [packages/core/src/model.ts:135](packages/core/src/model.ts#L135)

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

Defined in: [packages/core/src/model.ts:99](packages/core/src/model.ts#L99)

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

Defined in: [packages/core/src/model.ts:124](packages/core/src/model.ts#L124)

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

Defined in: [packages/core/src/model.ts:263](packages/core/src/model.ts#L263)

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

Defined in: [packages/core/src/model.ts:298](packages/core/src/model.ts#L298)

#### Parameters

##### value

`string`

#### Returns

`string`
