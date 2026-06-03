; WAVEx syntax highlighting for Tree-sitter/Zed.

(comment) @comment

(wave_marker) @punctuation.delimiter

(directive_marker) @operator
(conditional_directive_name) @keyword
(directive_name) @keyword
(directive_expression_content) @embedded

(component_reference) @constructor
(tag_name) @tag

(convex_call_sigil) @operator
(convex_reference_sigil) @operator
(convex_address_segment) @constant
(convex_address_separator) @punctuation.delimiter

(attribute_name) @attribute
(attribute_separator) @punctuation.delimiter
(quoted_attribute_value) @string
(attribute_value) @string
(boolean_attribute) @boolean
(same_name_attribute) @attribute

(semantic_event_prefix) @operator
(raw_event_prefix) @keyword
(event_name) @property

(quoted_string) @string

(utility_group_open) @punctuation.bracket
(utility_group_close) @punctuation.bracket
(utility_name) @label

(text_marker) @punctuation.delimiter
(expression_marker) @operator
(line_expression_content) @embedded

(interpolation_open) @punctuation.bracket
(interpolation_close) @punctuation.bracket
(interpolation_expression_content) @embedded

(code_span) @string @string.special
(strong_span) @emphasis @emphasis.strong
(emphasis_span) @emphasis
(mark_span) @hint
