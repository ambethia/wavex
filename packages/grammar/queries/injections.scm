; Inject TypeScript into the colocated prelude and template expressions.

((prelude) @injection.content
 (#set! injection.language "typescript"))

((conditional_directive_line
  expression: (directive_expression_content) @injection.content)
 (#set! injection.language "typescript"))

((expression_line
  expression: (line_expression_content) @injection.content)
 (#set! injection.language "typescript"))

((interpolation
  expression: (interpolation_expression_content) @injection.content)
 (#set! injection.language "typescript"))
