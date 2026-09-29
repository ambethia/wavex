import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { detectCapabilities, readManifestComponentDetails, webAwesomeBooleanAttributes } from "../src/capabilities.js";

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
