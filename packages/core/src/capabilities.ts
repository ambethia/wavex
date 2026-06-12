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
      components: readManifestComponents(join(packageDir, "dist", "custom-elements.json"))
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
