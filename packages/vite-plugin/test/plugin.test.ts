import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wavex } from "../src/index.js";

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
    config: { root },
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

  it("generates the body bootstrap with app assets, action kinds, and configured view transitions", () => {
    const root = fixtureRoot("wavex-vite-bootstrap-");
    writeFixture(root, "src/style.css", "body { margin: 0; }\n");
    writeFixture(root, "convex/_generated/api.js", "export const api = {};\n");
    writeFixture(
      root,
      "convex/tasks.ts",
      'export const list = query({});\nexport const create = mutation({});\nexport const run = action({});\n'
    );
    const plugin = configuredPlugin(root, { viewTransitions: false });

    const bootstrapId = plugin.resolveId("/@wavex/bootstrap");
    const bootstrap = plugin.load(bootstrapId) as string;

    expect(bootstrapId).toBe("\0virtual:wavex/bootstrap");
    expect(bootstrap).toContain('import "/src/style.css";');
    expect(bootstrap).toContain('import { api as convexApi } from "/convex/_generated/api.js";');
    expect(bootstrap).toContain('const root = document.body;');
    expect(bootstrap).toContain('viewTransitions: false');
    expect(bootstrap).toContain('"tasks:create":"mutation"');
    expect(bootstrap).toContain('"tasks:run":"action"');
    expect(bootstrap).not.toContain('"tasks:list":"query"');
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
