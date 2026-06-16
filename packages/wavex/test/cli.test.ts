import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileWavexModule } from "@wavex/compiler";
import type { DirectiveNode, TemplateNode } from "@wavex/core";
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

function readWxFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && path.endsWith(".wx")) files.set(path, readFileSync(path, "utf8"));
    }
  };
  visit(root);
  return files;
}

function localComponentsFor(appRoot: string): string[] {
  const componentsRoot = join(appRoot, "src/components");
  return [...readWxFiles(componentsRoot).keys()].map((path) =>
    path.slice(componentsRoot.length + 1, -".wx".length).replaceAll("\\", "/")
  );
}

function findDirective(nodes: readonly TemplateNode[], name: string): DirectiveNode | undefined {
  for (const node of nodes) {
    if (node.kind === "directive" && node.name === name) return node;
    const child = findDirective(node.children, name);
    if (child) return child;
  }
  return undefined;
}

describe("Swell validation app", () => {
  it("exercises the newest router, prerender, Convex, suspense, Web Awesome, and component-path features", () => {
    const appRoot = fileURLToPath(new URL("../../../apps/swell", import.meta.url));
    const files = readWxFiles(join(appRoot, "src"));
    const localComponents = localComponentsFor(appRoot);
    const styles = readFileSync(join(appRoot, "src/style.css"), "utf8");
    const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };

    for (const [path, wxSource] of files) {
      expect(compileWavexModule(wxSource, { id: path, localComponents }).ast.diagnostics).toEqual([]);
    }

    const layout = compileWavexModule(files.get(join(appRoot, "src/pages/+layout.wx"))!, { localComponents });
    expect(layout.code).toContain("navigation.pending");
    expect(layout.code).toContain("<wa-progress-bar");
    expect(layout.code).toContain("class=\"nav-progress\"");
    expect(styles).toContain("::view-transition-new(root)");
    expect(manifest.scripts?.prerender).toContain("wavex prerender .");

    const live = compileWavexModule(files.get(join(appRoot, "src/pages/live.wx"))!, { localComponents });
    expect(live.ast.nodes.some((node) => node.kind === "convex-reference" && node.address.raw === "$talks:list")).toBe(true);
    expect(live.code).toContain('name: "talks"');
    expect(live.code).toContain('name: "systemsTalks"');
    expect(live.code).toContain('return { "track": "systems" };');
    const suspense = findDirective(live.ast.nodes, "suspense");
    expect(suspense?.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "literal", name: "reveal", value: "progressive" }),
        expect.objectContaining({ kind: "literal", name: "refresh", value: "background" }),
      ])
    );

    const home = compileWavexModule(files.get(join(appRoot, "src/pages/index.wx"))!, { localComponents });
    expect(home.code).toContain("<wa-card>");
    expect(home.code).toContain("__wxc_conference_hero_stat");
  });
});

describe("wavex check", () => {
  it("fails clearly when the root does not exist", async () => {
    const missingRoot = join(fixtureRoot("wavex-cli-check-missing-"), "missing");
    const { logs, errors } = captureConsole();

    await runCli(["check", missingRoot]);

    expect(logs).toEqual([]);
    expect(errors).toEqual([`wavex check root does not exist: ${missingRoot}`]);
    expect(process.exitCode).toBe(1);
  });

  it("prints diagnostics on stderr and the summary on stdout", async () => {
    const root = fixtureRoot("wavex-cli-check-streams-");
    writeFixture(root, "src/pages/index.wx", "~~~\n@missing-widget\n");
    const { logs, errors } = captureConsole();

    await runCli(["check", root]);

    expect(logs).toEqual(["Checked 1 .wx file. Web Awesome: not installed; Font Awesome: none installed."]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("src/pages/index.wx: ");
    expect(errors[0]).toContain("WX101");
    expect(process.exitCode).toBe(1);
  });

  it("resolves the app root when checking a nested src directory", async () => {
    const workspace = fixtureRoot("wavex-cli-check-");
    const appRoot = join(workspace, "apps", "swell");
    writeFixture(
      appRoot,
      "node_modules/@awesome.me/webawesome/dist/custom-elements.json",
      JSON.stringify({ modules: [{ declarations: [{ tagName: "wa-button" }] }] })
    );
    writeFixture(appRoot, "src/components/site-nav.wx", "~~~\nnav Site\n");
    writeFixture(appRoot, "src/pages/index.wx", "~~~\n@site-nav\n@button Click\n");
    const { logs, errors } = captureConsole();

    await runCli(["check", join(appRoot, "src")]);

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
  it("fails clearly when the root does not exist", async () => {
    const missingRoot = join(fixtureRoot("wavex-cli-routes-missing-"), "missing");
    const { logs, errors } = captureConsole();

    await runCli(["routes", missingRoot]);

    expect(logs).toEqual([]);
    expect(errors).toEqual([`wavex routes root does not exist: ${missingRoot}`]);
    expect(process.exitCode).toBe(1);
  });

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
  it("fails clearly when the input file does not exist", async () => {
    const missingFile = join(fixtureRoot("wavex-cli-compile-missing-"), "missing.wx");
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as never);
    const { logs, errors } = captureConsole();

    await runCli(["compile", missingFile]);

    expect(writes).toEqual([]);
    expect(logs).toEqual([]);
    expect(errors).toEqual([`wavex compile input does not exist: ${missingFile}`]);
    expect(process.exitCode).toBe(1);
  });

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
  it("uses a / route prerendered index.html as a clean shell for later routes", () => {
    const shell = "<!doctype html><html><head><title>App</title></head><body><main>client app</main></body></html>";
    const rootRouteHtml = injectPrerender(shell, "<section><div>Home route</div></section>", [
      { tag: "title", text: "Home" },
      { tag: "meta", attributes: { name: "description", content: "Home route" } }
    ]);

    const laterRouteHtml = injectPrerender(rootRouteHtml, "<article>About route</article>", [
      { tag: "title", text: "About" },
      { tag: "meta", attributes: { name: "description", content: "About route" } }
    ]);

    expect(laterRouteHtml.match(/data-wx-prerender/g)).toHaveLength(1);
    expect(laterRouteHtml.match(/data-wx-head/g)).toHaveLength(2);
    expect(laterRouteHtml.match(/<title\b/g)).toHaveLength(1);
    expect(laterRouteHtml.match(/<meta\b/g)).toHaveLength(1);
    expect(laterRouteHtml).toContain("<title data-wx-head>About</title>");
    expect(laterRouteHtml).toContain('<meta name="description" content="About route" data-wx-head>');
    expect(laterRouteHtml).toContain("<article>About route</article>");
    expect(laterRouteHtml).toContain("<main>client app</main>");
    expect(laterRouteHtml).not.toContain("Home route");
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

  it("inserts prerender titles in the head without rewriting body titles", () => {
    const shell = [
      "<!doctype html><html><head>",
      '<meta charset="utf-8">',
      "</head><body>",
      "<svg><title>Navigation icon</title></svg>",
      "</body></html>"
    ].join("");

    const html = injectPrerender(shell, "", [{ tag: "title", text: "Page title" }]);

    expect(html).toContain('<head><meta charset="utf-8"><title data-wx-head>Page title</title></head>');
    expect(html).toContain("<svg><title>Navigation icon</title></svg>");
  });

  it("throws instead of silently skipping prerender injection for malformed shells", () => {
    expect(() => injectPrerender("<!doctype html><html><head></head></html>", "", [])).toThrow(/missing a <body> tag/);
    expect(() =>
      injectPrerender("<!doctype html><html><head><body></body></html>", "", [
        { tag: "meta", attributes: { name: "description", content: "Page" } }
      ])
    ).toThrow(/missing a closing <\/head> tag/);
    expect(() =>
      injectPrerender("<!doctype html><html><head><title>App</title><body></body></html>", "", [
        { tag: "title", text: "Page" }
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
