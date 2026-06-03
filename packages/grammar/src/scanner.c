#include "tree_sitter/parser.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

// Keep this order in sync with grammar.js externals.
enum TokenType {
  ATTRIBUTE_NAME,
};

void *tree_sitter_wavex_external_scanner_create(void) { return NULL; }
void tree_sitter_wavex_external_scanner_destroy(void *payload) { (void)payload; }
void tree_sitter_wavex_external_scanner_reset(void *payload) { (void)payload; }
unsigned tree_sitter_wavex_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_wavex_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static bool is_attribute_start(int32_t c) { return c >= 'a' && c <= 'z'; }

static bool is_attribute_continue(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-';
}

bool tree_sitter_wavex_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;

  if (!valid_symbols[ATTRIBUTE_NAME]) return false;

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    lexer->advance(lexer, true);
  }

  if (!is_attribute_start(lexer->lookahead)) return false;

  lexer->advance(lexer, false);
  while (is_attribute_continue(lexer->lookahead)) {
    lexer->advance(lexer, false);
  }

  if (lexer->lookahead != ':') return false;

  lexer->result_symbol = ATTRIBUTE_NAME;
  lexer->mark_end(lexer);
  return true;
}
