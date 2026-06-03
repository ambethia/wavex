# WAVEx for Zed

Local Zed extension for `.wx` syntax highlighting.

## Install as a dev extension

1. Generate the grammar and update the local git ref that Zed fetches:

   ```sh
   cd /Users/jason/Projects/wavex/wavex
   pnpm install
   pnpm --filter @wavex/grammar generate
   ./editors/zed-wavex/scripts/update-dev-grammar-ref.sh
   ```

   Zed builds grammars from a git checkout, not directly from uncommitted working-tree files. Re-run the snapshot script whenever `packages/grammar` changes and you want Zed to pick it up. The script syncs query files into the extension, writes an exact grammar snapshot SHA to `extension.toml`, and clears Zed's stale grammar cache.

2. In Zed, run `zed: install dev extension` from the command palette.
3. Select this directory:

   ```txt
   /Users/jason/Projects/wavex/wavex/editors/zed-wavex
   ```

4. Open a `.wx` file such as:

   ```txt
   /Users/jason/Projects/wavex/todo/src/pages/index.wx
   ```

The extension maps `.wx` files to the `wavex` Tree-sitter grammar from `@wavex/grammar` and injects TypeScript into the prelude and template expressions.
