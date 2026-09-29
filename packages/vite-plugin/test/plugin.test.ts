import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wavex } from "../src/index.js";

const installedWebAwesome = realpathSync(fileURLToPath(new URL("../../../apps/swell/node_modules/@awesome.me/webawesome", import.meta.url)));

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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

function configuredPlugin(root: string, options?: Parameters<typeof wavex>[0]) {
  const plugin = wavex(options) as any;
  plugin.configResolved({ root });
  return plugin;
}

function createDevServer(root: string, modulesByFile: Map<string, Set<any>>) {
  const fileHandlers = new Map<string, (file: string) => void>();
  let closeHandler: (() => void) | undefined;
  const server = {
    config: { root, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
    watcher: {
      add: vi.fn(),
      on: vi.fn((event: string, handler: (file: string) => void) => {
        fileHandlers.set(event, handler);
      })
    },
    middlewares: { use: vi.fn() },
    moduleGraph: {
      onFileChange: vi.fn(),
      getModuleById: vi.fn(),
      getModulesByFile: vi.fn((file: string) => modulesByFile.get(file) ?? new Set()),
      invalidateModule: vi.fn()
    },
    ws: { send: vi.fn() },
    httpServer: {
      once: vi.fn((event: string, handler: () => void) => {
        if (event === "close") closeHandler = handler;
      })
    }
  };
  return {
    server,
    change(file: string) {
      fileHandlers.get("change")?.(file);
    },
    add(file: string) {
      fileHandlers.get("add")?.(file);
    },
    unlink(file: string) {
      fileHandlers.get("unlink")?.(file);
    },
    close() {
      closeHandler?.();
    }
  };
}

describe("wavex Vite plugin config", () => {
  it("dedupes Lit and keeps Web Awesome out of dependency prebundling", () => {
    const config = (wavex() as any).config();

    expect(config.resolve.dedupe).toEqual(["lit", "lit-html", "lit-element", "@lit/reactive-element", "@lit/context"]);
    expect(config.optimizeDeps.exclude).toEqual(
      expect.arrayContaining([
        "@web.awesome.me/webawesome-pro",
        "@awesome.me/webawesome",
        "lit",
        "lit-html",
        "lit-element",
        "@lit/reactive-element",
        "@lit/context"
      ])
    );
  });
});

describe("wavex Vite virtual modules", () => {
  it("generates route modules with layout, error, and lazy page imports", () => {
    const root = fixtureRoot("wavex-vite-routes-");
    writeFixture(root, "src/pages/+layout.wx", "~~~\nslot\n");
    writeFixture(root, "src/pages/+error.wx", "~~~\np Root error\n");
    writeFixture(root, "src/pages/index.wx", "~~~\nh1 Home\n");
    writeFixture(root, "src/pages/talks/+layout.wx", "~~~\nslot\n");
    writeFixture(root, "src/pages/talks/+error.wx", "~~~\np Talk error\n");
    writeFixture(root, "src/pages/talks/[slug].wx", "~~~\nh1 Talk\n");
    const plugin = configuredPlugin(root);

    const routesId = plugin.resolveId("virtual:wavex/routes");
    const routes = plugin.load(routesId) as string;

    expect(routesId).toBe("\0virtual:wavex/routes");
    expect(routes).toContain('"path":"/"');
    expect(routes).toContain('"path":"/talks/:slug"');
    expect(routes).toContain('load: () => import("/src/pages/talks/[slug].wx")');
    expect(routes).toContain('{ file: "src/pages/+layout.wx", load: () => import("/src/pages/+layout.wx") }');
    expect(routes).toContain('{ file: "src/pages/talks/+layout.wx", load: () => import("/src/pages/talks/+layout.wx") }');
    expect(routes).toContain('{ file: "src/pages/+error.wx", load: () => import("/src/pages/+error.wx") }');
    expect(routes).toContain('{ file: "src/pages/talks/+error.wx", load: () => import("/src/pages/talks/+error.wx") }');
  });

  it("generates importable app metadata for action kinds and configured view transitions", () => {
    const root = fixtureRoot("wavex-vite-bootstrap-");
    writeFixture(root, "src/style.css", "body { margin: 0; }\n");
    writeFixture(root, "convex/_generated/api.js", "export const api = {};\n");
    writeFixture(
      root,
      "convex/tasks.ts",
      'export const list = query({});\nexport const create = mutation({});\nexport const run = action({});\n'
    );
    const plugin = configuredPlugin(root, { viewTransitions: false });

    const manifestId = plugin.resolveId("virtual:wavex/manifest");
    const manifest = plugin.load(manifestId) as string;

    expect(manifestId).toBe("\0virtual:wavex/manifest");
    expect(manifest).toContain('"tasks:create":"mutation"');
    expect(manifest).toContain('"tasks:run":"action"');
    expect(manifest).not.toContain('"tasks:list":"query"');
    expect(manifest).toContain("export const viewTransitions = false");
    expect(manifest).toContain("export const resolveActionKind");
  });

  it("generates the default body bootstrap through the reusable app composition API", () => {
    const root = fixtureRoot("wavex-vite-bootstrap-");
    writeFixture(root, "src/style.css", "body { margin: 0; }\n");
    writeFixture(root, "convex/_generated/api.js", "export const api = {};\n");
    const plugin = configuredPlugin(root, { viewTransitions: false });

    const bootstrapId = plugin.resolveId("/@wavex/bootstrap");
    const bootstrap = plugin.load(bootstrapId) as string;

    expect(bootstrapId).toBe("\0virtual:wavex/bootstrap");
    expect(bootstrap).toContain('import "/src/style.css";');
    expect(bootstrap).toContain('import { api as convexApi } from "/convex/_generated/api.js";');
    expect(bootstrap).toContain('import { mountLitApp } from "@wavex/runtime/lit";');
    expect(bootstrap).toContain('from "virtual:wavex/manifest";');
    expect(bootstrap).toContain('const root = document.body;');
    expect(bootstrap).toContain("const app = mountLitApp({");
    expect(bootstrap).toContain("viewTransitions,");
    expect(bootstrap).toContain("app.dispose();");
  });
});

describe("wavex Vite transform", () => {
  it("compiles .wx pages with local component imports, Web Awesome imports, and route HMR self-accept", async () => {
    const root = fixtureRoot("wavex-vite-transform-");
    writeFixture(
      root,
      "node_modules/@awesome.me/webawesome/dist/custom-elements.json",
      JSON.stringify({ modules: [{ declarations: [{ tagName: "wa-button" }] }] })
    );
    writeFixture(root, "src/components/card.wx", "~~~\nsection\n  slot\n");
    const pageFile = writeFixture(root, "src/pages/index.wx", "~~~\n@button variant:brand Save\n@card\n  p Projected\n");
    const plugin = configuredPlugin(root);
    const context = {
      addWatchFile: vi.fn(),
      warn: vi.fn(),
      error(error: { message: string }) {
        throw new Error(error.message);
      }
    };

    const result = await plugin.transform.call(context, "~~~\n@button variant:brand Save\n@card\n  p Projected\n", pageFile);
    const code = result.code as string;

    expect(context.addWatchFile).toHaveBeenCalledWith(pageFile);
    expect(code).toContain('import "@awesome.me/webawesome/dist/components/button/button.js";');
    expect(code).toContain('import * as __wxc_card from "/src/components/card.wx";');
    expect(code).toContain("import.meta.hot.accept");
    expect(code).toContain("__wavexHotReplacePage");
  });

  it("parses the installed Web Awesome component's boolean attributes on @component heads", async () => {
    const root = fixtureRoot("wavex-vite-transform-booleans-");
    writeFixture(
      root,
      "node_modules/@awesome.me/webawesome/dist/custom-elements.json",
      JSON.stringify({
        modules: [
          {
            declarations: [
              { tagName: "wa-button", attributes: [{ name: "with-caret", type: { text: "boolean" } }] },
              { tagName: "wa-dropdown" }
            ]
          }
        ]
      })
    );
    const source = "~~~\n@dropdown\n  @button slot:trigger appearance:plain with-caret class:snooze\n    | Snooze\n";
    const pageFile = writeFixture(root, "src/pages/index.wx", source);
    const plugin = configuredPlugin(root);
    const context = {
      addWatchFile: vi.fn(),
      warn: vi.fn(),
      error(error: { message: string }) {
        throw new Error(error.message);
      }
    };

    const result = await plugin.transform.call(context, source, pageFile);
    const code = result.code as string;

    expect(code).toContain("?with-caret=${true}");
    expect(code).not.toContain(">with-caret");
  });

  it("surfaces every transform diagnostic in the thrown Vite error", async () => {
    const root = fixtureRoot("wavex-vite-transform-errors-");
    const pageFile = writeFixture(root, "src/pages/index.wx", "~~~\n+maybe nope\n+for task of tasks\n");
    const plugin = configuredPlugin(root);
    const context = {
      addWatchFile: vi.fn(),
      warn: vi.fn(),
      error(error: { message: string }) {
        throw new Error(error.message);
      }
    };

    await expect(plugin.transform.call(context, "~~~\n+maybe nope\n+for task of tasks\n", pageFile)).rejects.toThrow(/WX009[\s\S]*WX010/);
  });
});

describe("wavex Vite dev-server integration", () => {
  it("relies on Vite's watcher instead of request-time invalidation or stat polling", () => {
    const root = fixtureRoot("wavex-vite-cache-guard-");
    writeFixture(root, "src/pages/index.wx", "~~~\nh1 Home\n");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const { server } = createDevServer(root, new Map());
    const plugin = configuredPlugin(root);

    plugin.configureServer(server);

    expect(server.middlewares.use).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("watches pages and components and emits a page self update for component edits", () => {
    const root = fixtureRoot("wavex-vite-hmr-");
    writeFixture(root, "src/pages/index.wx", "~~~\n@card\n");
    const componentFile = writeFixture(root, "src/components/card.wx", "~~~\nsection Card\n");
    const componentModule = {
      url: "/src/components/card.wx",
      importers: new Set<any>(),
      acceptedHmrDeps: new Set<any>(),
      isSelfAccepting: false
    };
    const pageModule = {
      url: "/src/pages/index.wx",
      importers: new Set<any>(),
      acceptedHmrDeps: new Set([componentModule]),
      isSelfAccepting: true
    };
    componentModule.importers.add(pageModule);
    const { server, change, close } = createDevServer(root, new Map([[componentFile, new Set([componentModule])]]));
    const plugin = configuredPlugin(root);

    plugin.configureServer(server);
    change(componentFile);
    close();

    expect(server.middlewares.use).not.toHaveBeenCalled();
    expect(server.watcher.add).toHaveBeenCalledWith([join(root, "src/pages"), join(root, "src/components")]);
    expect(server.moduleGraph.onFileChange).toHaveBeenCalledWith(componentFile);
    expect(server.ws.send).toHaveBeenCalledWith({
      type: "update",
      updates: [
        {
          type: "js-update",
          path: "/src/pages/index.wx",
          acceptedPath: "/src/pages/index.wx",
          timestamp: expect.any(Number)
        }
      ]
    });
  });

  it("emits a page self update for component edits that reach a generated page boundary", () => {
    const root = fixtureRoot("wavex-vite-component-boundary-hmr-");
    writeFixture(root, "src/pages/index.wx", "~~~\n@card\n");
    const componentFile = writeFixture(root, "src/components/card.wx", "~~~\nsection Card\n");
    const componentModule = {
      url: "/src/components/card.wx",
      importers: new Set<any>(),
      acceptedHmrDeps: new Set<any>(),
      isSelfAccepting: false
    };
    const pageModule = {
      url: "/src/pages/index.wx",
      importers: new Set<any>(),
      acceptedHmrDeps: new Set<any>(),
      isSelfAccepting: true
    };
    componentModule.importers.add(pageModule);
    const { server, change, close } = createDevServer(root, new Map([[componentFile, new Set([componentModule])]]));
    const plugin = configuredPlugin(root);

    plugin.configureServer(server);
    change(componentFile);
    close();

    expect(server.ws.send).toHaveBeenCalledWith({
      type: "update",
      updates: [
        {
          type: "js-update",
          path: "/src/pages/index.wx",
          acceptedPath: "/src/pages/index.wx",
          timestamp: expect.any(Number)
        }
      ]
    });
  });

  it("emits a self update for page edits accepted by generated page modules", () => {
    const root = fixtureRoot("wavex-vite-page-hmr-");
    const pageFile = writeFixture(root, "src/pages/index.wx", "~~~\nh1 Home\n");
    const pageModule = {
      url: "/src/pages/index.wx",
      importers: new Set<any>(),
      acceptedHmrDeps: new Set<any>(),
      isSelfAccepting: true
    };
    const { server, change, close } = createDevServer(root, new Map([[pageFile, new Set([pageModule])]]));
    const plugin = configuredPlugin(root);

    plugin.configureServer(server);
    change(pageFile);
    close();

    expect(server.moduleGraph.onFileChange).toHaveBeenCalledWith(pageFile);
    expect(server.ws.send).toHaveBeenCalledWith({
      type: "update",
      updates: [
        {
          type: "js-update",
          path: "/src/pages/index.wx",
          acceptedPath: "/src/pages/index.wx",
          timestamp: expect.any(Number)
        }
      ]
    });
  });

  it("full reloads when route files are added or deleted", () => {
    const root = fixtureRoot("wavex-vite-route-file-hmr-");
    const pageFile = writeFixture(root, "src/pages/new.wx", "~~~\nh1 New\n");
    const { server, add, unlink, close } = createDevServer(root, new Map());
    const plugin = configuredPlugin(root);

    plugin.configureServer(server);
    add(pageFile);
    unlink(pageFile);
    close();

    expect(server.moduleGraph.onFileChange).toHaveBeenCalledWith(pageFile);
    expect(server.ws.send).toHaveBeenCalledWith({ type: "full-reload", path: "*" });
    expect(server.ws.send).toHaveBeenCalledTimes(2);
  });
});

describe("wavex Vite monorepo Convex discovery", () => {
  it("uses the repository's Convex directory for kinds, the bootstrap api import, and the watcher", async () => {
    const workspace = fixtureRoot("wavex-vite-monorepo-");
    writeFixture(workspace, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    writeFixture(workspace, "convex/_generated/api.js", "export const api = {};\n");
    const convexSource = writeFixture(workspace, "convex/tasks.ts", "export const list = query({});\nexport const create = mutation({});\n");
    const root = join(workspace, "packages/web");
    const pageFile = writeFixture(root, "src/pages/index.wx", "~~~\n$$tasks:create\n");
    const plugin = configuredPlugin(root);

    const manifest = plugin.load(plugin.resolveId("virtual:wavex/manifest")) as string;
    const bootstrap = plugin.load(plugin.resolveId("/@wavex/bootstrap")) as string;

    expect(manifest).toContain('"tasks:create":"mutation"');
    expect(bootstrap).toContain(`import { api as convexApi } from "/@fs${join(workspace, "convex/_generated/api.js").replace(/\\/g, "/")}";`);

    // Kinds come from the shared convex/: a bare mutation binding is rejected.
    const context = {
      addWatchFile: vi.fn(),
      warn: vi.fn(),
      error(error: { message: string }) {
        throw new Error(error.message);
      }
    };
    await expect(plugin.transform.call(context, "~~~\n$$tasks:create\n", pageFile)).rejects.toThrow(/WX102/);

    const { server, change, close } = createDevServer(root, new Map());
    plugin.configureServer(server);
    change(convexSource);
    close();

    expect(server.watcher.add).toHaveBeenCalledWith([join(root, "src/pages"), join(workspace, "convex")]);
    expect(server.ws.send).toHaveBeenCalledWith({ type: "full-reload", path: "*" });
  });
});

describe("wavex Vite self-hosted Font Awesome icons", () => {
  const svgFor = (name: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-icon="${name}"><path d="M0 0h1v1z"/></svg>`;

  function iconApp(prefix: string): string {
    const root = fixtureRoot(prefix);
    mkdirSync(join(root, "node_modules/@awesome.me"), { recursive: true });
    symlinkSync(installedWebAwesome, join(root, "node_modules/@awesome.me/webawesome"), "dir");
    for (const name of ["box", "truck-fast", "hourglass-half", "house", "bars", "plus", "minus", "gear"]) {
      writeFixture(root, `node_modules/@fortawesome/fontawesome-free/svgs/solid/${name}.svg`, svgFor(name));
    }
    return root;
  }

  function buildPlugin(root: string) {
    const plugin = wavex() as any;
    plugin.configResolved({ root, base: "/", command: "build", build: { assetsDir: "assets" } });
    return plugin;
  }

  function pluginContext() {
    return {
      addWatchFile: vi.fn(),
      warn: vi.fn(),
      emitFile: vi.fn(),
      error(error: string | { message: string }) {
        throw new Error(typeof error === "string" ? error : error.message);
      }
    };
  }

  const pageSource = "~~~\n@page\n  @icon name:box\n  @icon name:{{ done ? 'truck-fast' : 'hourglass-half' }}\n";

  it("points Web Awesome at the app before its components load and emits exactly the collected icons", async () => {
    const root = iconApp("wavex-vite-icons-build-");
    const pageFile = writeFixture(root, "src/pages/index.wx", pageSource);
    writeFixture(root, "src/labels.ts", 'import { icon } from "@wavex/runtime";\nexport const HOME = icon("house");\n');
    const plugin = buildPlugin(root);
    const context = pluginContext();

    const code = (await plugin.transform.call(context, pageSource, pageFile)).code as string;
    const iconsModule = await plugin.load(plugin.resolveId("virtual:wavex/icons"));
    await plugin.buildStart.call(context);
    plugin.generateBundle.call(context);

    const iconsImport = code.indexOf('import "virtual:wavex/icons";');
    expect(iconsImport).toBeGreaterThanOrEqual(0);
    expect(iconsImport).toBeLessThan(code.indexOf('import "@awesome.me/webawesome/dist/components/icon/icon.js";'));
    expect(iconsImport).toBeLessThan(code.indexOf('import "@awesome.me/webawesome/dist/components/page/page.js";'));
    expect(iconsModule).toContain('import { setIconPath } from "@awesome.me/webawesome/dist/utilities/base-path.js";');
    expect(iconsModule).toContain('setIconPath(import.meta.env.BASE_URL + "assets/wavex-icons");');
    // Template literals, value-position literals, the TS declaration, and
    // Web Awesome's own default-library icons (<wa-page>'s bars) — not gear.
    expect(context.emitFile.mock.calls.map(([file]) => file.fileName).sort()).toEqual([
      "assets/wavex-icons/solid/bars.svg",
      "assets/wavex-icons/solid/box.svg",
      "assets/wavex-icons/solid/hourglass-half.svg",
      "assets/wavex-icons/solid/house.svg",
      "assets/wavex-icons/solid/minus.svg",
      "assets/wavex-icons/solid/plus.svg",
      "assets/wavex-icons/solid/truck-fast.svg"
    ]);
    expect(String(context.emitFile.mock.calls.find(([file]) => file.fileName.endsWith("/box.svg"))![0].source)).toContain('data-icon="box"');
  });

  it("fails on unknown icons in templates and in icon() declarations", async () => {
    const root = iconApp("wavex-vite-icons-unknown-");
    const pageFile = writeFixture(root, "src/pages/index.wx", "~~~\n@icon name:trck\n");
    writeFixture(root, "src/labels.ts", 'import { icon } from "@wavex/runtime";\nexport const HOME = icon("hose");\nexport const ANY = icon(name);\n');
    const plugin = buildPlugin(root);

    await expect(plugin.transform.call(pluginContext(), "~~~\n@icon name:trck\n", pageFile)).rejects.toThrow(
      /WX103 2:12 Unknown Font Awesome icon "trck"/
    );
    await expect(plugin.buildStart.call(pluginContext())).rejects.toThrow(
      /src\/labels\.ts:2:21 ERROR WX103 [\s\S]*"hose"[\s\S]*src\/labels\.ts:3:20 ERROR WX104/
    );
  });

  it("serves collected icons in dev, 404s uncollected ones with a clear error, and recollects after edits", async () => {
    const root = iconApp("wavex-vite-icons-dev-");
    writeFixture(root, "src/pages/index.wx", pageSource);
    const labels = writeFixture(root, "src/labels.ts", 'import { icon } from "@wavex/runtime";\nexport const HOME = icon("house");\n');
    const plugin = configuredPlugin(root);
    const { server, change } = createDevServer(root, new Map());

    await plugin.configureServer(server);
    const handler = server.middlewares.use.mock.calls[0]![0] as (req: unknown, res: unknown, next: () => void) => void;
    const request = (url: string) => {
      const response = { statusCode: 200, headers: {} as Record<string, string>, body: "" as unknown, setHeader: vi.fn(), end: vi.fn() };
      response.setHeader.mockImplementation((name: string, value: string) => (response.headers[name] = value));
      response.end.mockImplementation((body?: unknown) => (response.body = body));
      const next = vi.fn();
      handler({ url }, response, next);
      return { ...response, next };
    };

    const box = request("/assets/wavex-icons/solid/box.svg?v=1");
    expect(box.statusCode).toBe(200);
    expect(box.headers["Content-Type"]).toBe("image/svg+xml");
    expect(String(box.body)).toContain('data-icon="box"');
    expect(request("/assets/wavex-icons/solid/bars.svg").statusCode).toBe(200);

    const gear = request("/assets/wavex-icons/solid/gear.svg");
    expect(gear.statusCode).toBe(404);
    expect(server.config.logger.error).toHaveBeenCalledWith(expect.stringContaining('icon("gear")'));

    expect(request("/src/main.ts").next).toHaveBeenCalled();

    writeFileSync(labels, 'import { icon } from "@wavex/runtime";\nexport const HOME = icon("house");\nexport const SETTINGS = icon("gear");\n');
    change(labels);
    expect(request("/assets/wavex-icons/solid/gear.svg").statusCode).toBe(200);
  });

  it("keeps Web Awesome's default CDN icons when no Font Awesome package ships SVG files", async () => {
    const root = fixtureRoot("wavex-vite-icons-cdn-");
    mkdirSync(join(root, "node_modules/@awesome.me"), { recursive: true });
    symlinkSync(installedWebAwesome, join(root, "node_modules/@awesome.me/webawesome"), "dir");
    writeFixture(root, "node_modules/@fortawesome/free-solid-svg-icons/index.js", "export {};\n");
    const pageFile = writeFixture(root, "src/pages/index.wx", pageSource);
    const plugin = configuredPlugin(root);
    const { server } = createDevServer(root, new Map());

    const code = (await plugin.transform.call(pluginContext(), pageSource, pageFile)).code as string;
    const iconsModule = await plugin.load(plugin.resolveId("virtual:wavex/icons"));
    await plugin.configureServer(server);

    expect(code).not.toContain("virtual:wavex/icons");
    expect(code).toContain('import "@awesome.me/webawesome/dist/components/icon/icon.js";');
    expect(iconsModule).toContain("export {};");
    expect(iconsModule).not.toContain("setIconPath");
    expect(server.middlewares.use).not.toHaveBeenCalled();
  });
});
