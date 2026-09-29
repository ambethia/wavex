import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectAppIcons,
  collectDeclaredIcons,
  collectTemplateIcons,
  detectCapabilities,
  expressionValueLiterals,
  loadWebAwesomeIconFolder,
  readWebAwesomeDefaultLibraryIcons,
  resolveIconAsset,
  validateIconReferences,
  type IconFolderResolver
} from "../src/capabilities.js";
import { parseWavex } from "../src/index.js";

const tempDirs: string[] = [];
const installedWebAwesome = realpathSync(fileURLToPath(new URL("../../../apps/swell/node_modules/@awesome.me/webawesome", import.meta.url)));

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

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/></svg>';

describe("expressionValueLiterals", () => {
  it("collects string literals in value positions only", () => {
    expect(
      expressionValueLiterals("reward.status === 'fulfilled' ? 'box' : reward.shipment ? 'truck-fast' : 'hourglass-half'")
    ).toEqual(["box", "truck-fast", "hourglass-half"]);
    expect(expressionValueLiterals("done ? 'box' : \"truck-fast\"")).toEqual(["box", "truck-fast"]);
    expect(expressionValueLiterals("item.icon ?? 'circle'")).toEqual(["circle"]);
    expect(expressionValueLiterals("(ok && 'check') || `xmark`")).toEqual(["check", "xmark"]);
    expect(expressionValueLiterals("cond ? (inner ? 'a' : 'b') : 'c'")).toEqual(["a", "b", "c"]);
    expect(expressionValueLiterals("a?.b ? 'house' : `fa-${x}`")).toEqual(["house"]);
    expect(expressionValueLiterals("subjectIcon(item.subject)")).toEqual([]);
    expect(expressionValueLiterals("kind === 'box'")).toEqual([]);
    expect(expressionValueLiterals("1")).toEqual(["1"]);
  });
});

describe("collectTemplateIcons", () => {
  it("collects literal, dynamic-literal, and declared icons with their family, variant, and location", () => {
    const parsed = parseWavex(
      [
        'import { icon } from "@wavex/runtime"',
        'const extra = icon("gear", { family: "sharp" })',
        "~~~",
        "@icon name:plus",
        "@wa/icon name:rocket family:sharp variant:regular",
        "@icon name:{{ done ? 'box' : 'truck-fast' }} family:duotone",
        "@icon name:{{ subjectIcon(item) }}",
        "@icon name:heart library:system",
        "@icon name:star family:{{ family }}",
        "@button",
        "  @icon slot:start name:envelope",
        ""
      ].join("\n")
    );

    const { icons, diagnostics } = collectTemplateIcons(parsed);

    expect(diagnostics).toEqual([]);
    expect(icons).toEqual([
      { name: "plus", family: undefined, variant: undefined, line: 4, column: 12 },
      { name: "rocket", family: "sharp", variant: "regular", line: 5, column: 15 },
      { name: "box", family: "duotone", variant: undefined, line: 6, column: 12 },
      { name: "truck-fast", family: "duotone", variant: undefined, line: 6, column: 12 },
      { name: "envelope", family: undefined, variant: undefined, line: 11, column: 25 },
      { name: "gear", family: "sharp", variant: undefined, line: 2, column: 15 }
    ]);
  });

  it("does not treat a local icon component as Web Awesome's icon", () => {
    const parsed = parseWavex("~~~\n@icon name:plus\n@wa/icon name:minus\n");

    expect(collectTemplateIcons(parsed, { localComponents: ["icon"] }).icons.map((icon) => icon.name)).toEqual(["minus"]);
  });
});

describe("collectDeclaredIcons", () => {
  it("collects literal icon() calls imported from @wavex/runtime, including aliases and namespaces", () => {
    const source = [
      "import { icon } from '@wavex/runtime'",
      'import * as wx from "@wavex/runtime";',
      'import { icon as faIcon } from "@wavex/runtime"',
      "// icon('commented')",
      "const text = \"icon('quoted')\"",
      "const SUBJECT = { survey: icon('clipboard-list'), payment: icon(\"credit-card\", { family: 'sharp', variant: \"regular\" }) } as const",
      "const more = [wx.icon('house'), faIcon(`tags`)]",
      "const helpers = { icon(name: string) { return name } }",
      "other.icon('not-runtime')",
      ""
    ].join("\n");

    const { icons, diagnostics } = collectDeclaredIcons(source);

    expect(diagnostics).toEqual([]);
    expect(icons).toEqual([
      { name: "clipboard-list", family: undefined, variant: undefined, line: 6, column: 27 },
      { name: "credit-card", family: "sharp", variant: "regular", line: 6, column: 60 },
      { name: "house", family: undefined, variant: undefined, line: 7, column: 15 },
      { name: "tags", family: undefined, variant: undefined, line: 7, column: 33 }
    ]);
  });

  it("reports icon() calls it cannot collect and ignores files that do not import icon", () => {
    const source = 'import { icon } from "@wavex/runtime"\nconst a = icon(name)\nconst b = icon("x", options)\nconst c = icon(`fa-${kind}`)\n';

    expect(collectDeclaredIcons(source).diagnostics).toMatchObject([
      { code: "WX104", severity: "error", line: 2, column: 11 },
      { code: "WX104", severity: "error", line: 3, column: 11 },
      { code: "WX104", severity: "error", line: 4, column: 11 }
    ]);
    expect(collectDeclaredIcons('import { icon } from "./icons"\nicon("house")\n')).toEqual({ icons: [], diagnostics: [] });
    expect(collectDeclaredIcons('import type { icon } from "@wavex/runtime"\nicon("house")\n')).toEqual({ icons: [], diagnostics: [] });
  });
});

describe("Font Awesome icon sources", () => {
  it("detects kits and SVG packages in lookup order and skips JS-only packages", () => {
    const root = fixtureRoot("wavex-core-icon-sources-");
    writeFixture(root, "node_modules/@fortawesome/fontawesome-free/svgs/solid/house.svg", svg);
    writeFixture(root, "node_modules/@fortawesome/free-solid-svg-icons/index.js", "export {};\n");
    writeFixture(root, "node_modules/@awesome.me/kit-abc123/icons/svgs/solid/house.svg", svg);

    const { fontAwesome } = detectCapabilities(root);

    expect(fontAwesome.kits).toEqual(["@awesome.me/kit-abc123"]);
    expect(fontAwesome.packages).toEqual(["@fortawesome/fontawesome-free", "@fortawesome/free-solid-svg-icons"]);
    expect(fontAwesome.iconSources).toEqual([
      { packageName: "@awesome.me/kit-abc123", svgDir: join(root, "node_modules/@awesome.me/kit-abc123/icons/svgs") },
      { packageName: "@fortawesome/fontawesome-free", svgDir: join(root, "node_modules/@fortawesome/fontawesome-free/svgs") }
    ]);
  });

  it("validates icons against the installed SVGs using Web Awesome's own folder mapping", async () => {
    const root = fixtureRoot("wavex-core-icon-validate-");
    writeFixture(root, "node_modules/@fortawesome/fontawesome-free/svgs/solid/house.svg", svg);
    writeFixture(root, "node_modules/@fortawesome/fontawesome-free/svgs/regular/house.svg", svg);
    writeFixture(root, "node_modules/@fortawesome/fontawesome-free/svgs/brands/github.svg", svg);
    const sources = detectCapabilities(root).fontAwesome.iconSources;
    const folderOf = await loadWebAwesomeIconFolder(installedWebAwesome);

    expect(resolveIconAsset({ name: "house" }, folderOf, sources)).toEqual({
      folder: "solid",
      name: "house",
      file: join(root, "node_modules/@fortawesome/fontawesome-free/svgs/solid/house.svg")
    });
    expect(resolveIconAsset({ name: "house", variant: "regular" }, folderOf, sources)?.folder).toBe("regular");
    expect(resolveIconAsset({ name: "github", family: "brands" }, folderOf, sources)?.folder).toBe("brands");
    expect(resolveIconAsset({ name: "../house" }, folderOf, sources)).toBeUndefined();

    const diagnostics = validateIconReferences(
      [
        { name: "house", line: 1, column: 1 },
        { name: "hose", line: 2, column: 5 },
        { name: "house", family: "sharp", line: 3, column: 7 }
      ],
      folderOf,
      sources
    );
    expect(diagnostics).toEqual([
      {
        code: "WX103",
        severity: "error",
        line: 2,
        column: 5,
        message: 'Unknown Font Awesome icon "hose" (classic/solid): @fortawesome/fontawesome-free has no solid/hose.svg.'
      },
      {
        code: "WX103",
        severity: "error",
        line: 3,
        column: 7,
        message: 'Unknown Font Awesome icon "house" (sharp/solid): @fortawesome/fontawesome-free has no sharp-solid/house.svg.'
      }
    ]);
  });

  it("uses the installed Web Awesome getIconFolder, including Pro+ families", async () => {
    const folderOf: IconFolderResolver = await loadWebAwesomeIconFolder(installedWebAwesome);
    const { getIconFolder } = (await import(
      pathToFileURL(join(installedWebAwesome, "dist/components/icon/library.default.js")).href
    )) as { getIconFolder: IconFolderResolver };

    for (const family of ["classic", "sharp", "duotone", "sharp-duotone", "brands", "jelly", "notdog", "slab", "utility"]) {
      for (const variant of ["solid", "regular", "light", "thin"]) {
        expect(folderOf("x", family, variant)).toBe(getIconFolder("x", family, variant));
      }
    }
    expect(folderOf("x", "sharp", "regular")).toBe("sharp-regular");
  });

  it("fails clearly when the installed Web Awesome cannot map icon folders", async () => {
    const root = fixtureRoot("wavex-core-icon-old-wa-");

    await expect(loadWebAwesomeIconFolder(root)).rejects.toThrow(/requires Web Awesome 3\.8 or later/);
  });

  it("finds the icons Web Awesome's own components load from the default library", () => {
    expect(readWebAwesomeDefaultLibraryIcons(installedWebAwesome).map((icon) => icon.name)).toEqual(
      expect.arrayContaining(["bars", "minus", "plus"])
    );
  });
});

describe("collectAppIcons", () => {
  it("scans templates, preludes, and TypeScript declarations under src/", () => {
    const root = fixtureRoot("wavex-core-app-icons-");
    const page = writeFixture(root, "src/pages/index.wx", "~~~\n@icon name:{{ open ? 'box-open' : 'box' }}\n");
    const labels = writeFixture(root, "src/labels.ts", 'import { icon } from "@wavex/runtime";\nexport const ICONS = { a: icon("tags"), b: icon(dynamic) };\n');
    writeFixture(root, "src/types.d.ts", 'import { icon } from "@wavex/runtime";\ndeclare const x: typeof icon;\n');
    writeFixture(root, "src/plain.ts", "export const nothing = 1;\n");

    const results = collectAppIcons(root);

    expect(results.map((entry) => entry.file)).toEqual([labels, page]);
    expect(results[0]).toMatchObject({ icons: [{ name: "tags", line: 2, column: 27 }], diagnostics: [{ code: "WX104", line: 2, column: 44 }] });
    expect(results[1]!.icons.map((icon) => icon.name)).toEqual(["box-open", "box"]);
  });
});
