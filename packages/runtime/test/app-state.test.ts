import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const runtimePackage = fileURLToPath(new URL("..", import.meta.url));
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Type-check an app module against the built @wavex/runtime declarations. */
function typeErrors(source: string): string[] {
  const root = mkdtempSync(join(tmpdir(), "wavex-runtime-app-state-"));
  tempDirs.push(root);
  mkdirSync(join(root, "node_modules", "@wavex"), { recursive: true });
  symlinkSync(runtimePackage, join(root, "node_modules", "@wavex", "runtime"), "dir");
  const file = join(root, "main.ts");
  writeFileSync(file, source);
  const program = ts.createProgram({
    rootNames: [file],
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      types: []
    }
  });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

const registration = `
declare module "@wavex/runtime" {
  interface Register {
    state: { auth: { user: { email: string } | null } };
  }
}
`;

describe("app state registration", () => {
  it("types mountLitApp's initial state, app.update, and the mounted context with the registered state", () => {
    expect(
      typeErrors(`
import { mountLitApp } from "@wavex/runtime/lit";
import type { AppState } from "@wavex/runtime";
${registration}
const app = mountLitApp({ routes: [], initialContext: { state: { auth: { user: null } } } });
app.update({ state: { auth: { user: { email: "backer@example.com" } } } });
const email: string | undefined = app.mount.context.state?.auth.user?.email;
const state: AppState = { auth: { user: null } };
void email; void state;
`)
    ).toEqual([]);
  });

  it("rejects state that does not match the registration", () => {
    const errors = typeErrors(`
import { mountLitApp } from "@wavex/runtime/lit";
${registration}
const app = mountLitApp({ routes: [], initialContext: { state: { auth: { user: { mail: "x" } } } } });
app.update({ state: { pledges: [] } });
`);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("'mail' does not exist");
    expect(errors[1]).toContain("'pledges' does not exist");
  });

  it("keeps state an untyped record when the app registers nothing", () => {
    expect(
      typeErrors(`
import { mountLitApp } from "@wavex/runtime/lit";
const app = mountLitApp({ routes: [], initialContext: { state: { anything: 1 } } });
const value: number = app.mount.context.state?.whatever;
void value;
`)
    ).toEqual([]);
  });
});
