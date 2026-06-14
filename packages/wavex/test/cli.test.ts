import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, viteArgsForWavexCommand } from "../src/cli-core.js";
import { injectPrerender } from "../src/prerender.js";

const tempDirs: string[] = [];
const originalExitCode = process.exitCode;

beforeEach(() => {
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
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

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args) => logs.push(args.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.join(" ")));
  return { logs, errors };
}

describe("wavex check", () => {
  it("uses the checked app root for local component and Web Awesome capability diagnostics", async () => {
    const root = fixtureRoot("wavex-cli-check-");
    writeFixture(
      root,
      "node_modules/@awesome.me/webawesome/dist/custom-elements.json",
      JSON.stringify({ modules: [{ declarations: [{ tagName: "wa-button" }] }] })
    );
    writeFixture(root, "src/components/site-nav.wx", "~~~\nnav Site\n");
    writeFixture(root, "src/pages/index.wx", "~~~\n@site-nav\n@button Click\n");
    const { logs, errors } = captureConsole();

    await runCli(["check", join(root, "src")]);

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    const output = logs.join("\n");
    expect(output).not.toContain("WX101");
    expect(output).toContain(
      "Checked 2 .wx files. Web Awesome: @awesome.me/webawesome (1 components); Font Awesome: none installed."
    );
  });
});

describe("wavex routes", () => {
  it("prints file-convention page routes and skips layout files", async () => {
    const root = fixtureRoot("wavex-cli-routes-");
    writeFixture(root, "src/pages/+layout.wx", "~~~\nslot\n");
    writeFixture(root, "src/pages/index.wx", "~~~\nh1 Home\n");
    writeFixture(root, "src/pages/about.wx", "~~~\nh1 About\n");
    writeFixture(root, "src/pages/users/[id].wx", "~~~\nh1 User\n");
    const { logs, errors } = captureConsole();

    await runCli(["routes", root]);

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    expect(logs).toEqual([
      "/about\tsrc/pages/about.wx",
      "/\tsrc/pages/index.wx",
      "/users/:id\tsrc/pages/users/[id].wx"
    ]);
  });
});

describe("wavex compile", () => {
  it("compiles a .wx file to a Lit render module on stdout", async () => {
    const root = fixtureRoot("wavex-cli-compile-");
    const file = writeFixture(root, "src/pages/index.wx", "~~~\nh1 Hello\n");
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as never);
    const { errors } = captureConsole();

    await runCli(["compile", file]);

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    const output = writes.join("");
    expect(output).toContain("export function render");
    expect(output).toContain("<h1>Hello</h1>");
  });
});

describe("wavex dev", () => {
  it("does not add --host unless the caller explicitly opts in", async () => {
    const calls: string[][] = [];

    await runCli(["dev"], (args) => calls.push(args));

    expect(calls).toEqual([[]]);
  });

  it("passes an explicit host through to Vite", async () => {
    const calls: string[][] = [];

    await runCli(["dev", "--host", "0.0.0.0"], (args) => calls.push(args));

    expect(calls).toEqual([["--host", "0.0.0.0"]]);
  });
});

describe("wavex prerender", () => {
  it("reuses a previously prerendered index.html as a clean shell", () => {
    const shell = "<!doctype html><html><head><title>App</title></head><body><main>client app</main></body></html>";
    const first = injectPrerender(shell, "<section><div>First route</div></section>", [
      { tag: "title", text: "First" },
      { tag: "meta", attributes: { name: "description", content: "First route" } }
    ]);

    const second = injectPrerender(first, "<article>Second route</article>", [
      { tag: "title", text: "Second" },
      { tag: "meta", attributes: { name: "description", content: "Second route" } }
    ]);

    expect(second.match(/data-wx-prerender/g)).toHaveLength(1);
    expect(second.match(/data-wx-head/g)).toHaveLength(2);
    expect(second).toContain("<title data-wx-head>Second</title>");
    expect(second).toContain('<meta name="description" content="Second route" data-wx-head>');
    expect(second).toContain("<article>Second route</article>");
    expect(second).toContain("<main>client app</main>");
    expect(second).not.toContain("First route");
  });

  it("preserves an intentionally empty managed title", () => {
    const shell = "<!doctype html><html><head><title>App</title></head><body></body></html>";

    const html = injectPrerender(shell, "", [{ tag: "title", text: "" }]);

    expect(html).toContain("<title data-wx-head></title>");
    expect(html).not.toContain("<title>App</title>");
  });

  it("uses the deepest head entries for prerendered title and keyed tags", () => {
    const shell = "<!doctype html><html><head><title>App</title></head><body></body></html>";

    const html = injectPrerender(shell, "", [
      { tag: "title", text: "Layout" },
      { tag: "meta", attributes: { name: "description", content: "Layout description" } },
      { tag: "meta", attributes: { property: "og:title", content: "Layout title" } },
      { tag: "link", attributes: { rel: "canonical", href: "https://example.test/layout" } },
      { tag: "title", text: "Page" },
      { tag: "meta", attributes: { name: "description", content: "Page description" } },
      { tag: "meta", attributes: { property: "og:title", content: "Page title" } },
      { tag: "link", attributes: { rel: "canonical", href: "https://example.test/page" } }
    ]);

    expect(html).toContain("<title data-wx-head>Page</title>");
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain('<meta name="description" content="Page description" data-wx-head>');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).toContain('<meta property="og:title" content="Page title" data-wx-head>');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('<link rel="canonical" href="https://example.test/page" data-wx-head>');
    expect(html).not.toContain("Layout");
  });

  it("replaces conflicting shell head entries with managed prerendered entries", () => {
    const shell = [
      "<!doctype html><html><head><title>App</title>",
      '<meta name="description" content="Default description">',
      '<meta property="og:title" content="Default title">',
      '<link rel="canonical" href="https://example.test/default">',
      '<meta data-name="description" content="not a head key">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "</head><body></body></html>"
    ].join("");

    const html = injectPrerender(shell, "", [
      { tag: "meta", attributes: { name: "description", content: "Page description" } },
      { tag: "meta", attributes: { property: "og:title", content: "Page title" } },
      { tag: "link", attributes: { rel: "canonical", href: "https://example.test/page" } }
    ]);

    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).toContain('<meta name="description" content="Page description" data-wx-head>');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).toContain('<meta property="og:title" content="Page title" data-wx-head>');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('<link rel="canonical" href="https://example.test/page" data-wx-head>');
    expect(html).toContain('<meta data-name="description" content="not a head key">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).not.toContain("Default description");
    expect(html).not.toContain("Default title");
    expect(html).not.toContain("https://example.test/default");
  });

  it("does not rewrite body markup when pruning conflicting shell head entries", () => {
    const shell = [
      "<!doctype html><html><head>",
      '<link rel="canonical" href="https://example.test/default">',
      "</head><body>",
      '<template><link rel="canonical" href="https://example.test/template"></template>',
      "</body></html>"
    ].join("");

    const html = injectPrerender(shell, '<section><link rel="canonical" href="https://example.test/body"></section>', [
      { tag: "link", attributes: { rel: "canonical", href: "https://example.test/page" } }
    ]);

    expect(html).toContain('<link rel="canonical" href="https://example.test/page" data-wx-head>');
    expect(html).toContain('<template><link rel="canonical" href="https://example.test/template"></template>');
    expect(html).toContain('<section><link rel="canonical" href="https://example.test/body"></section>');
    expect(html).not.toContain("https://example.test/default");
  });

  it("throws instead of silently skipping prerender injection for malformed shells", () => {
    expect(() => injectPrerender("<!doctype html><html><head></head></html>", "", [])).toThrow(/missing a <body> tag/);
    expect(() =>
      injectPrerender("<!doctype html><html><head><body></body></html>", "", [
        { tag: "meta", attributes: { name: "description", content: "Page" } }
      ])
    ).toThrow(/missing a closing <\/head> tag/);
  });

  it("inserts prerendered HTML and head entries without replacement-token expansion", () => {
    const shell = "<!doctype html><html><head><title>App</title></head><body></body></html>";

    const html = injectPrerender(shell, "<section>Cost $& $1 $$ $'</section>", [
      { tag: "title", text: "Price $& $1 $$ $'" },
      { tag: "meta", attributes: { name: "description", content: "Meta $& $1 $$ $'" } }
    ]);

    expect(html).toContain("<section>Cost $& $1 $$ $'</section>");
    expect(html).toContain("<title data-wx-head>Price $&amp; $1 $$ $'</title>");
    expect(html).toContain('<meta name="description" content="Meta $&amp; $1 $$ $\'" data-wx-head>');
  });
});

describe("viteArgsForWavexCommand", () => {
  it("keeps build proxied to the Vite build subcommand", () => {
    expect(viteArgsForWavexCommand("build", ["--mode", "production"])).toEqual(["build", "--mode", "production"]);
  });
});
