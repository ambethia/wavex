# Releasing WAVEx

WAVEx packages are versioned together. The initial prerelease version is
`0.1.0-alpha.0`; npm prereleases use the `alpha` dist-tag.

## Build and validate artifacts

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm ci
pnpm package:artifacts
pnpm --filter wavex-vscode package:pre-release
```

`pnpm package:check` packs every public workspace package, installs those
tarballs together in an isolated consumer project, imports every public entry
point, and runs the packed `wavex` binary. `pnpm package:artifacts` performs the
same check and retains the tarballs under `artifacts/`.

The manually dispatched `release-artifacts.yml` workflow runs the full gate
and uploads the npm tarballs plus a VS Code prerelease VSIX without publishing
either artifact.

## First npm publication

Before enabling publication, confirm ownership of the `@wavex` npm scope and
the unscoped `wavex` package. Configure npm trusted publishing for each public
package against the eventual publish workflow; npm publication should use
GitHub OIDC rather than a long-lived write token.

The public packages are:

- `@wavex/core`
- `@wavex/compiler`
- `@wavex/runtime`
- `@wavex/vite-plugin`
- `@wavex/lsp`
- `wavex`

Publishing and Marketplace submission are deliberately separate external
steps. Artifact generation stays safe to run locally or in CI.
