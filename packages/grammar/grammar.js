/**
 * Tree-sitter grammar for WAVEx `.wx` files.
 *
 * The first grammar milestone is intentionally line-oriented: it gives editors a
 * stable syntax tree for highlighting and TypeScript injections while the
 * TypeScript compiler/parser in @wavex/language-core remains authoritative for
 * semantic validation such as indentation errors.
 */

const BOOLEAN_ATTRIBUTES = [
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
];

module.exports = grammar({
  name: "wavex",

  extras: () => [/[ \t]/],

  word: ($) => $.identifier,

  externals: ($) => [$.attribute_name],

  inline: ($) => [$.generic_directive_line],

  rules: {
    source_file: ($) => seq(optional($.prelude), $.separator, optional(seq($.newline, optional($.template)))),

    prelude: ($) => repeat1(choice($.prelude_content, $.newline)),
    prelude_content: () => token(prec(-1, /[^\n]+/)),

    separator: ($) => $.wave_marker,
    wave_marker: () => "~~~",

    template: ($) =>
      choice(
        repeat1(choice($.blank_line, $.terminated_template_line)),
        seq(repeat(choice($.blank_line, $.terminated_template_line)), $.template_line)
      ),
    terminated_template_line: ($) => seq($.template_line, $.newline),
    template_line: ($) =>
      choice(
        $.comment_line,
        $.resource_declaration,
        $.convex_reference_line,
        $.directive_line,
        $.component_line,
        $.text_line,
        $.expression_line,
        $.element_line
      ),

    blank_line: ($) => $.newline,
    newline: () => /\r?\n/,

    comment_line: ($) => $.comment,
    comment: () => token(seq("//", /[^\n]*/)),

    resource_declaration: ($) => seq($.convex_call, repeat($.line_item)),
    convex_reference_line: ($) => seq($.convex_reference, repeat($.line_item)),

    directive_line: ($) => choice($.conditional_directive_line, $.generic_directive_line),
    conditional_directive_line: ($) =>
      prec(1, seq($.directive_marker, field("name", $.conditional_directive_name), optional(field("expression", $.directive_expression_content)))),
    generic_directive_line: ($) => seq($.directive_marker, field("name", $.directive_name), repeat($.line_item)),
    directive_marker: () => "+",
    conditional_directive_name: () => "if",
    directive_name: ($) => $.identifier,
    directive_expression_content: () => token.immediate(/[^\n]+/),

    component_line: ($) => seq($.component_reference, repeat($.line_item)),
    component_reference: () => token(seq("@", /[A-Za-z_][A-Za-z0-9_\/-]*/)),

    text_line: ($) => seq($.text_marker, repeat($.line_item)),
    text_marker: () => "|",

    expression_line: ($) => seq($.expression_marker, optional(field("expression", $.line_expression_content))),
    expression_marker: () => "=",
    line_expression_content: () => token.immediate(/[^\n]+/),

    element_line: ($) => seq(field("tag", $.tag_name), repeat($.line_item)),
    tag_name: () => token(/[A-Za-z][A-Za-z0-9-]*/),

    line_item: ($) =>
      choice(
        $.utility_group,
        $.semantic_event_attribute,
        $.raw_event_attribute,
        $.expression_attribute,
        $.quoted_attribute,
        $.valued_attribute,
        $.same_name_attribute,
        $.boolean_attribute,
        $.interpolation,
        $.quoted_string,
        $.code_span,
        $.strong_span,
        $.emphasis_span,
        $.mark_span,
        $.text_fragment,
        $.punctuation
      ),

    utility_group: ($) => seq($.utility_group_open, repeat($.utility_name), $.utility_group_close),
    utility_group_open: () => "[",
    utility_group_close: () => "]",
    utility_name: () => token(/[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?/),

    semantic_event_attribute: ($) =>
      prec(4, seq($.semantic_event_prefix, field("event", $.event_name), $.attribute_separator, field("target", choice($.convex_call, $.convex_reference, $.attribute_value)))),
    semantic_event_prefix: () => ":",
    raw_event_attribute: ($) =>
      prec(4, seq($.raw_event_prefix, field("event", $.event_name), $.attribute_separator, field("handler", $.attribute_value))),
    raw_event_prefix: () => "on:",

    expression_attribute: ($) =>
      prec(3, seq(field("name", $.attribute_name), $.attribute_separator, field("value", $.interpolation))),
    quoted_attribute: ($) =>
      prec(2, seq(field("name", $.attribute_name), $.attribute_separator, field("value", $.quoted_attribute_value))),
    valued_attribute: ($) =>
      prec(1, seq(field("name", $.attribute_name), $.attribute_separator, field("value", $.attribute_value))),
    same_name_attribute: ($) => prec(-1, seq(field("name", $.attribute_name), $.attribute_separator)),
    event_name: () => token.immediate(/[A-Za-z_][A-Za-z0-9_-]*/),
    attribute_separator: () => token.immediate(":"),
    quoted_attribute_value: () => token.immediate(seq('"', repeat(choice(/[^"\\\n]+/, /\\./)), '"')),
    attribute_value: () => token.immediate(/[^\s\]\{\"$\n]+/),
    boolean_attribute: () => token(prec(2, choice(...BOOLEAN_ATTRIBUTES))),

    interpolation: ($) =>
      seq($.interpolation_open, optional(field("expression", $.interpolation_expression_content)), $.interpolation_close),
    interpolation_open: () => "{{",
    interpolation_close: () => "}}",
    interpolation_expression_content: () => token.immediate(/[^}\n]+/),

    quoted_string: () => token(seq('"', repeat(choice(/[^"\\\n]+/, /\\./)), '"')),

    code_span: () => token(/`[^`\n]+`/),
    strong_span: () => token(/\*[^*\n]+\*/),
    emphasis_span: () => token(/_[^_\n]+_/),
    mark_span: () => token(/~[^~\n]+~/),

    convex_call: ($) => prec(5, seq($.convex_call_sigil, $.convex_address)),
    convex_reference: ($) => prec(5, seq($.convex_reference_sigil, $.convex_address)),
    convex_call_sigil: () => "$$",
    convex_reference_sigil: () => "$",
    convex_address: ($) => seq($.convex_address_segment, repeat1(seq($.convex_address_separator, $.convex_address_segment))),
    convex_address_segment: () => token.immediate(/[A-Za-z_$][A-Za-z0-9_$\/-]*/),
    convex_address_separator: () => token.immediate(":"),

    identifier: () => /[A-Za-z_][A-Za-z0-9_]*/,
    text_fragment: () => token(prec(-1, /[^\s\[\]\{\}:@`*_~"\n]+/)),
    punctuation: () => token(prec(-2, /[^\s\n]/))
  }
});
