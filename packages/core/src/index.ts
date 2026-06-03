export interface WavexConfig {
  appDir: string;
  pagesDir: string;
  componentsDir: string;
  apiDir: string;
  publicDir: string;
}

export interface RouteDefinition {
  id: string;
  file: string;
  path: string;
  segments: RouteSegment[];
}

export type RouteSegment =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "splat"; name: string };

export interface Diagnostic {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
}

export interface ComponentResolutionOptions {
  localComponents?: ReadonlySet<string> | readonly string[];
  webAwesomeComponents?: ReadonlySet<string> | readonly string[];
}

const DEFAULT_WEB_AWESOME_COMPONENTS = new Set([
  "avatar",
  "badge",
  "button",
  "callout",
  "card",
  "checkbox",
  "dialog",
  "dropdown",
  "icon",
  "input",
  "option",
  "popover",
  "progress-bar",
  "radio",
  "select",
  "skeleton",
  "spinner",
  "textarea",
  "tooltip"
]);

const COLLECTION_FUNCTIONS = new Set(["all", "list", "many", "page", "paginate", "search"]);
const SINGLETON_FUNCTIONS = new Set(["byId", "get", "load", "me", "one"]);

export function createDefaultConfig(sourceDir = "src"): WavexConfig {
  return {
    appDir: sourceDir,
    pagesDir: `${sourceDir}/pages`,
    componentsDir: `${sourceDir}/components`,
    apiDir: "convex",
    publicDir: "public"
  };
}

export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function routePathFromPageFile(file: string, pagesDir = "src/pages"): string | undefined {
  const normalizedFile = normalizeSlashes(file);
  const normalizedPagesDir = normalizeSlashes(pagesDir).replace(/\/$/, "");
  let relative = normalizedFile.startsWith(`${normalizedPagesDir}/`)
    ? normalizedFile.slice(normalizedPagesDir.length + 1)
    : normalizedFile;

  if (!relative.endsWith(".wx")) return undefined;
  relative = relative.slice(0, -".wx".length);
  const parts = relative.split("/").filter(Boolean);
  const leaf = parts.at(-1);
  if (!leaf || leaf.startsWith("+")) return undefined;
  if (leaf === "index") parts.pop();

  const routeParts = parts.map((part) => {
    const splat = /^\[\.\.\.([^\]]+)\]$/.exec(part);
    if (splat) return `*${splat[1]}`;
    const param = /^\[([^\]]+)\]$/.exec(part);
    if (param) return `:${param[1]}`;
    return part;
  });

  return `/${routeParts.join("/")}`.replace(/\/+/g, "/");
}

export function routeSegmentsFromPath(path: string): RouteSegment[] {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(":")) return { kind: "param", name: segment.slice(1) };
      if (segment.startsWith("*")) return { kind: "splat", name: segment.slice(1) };
      return { kind: "static", value: segment };
    });
}

export function routeIdFromFile(file: string): string {
  return normalizeSlashes(file)
    .replace(/\.wx$/, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "") || "index";
}

export function createRouteDefinition(file: string, pagesDir = "src/pages"): RouteDefinition | undefined {
  const path = routePathFromPageFile(file, pagesDir);
  if (!path) return undefined;
  return {
    id: routeIdFromFile(file),
    file: normalizeSlashes(file),
    path,
    segments: routeSegmentsFromPath(path)
  };
}

export function inferResourceBindingName(modulePath: string, functionName: string): string {
  if (SINGLETON_FUNCTIONS.has(functionName)) return singularize(lastPathSegment(modulePath));
  if (COLLECTION_FUNCTIONS.has(functionName)) return pluralize(lastPathSegment(modulePath));
  return lastPathSegment(modulePath);
}

export function lastPathSegment(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function singularize(name: string): string {
  if (name.endsWith("ies")) return `${name.slice(0, -3)}y`;
  if (name.endsWith("ses")) return name.slice(0, -2);
  if (name.endsWith("s") && name.length > 1) return name.slice(0, -1);
  return name;
}

export function pluralize(name: string): string {
  if (name.endsWith("s")) return name;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

export function expandUtilityToken(token: string): string {
  const normalized = token.trim().replace(/:/g, "-");
  if (!normalized) return "";
  return normalized.startsWith("wa-") ? normalized : `wa-${normalized}`;
}

export function expandUtilityClassList(tokens: readonly string[]): string[] {
  return tokens.map(expandUtilityToken).filter(Boolean);
}

export function mergeClassNames(...values: Array<string | undefined | false | null>): string {
  return values
    .flatMap((value) => (value ? value.split(/\s+/) : []))
    .filter(Boolean)
    .join(" ");
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_.:/]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function componentReferenceToTag(reference: string, options: ComponentResolutionOptions = {}): string {
  const normalized = reference.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (normalized.startsWith("wa/")) return `wa-${toKebabCase(normalized.slice(3))}`;
  if (normalized.startsWith("components/")) return `wx-${toKebabCase(normalized.slice("components/".length))}`;

  const localComponents = toSet(options.localComponents);
  const webAwesomeComponents = options.webAwesomeComponents
    ? toSet(options.webAwesomeComponents)
    : DEFAULT_WEB_AWESOME_COMPONENTS;

  if (localComponents.has(normalized)) return `wx-${toKebabCase(normalized)}`;
  if (normalized.includes("/")) return `wx-${toKebabCase(normalized)}`;
  if (webAwesomeComponents.has(toKebabCase(normalized))) return `wa-${toKebabCase(normalized)}`;
  return `wx-${toKebabCase(normalized)}`;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`;
}

function toSet(values: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  return values instanceof Set ? values : new Set(values ?? []);
}
