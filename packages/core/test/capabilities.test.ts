import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectCapabilities,
  discoverConvexFunctionKinds,
  findConvexDir,
  readManifestComponentDetails,
  webAwesomeBooleanAttributes
} from "../src/capabilities.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixtureRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function writeFixture(root: string, relativePath: string, content: string): string {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

describe("Web Awesome boolean attributes", () => {
  it("derives per-component boolean attributes from manifest attribute types", () => {
    const root = fixtureRoot("wavex-core-booleans-");
    writeFixture(
      root,
      "node_modules/@awesome.me/webawesome/dist/custom-elements.json",
      JSON.stringify({
        modules: [
          {
            declarations: [
              {
                tagName: "wa-button",
                attributes: [
                  { name: "with-caret", type: { text: "boolean" } },
                  { name: "loading", type: { text: "boolean | undefined" } },
                  { name: "variant", type: { text: "'brand' | 'neutral'" } },
                  { name: "href", type: { text: "string" } }
                ]
              },
              { tagName: "wa-spinner", attributes: [{ name: "label", type: { text: "string" } }] }
            ]
          }
        ]
      })
    );

    const webAwesome = detectCapabilities(root).webAwesome!;

    expect([...webAwesome.components].sort()).toEqual(["button", "spinner"]);
    expect(webAwesome.booleanAttributes).toEqual(new Map([["button", new Set(["with-caret", "loading"])]]));
  });

  it("finds the installed Web Awesome boolean attributes the demo apps rely on", () => {
    const swellRoot = fileURLToPath(new URL("../../../apps/swell", import.meta.url));
    const webAwesome = detectCapabilities(swellRoot).webAwesome!;
    const booleans = webAwesomeBooleanAttributes(
      readManifestComponentDetails(join(webAwesome.packageDir, "dist", "custom-elements.json"))
    );

    expect(booleans).toEqual(webAwesome.booleanAttributes);
    expect([...booleans.get("button")!]).toEqual(expect.arrayContaining(["with-caret", "disabled", "loading", "pill"]));
    expect([...booleans.get("progress-bar")!]).toContain("indeterminate");
    expect([...booleans.get("card")!]).toEqual(expect.arrayContaining(["with-header", "with-footer"]));
  });
});

describe("findConvexDir", () => {
  it("prefers the app root's own convex directory", () => {
    const root = fixtureRoot("wavex-core-convex-own-");
    writeFixture(root, "convex/_generated/api.d.ts", "export {};\n");
    writeFixture(root, "apps/web/convex/tasks.ts", "export const list = query({});\n");

    expect(findConvexDir(join(root, "apps/web"))).toBe(join(root, "apps/web/convex"));
  });

  it("finds a monorepo's Convex project in the nearest ancestor with generated code", () => {
    const root = fixtureRoot("wavex-core-convex-monorepo-");
    writeFixture(root, "convex/_generated/api.d.ts", "export {};\n");
    writeFixture(root, "convex/tasks.ts", "export const list = query({});\nexport const create = mutation({});\n");
    writeFixture(root, "packages/web/src/pages/index.wx", "~~~\nmain\n");

    const appRoot = join(root, "packages/web");

    expect(findConvexDir(appRoot)).toBe(join(root, "convex"));
    expect(discoverConvexFunctionKinds(appRoot)).toEqual({ "tasks:list": "query", "tasks:create": "mutation" });
  });

  it("accepts an ancestor convex directory marked by convex.json before codegen has run", () => {
    const root = fixtureRoot("wavex-core-convex-json-");
    writeFixture(root, "convex.json", "{}\n");
    writeFixture(root, "convex/tasks.ts", "export const list = query({});\n");
    // An ancestor-level convex/ without _generated or convex.json is not a Convex project.
    writeFixture(root, "packages/convex/notes.md", "not convex\n");

    expect(findConvexDir(join(root, "packages/web"))).toBe(join(root, "convex"));
  });

  it("returns undefined when the app has no Convex directory", () => {
    const root = fixtureRoot("wavex-core-convex-none-");
    writeFixture(root, "src/pages/index.wx", "~~~\nmain\n");

    expect(findConvexDir(root)).toBeUndefined();
    expect(discoverConvexFunctionKinds(root)).toEqual({});
  });
});
