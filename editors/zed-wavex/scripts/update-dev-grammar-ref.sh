#!/usr/bin/env bash
set -euo pipefail

# Zed does not build grammars from the working tree. It fetches the grammar
# repository at the exact rev from extension.toml, so uncommitted grammar files
# are invisible to `zed: install dev extension`.
#
# This script snapshots packages/grammar into a git commit that Zed can fetch
# without moving the current branch or creating a normal project commit. It also
# writes that exact commit SHA into extension.toml. Using a stable branch name as
# the rev makes Zed's cached grammar checkout drift from the extension queries.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../../.." && pwd)
EXTENSION_DIR="$REPO_ROOT/editors/zed-wavex"
EXTENSION_TOML="$EXTENSION_DIR/extension.toml"
REF_NAME="zed-wavex-grammar-dev"

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  echo "Expected a git repository at $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/packages/grammar/src/parser.c" ]]; then
  echo "Missing packages/grammar/src/parser.c; run: pnpm --filter @wavex/grammar generate" >&2
  exit 1
fi

mkdir -p "$EXTENSION_DIR/languages/wavex"
cp "$REPO_ROOT/packages/grammar/queries/highlights.scm" "$EXTENSION_DIR/languages/wavex/highlights.scm"
cp "$REPO_ROOT/packages/grammar/queries/injections.scm" "$EXTENSION_DIR/languages/wavex/injections.scm"
cp "$REPO_ROOT/packages/grammar/queries/brackets.scm" "$EXTENSION_DIR/languages/wavex/brackets.scm"

TMP_INDEX=$(mktemp "${TMPDIR:-/tmp}/wavex-zed-grammar-index.XXXXXX")
trap 'rm -f "$TMP_INDEX"' EXIT

GIT_INDEX_FILE="$TMP_INDEX" git -C "$REPO_ROOT" read-tree HEAD
GIT_INDEX_FILE="$TMP_INDEX" git -C "$REPO_ROOT" add -A packages/grammar
TREE=$(GIT_INDEX_FILE="$TMP_INDEX" git -C "$REPO_ROOT" write-tree)
PARENT=$(git -C "$REPO_ROOT" rev-parse HEAD)

export GIT_AUTHOR_NAME="WAVEx Zed Dev Snapshot"
export GIT_AUTHOR_EMAIL="wavex-zed-dev@example.invalid"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

COMMIT=$(printf 'Snapshot @wavex/grammar for Zed dev extension\n' | git -C "$REPO_ROOT" commit-tree "$TREE" -p "$PARENT")
git -C "$REPO_ROOT" update-ref "refs/heads/$REF_NAME" "$COMMIT"

python3 - "$EXTENSION_TOML" "$COMMIT" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
commit = sys.argv[2]
text = path.read_text()
updated = re.sub(r'(?m)^rev = "[^"]+"$', f'rev = "{commit}"', text, count=1)
if updated == text:
    raise SystemExit(f"Could not update rev in {path}")
path.write_text(updated)
PY

rm -rf "$EXTENSION_DIR/grammars/wavex" "$EXTENSION_DIR/grammars/wavex.wasm"

echo "Updated local git ref $REF_NAME -> $COMMIT"
echo "Updated $EXTENSION_TOML to rev $COMMIT"
echo "Cleared stale Zed grammar cache under $EXTENSION_DIR/grammars"
echo "Zed can now fetch file://$REPO_ROOT at that exact grammar snapshot."
