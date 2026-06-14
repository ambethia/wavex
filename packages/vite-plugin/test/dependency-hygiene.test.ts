import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const vitePlusCoreSpecifier = "npm:@voidzero-dev/vite-plus-core@0.1.24";
const vitePlusTestSpecifier = "npm:@voidzero-dev/vite-plus-test@0.1.24";

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function readText(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function workspacePackageJsonPaths(dir = repoRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".agents", "dist", "node_modules"].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return workspacePackageJsonPaths(path);
    return entry.name === "package.json" ? [path] : [];
  });
}

describe("dependency hygiene", () => {
  it("keeps the workspace Vite+ aliases pinned and compatible with the vite plugin peer", () => {
    const rootPackage = readJson("package.json");
    const pluginPackage = readJson("packages/vite-plugin/package.json");

    expect(rootPackage.pnpm.overrides).toMatchObject({
      vite: vitePlusCoreSpecifier,
      vitest: vitePlusTestSpecifier
    });
    expect(rootPackage.devDependencies.vite).toBe(vitePlusCoreSpecifier);
    expect(rootPackage.devDependencies.vitest).toBe(vitePlusTestSpecifier);
    expect(rootPackage.devDependencies["vite-plus"]).toBe("0.1.24");
    expect(rootPackage.pnpm.peerDependencyRules.allowedVersions).toMatchObject({
      vite: "0.1.24",
      vitest: "0.1.24"
    });

    const vitePeer = pluginPackage.peerDependencies.vite;
    expect(vitePeer).toContain(">=5.0.0");
    expect(vitePeer).toContain("^0.1.24");
    expect(vitePeer).not.toBe(">=5.0.0");
  });

  it("declares the runtime peer required by compiler-generated modules", () => {
    const compilerPackage = readJson("packages/compiler/package.json");

    expect(compilerPackage.peerDependencies).toMatchObject({
      "@wavex/runtime": "workspace:*",
      lit: ">=3.0.0"
    });
  });

  it("keeps committed manifests reproducible and installable without commercial registry tokens", () => {
    for (const packageJsonPath of workspacePackageJsonPaths()) {
      const relativePath = packageJsonPath.slice(repoRoot.length + 1);
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, Record<string, string> | undefined>;
      for (const dependencyBlock of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
        for (const [name, specifier] of Object.entries(manifest[dependencyBlock] ?? {})) {
          expect({ package: relativePath, dependencyBlock, name, specifier }).not.toMatchObject({ specifier: "latest" });
          expect({ package: relativePath, dependencyBlock, name, specifier }).not.toMatchObject({ specifier: expect.stringContaining("@latest") });
        }
      }
    }

    const todoPackage = readJson("apps/todo/package.json");
    const swellPackage = readJson("apps/swell/package.json");
    expect(todoPackage.dependencies).toMatchObject({ "@awesome.me/webawesome": "3.8.0" });
    expect(swellPackage.dependencies).toMatchObject({ "@awesome.me/webawesome": "3.8.0" });
    expect(Object.keys(todoPackage.dependencies)).not.toContain("@awesome.me/kit-bb4fac79fe");
    expect(Object.keys(swellPackage.dependencies)).not.toContain("@awesome.me/kit-bb4fac79fe");
    expect(Object.keys(todoPackage.dependencies)).not.toContain("@web.awesome.me/webawesome-pro");
    expect(Object.keys(swellPackage.dependencies)).not.toContain("@web.awesome.me/webawesome-pro");

    expect(readText(".npmrc")).not.toMatch(/NPM_TOKEN|npm\.fontawesome\.com|webawesome-pro/);
    expect(readText("README.md")).toMatch(/A fresh clone installs without Font Awesome or Web Awesome commercial registry\s+tokens/);
    expect(readText("pnpm-lock.yaml")).not.toMatch(/@awesome\.me\/kit-bb4fac79fe|@web\.awesome\.me\/webawesome-pro/);
  });
});
