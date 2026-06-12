import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ComponentNode, TemplateNode, WavexFile } from "./ast.js";
import type { Diagnostic } from "./model.js";
import { toKebabCase } from "./model.js";

export interface WebAwesomeCapability {
  /** Installed package name, e.g. "@web.awesome.me/webawesome-pro" or "@awesome.me/webawesome". */
  packageName: string;
  pro: boolean;
  /** Component names without the wa- prefix, from the package's custom-elements.json. */
  components: ReadonlySet<string>;
  /** Installed package directory (for manifest details and stylesheet scans). */
  packageDir: string;
}

export interface FontAwesomeCapability {
  /** Installed kit packages (@awesome.me/kit-*). */
  kits: readonly string[];
  /** Installed @fortawesome/* packages. */
  packages: readonly string[];
}

export interface ProjectCapabilities {
  webAwesome?: WebAwesomeCapability;
  fontAwesome: FontAwesomeCapability;
}

const WEB_AWESOME_PACKAGES = [
  { name: "@web.awesome.me/webawesome-pro", pro: true },
  { name: "@awesome.me/webawesome", pro: false }
] as const;

/** Detect installed Web Awesome / Font Awesome capabilities from an app root. */
export function detectCapabilities(root: string): ProjectCapabilities {
  let webAwesome: WebAwesomeCapability | undefined;
  for (const candidate of WEB_AWESOME_PACKAGES) {
    const packageDir = join(root, "node_modules", ...candidate.name.split("/"));
    if (!existsSync(packageDir)) continue;
    webAwesome = {
      packageName: candidate.name,
      pro: candidate.pro,
      components: readManifestComponents(join(packageDir, "dist", "custom-elements.json")),
      packageDir
    };
    break;
  }

  return { webAwesome, fontAwesome: detectFontAwesome(root) };
}

function detectFontAwesome(root: string): FontAwesomeCapability {
  const kits: string[] = [];
  const packages: string[] = [];
  const awesomeMe = join(root, "node_modules", "@awesome.me");
  if (existsSync(awesomeMe)) {
    for (const entry of readdirSync(awesomeMe)) {
      if (entry.startsWith("kit-")) kits.push(`@awesome.me/${entry}`);
    }
  }
  const fortawesome = join(root, "node_modules", "@fortawesome");
  if (existsSync(fortawesome)) {
    for (const entry of readdirSync(fortawesome)) packages.push(`@fortawesome/${entry}`);
  }
  return { kits, packages };
}

/** Parse component names (without wa- prefix) from a custom-elements.json manifest. */
export function readManifestComponents(manifestPath: string): ReadonlySet<string> {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      modules?: Array<{ declarations?: Array<{ tagName?: string }> }>;
    };
    const components = new Set<string>();
    for (const module of manifest.modules ?? []) {
      for (const declaration of module.declarations ?? []) {
        if (declaration.tagName?.startsWith("wa-")) components.add(declaration.tagName.slice(3));
      }
    }
    return components;
  } catch {
    return new Set();
  }
}

export function walkTemplateNodes(nodes: readonly TemplateNode[], visit: (node: TemplateNode) => void): void {
  for (const node of nodes) {
    visit(node);
    walkTemplateNodes(node.children, visit);
  }
}

export interface ComponentValidationOptions {
  localComponents?: readonly string[];
  webAwesome?: Pick<WebAwesomeCapability, "packageName" | "components">;
  fontAwesome?: FontAwesomeCapability;
}

/** Capability diagnostics for component/icon references in a parsed .wx file. */
export function validateComponentReferences(file: WavexFile, options: ComponentValidationOptions): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const locals = new Set(options.localComponents ?? []);
  const webAwesome = options.webAwesome;
  const hasFontAwesome =
    (options.fontAwesome?.kits.length ?? 0) > 0 || (options.fontAwesome?.packages.length ?? 0) > 0;

  walkTemplateNodes(file.nodes, (node) => {
    if (node.kind !== "component") return;
    const component = node as ComponentNode;
    const normalized = component.reference.replace(/^@/, "").replace(/^\/+|\/+$/g, "");

    if (normalized.startsWith("wa/")) {
      const name = toKebabCase(normalized.slice(3));
      if (!webAwesome) {
        diagnostics.push(capabilityDiagnostic(component, `@${normalized} requires a Web Awesome package, but none is installed.`));
      } else if (!webAwesome.components.has(name)) {
        diagnostics.push(
          capabilityDiagnostic(component, `@${normalized} does not match a component in ${webAwesome.packageName} (no <wa-${name}>).`)
        );
      }
      return;
    }

    if (normalized === "icon" && webAwesome && !hasFontAwesome) {
      diagnostics.push({
        ...capabilityDiagnostic(
          component,
          "@icon uses Web Awesome's bundled Font Awesome free icons; install a Font Awesome kit or package for Pro icon families."
        ),
        severity: "info"
      });
      return;
    }

    if (locals.has(normalized) || normalized.includes("/")) return;
    const kebab = toKebabCase(normalized);
    if (webAwesome?.components.has(kebab)) return;

    const hint = webAwesome
      ? `no src/components/${normalized}.wx and no <wa-${kebab}> in ${webAwesome.packageName}`
      : `no src/components/${normalized}.wx and no Web Awesome package is installed`;
    diagnostics.push(capabilityDiagnostic(component, `Unknown component @${normalized}: ${hint}.`));
  });

  return diagnostics;
}

function capabilityDiagnostic(node: ComponentNode, message: string): Diagnostic {
  return {
    code: "WX101",
    severity: "error",
    line: node.range.start.line,
    column: node.range.start.column,
    message
  };
}

/**
 * Classify public Convex functions by scanning convex/ sources
 * ("module/path:fn" -> kind). Shared by the Vite plugin (semantic event
 * dispatch) and the LSP (completions).
 */
export function discoverConvexFunctionKinds(root: string): Record<string, "query" | "mutation" | "action"> {
  const convexDir = join(root, "convex");
  const kinds: Record<string, "query" | "mutation" | "action"> = {};
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "_generated" && entry.name !== "node_modules") walk(path);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
      const modulePath = path.slice(convexDir.length + 1).replace(/\\/g, "/").replace(/\.ts$/, "");
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/export\s+const\s+(\w+)\s*=\s*(query|mutation|action)\s*\(/g)) {
        kinds[`${modulePath}:${match[1]}`] = match[2] as "query" | "mutation" | "action";
      }
    }
  };
  walk(convexDir);
  return kinds;
}

/** Local component references discovered from src/components (e.g. "talk-card", "tasks/item"). */
export function discoverLocalComponents(root: string): string[] {
  const componentsDir = join(root, "src", "components");
  const components: string[] = [];
  const walk = (dir: string, prefix: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, prefix ? `${prefix}/${entry.name}` : entry.name);
      else if (entry.isFile() && entry.name.endsWith(".wx")) {
        const name = entry.name.replace(/\.wx$/, "");
        components.push(prefix ? `${prefix}/${name}` : name);
      }
    }
  };
  walk(componentsDir, "");
  return components.sort();
}

export interface WebAwesomeAttribute {
  name: string;
  description?: string;
  type?: string;
  default?: string;
}

export interface WebAwesomeComponentDetail {
  /** Component name without the wa- prefix. */
  name: string;
  summary?: string;
  attributes: WebAwesomeAttribute[];
  slots: Array<{ name: string; description?: string }>;
}

/** Full component metadata (descriptions, attributes, slots) from custom-elements.json. */
export function readManifestComponentDetails(manifestPath: string): Map<string, WebAwesomeComponentDetail> {
  const details = new Map<string, WebAwesomeComponentDetail>();
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      modules?: Array<{
        declarations?: Array<{
          tagName?: string;
          summary?: string;
          description?: string;
          attributes?: Array<{ name?: string; description?: string; type?: { text?: string }; default?: string }>;
          slots?: Array<{ name?: string; description?: string }>;
        }>;
      }>;
    };
    for (const module of manifest.modules ?? []) {
      for (const declaration of module.declarations ?? []) {
        if (!declaration.tagName?.startsWith("wa-")) continue;
        const name = declaration.tagName.slice(3);
        details.set(name, {
          name,
          summary: declaration.summary ?? declaration.description,
          attributes: (declaration.attributes ?? []).flatMap((attribute) =>
            attribute.name ? [{ name: attribute.name, description: attribute.description, type: attribute.type?.text, default: attribute.default }] : []
          ),
          slots: (declaration.slots ?? []).flatMap((slot) =>
            slot.name !== undefined ? [{ name: slot.name, description: slot.description }] : []
          )
        });
      }
    }
  } catch {
    // missing or malformed manifest: no details
  }
  return details;
}

/** Utility class suffixes (wa-stack -> "stack") scraped from the installed package's stylesheets. */
export function readUtilityClasses(packageDir: string): string[] {
  const utilities = new Set<string>();
  const styleDirs = [join(packageDir, "dist", "styles"), join(packageDir, "dist", "styles", "utilities")];
  for (const dir of styleDirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
      const css = readFileSync(join(dir, entry.name), "utf8");
      // Literal classes (.wa-gap-xl) and attribute-selector families
      // ([class*='wa-cluster']) — layout primitives only appear as the latter.
      for (const match of css.matchAll(/\.wa-([a-z0-9][a-z0-9-]*)/g)) {
        utilities.add(match[1]!);
      }
      for (const match of css.matchAll(/\[class[*^|~]?='wa-([a-z0-9][a-z0-9-]*)'\]/g)) {
        utilities.add(match[1]!);
      }
    }
  }
  return [...utilities].sort();
}
