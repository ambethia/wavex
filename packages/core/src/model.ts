/**
 * Fixed directory layout of a WAVEx app. The structure is framework law, not
 * configuration: routes live in `src/pages`, reusable template components in
 * `src/components`, Convex functions in `convex`, static assets in `public`.
 */
export interface WavexConfig {
  sourceDir: string;
  pagesDir: string;
  componentsDir: string;
  apiDir: string;
  publicDir: string;
}

/** A file-derived route: `src/pages/tasks/[id].wx` → `/tasks/:id`. */
export interface RouteDefinition {
  id: string;
  file: string;
  path: string;
  segments: RouteSegment[];
}

/** One path segment: static text, a `[param]`, or a `[...splat]` catch-all. */
export type RouteSegment =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "splat"; name: string };

/**
 * A structured problem report with a 1-based source position. The parser and
 * compiler collect diagnostics instead of throwing, so tooling (CLI, LSP,
 * Vite plugin) can surface every problem in a file at once.
 */
export interface Diagnostic {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
}

/**
 * Known component names used by {@link componentReferenceToTag} to resolve
 * `@name` references. When omitted, a built-in set of common Web Awesome
 * component names is used; real projects should pass names detected by
 * `@wavex/core/capabilities`.
 */
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
  "divider",
  "dropdown",
  "icon",
  "input",
  "page",
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

/** The standard WAVEx app layout (see {@link WavexConfig}). */
export function createDefaultConfig(): WavexConfig {
  return {
    sourceDir: "src",
    pagesDir: "src/pages",
    componentsDir: "src/components",
    apiDir: "convex",
    publicDir: "public"
  };
}

export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Derive a route path from a page file path, or undefined for non-routable
 * files (`+layout.wx`, `+error.wx`, non-`.wx` files). `index.wx` maps to the
 * directory path, `[id]` to `:id`, and `[...slug]` to `*slug`.
 */
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

/** Build a full {@link RouteDefinition} from a page file path, or undefined if the file is not routable. */
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

export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
}

/**
 * Match a pathname against route definitions using the same segment
 * semantics as createRouteDefinition. Static segments win over params,
 * params win over splats; among equals the more specific (longer static
 * prefix) route wins.
 */
export function matchRoutePath(routes: readonly RouteDefinition[], pathname: string): RouteMatch | undefined {
  const parts = pathname.split("?")[0]!.split("/").filter(Boolean).map(decodeURIComponentSafe);
  let best: { match: RouteMatch; score: number } | undefined;

  for (const route of routes) {
    const result = matchSegments(route.segments, parts);
    if (!result) continue;
    if (!best || result.score > best.score) {
      best = { match: { route, params: result.params }, score: result.score };
    }
  }

  return best?.match;
}

function matchSegments(
  segments: readonly RouteSegment[],
  parts: readonly string[]
): { params: Record<string, string>; score: number } | undefined {
  const params: Record<string, string> = {};
  let score = 0;
  let index = 0;

  for (const segment of segments) {
    if (segment.kind === "splat") {
      params[segment.name] = parts.slice(index).join("/");
      // A splat consumes everything that remains (including nothing).
      return { params, score: score + 1 };
    }
    const part = parts[index];
    if (part === undefined) return undefined;
    if (segment.kind === "static") {
      if (part !== segment.value) return undefined;
      score += 3;
    } else {
      params[segment.name] = part;
      score += 2;
    }
    index += 1;
  }

  return index === parts.length ? { params, score } : undefined;
}

/** Parse a search string into a flat record; the first occurrence of a repeated key wins. */
export function parseQueryString(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)) {
    if (!(key in query)) query[key] = value;
  }
  return query;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Infer the template binding name for a `$$module:function` Convex resource.
 * The rules are intentionally simple: the last module path segment is the
 * base name; collection-style functions (`list`, `all`, `search`, …) bind
 * plural, singleton-style functions (`get`, `byId`, `me`, …) bind singular.
 * `as:name` in the template overrides the inference on collisions.
 */
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

/**
 * Expand one `[utility]` token to its class name. This is plain `wa-` prefix
 * expansion by design — there is no semantic mapping table or `name:value`
 * utility grammar, so `[stack gap-xl]` is exactly `wa-stack wa-gap-xl`.
 */
export function expandUtilityToken(token: string): string {
  const normalized = token.trim();
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

/**
 * Resolve an `@name` component reference to a custom-element tag.
 *
 * Lookup order: local `src/components/` templates first, then Web Awesome —
 * local components intentionally shadow Web Awesome components without
 * warning, so an app can define its own `card.wx` that wraps `<wa-card>`.
 * Explicit prefixes bypass the lookup: `@wa/card` always means `<wa-card>`,
 * `@components/card` always means the local component.
 */
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

/** Render a diagnostic as a single `SEVERITY code line:column message` line for CLI/log output. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`;
}

function toSet(values: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  return values instanceof Set ? values : new Set(values ?? []);
}

/**
 * Top-level keys of a component's `type Attrs = { ... }` (or `interface Attrs`)
 * prelude declaration. Components declaring Attrs get each attribute as a bare,
 * typed local in their template. Returns undefined when no Attrs is declared.
 */
export function extractAttrsTypeKeys(prelude: string): string[] | undefined {
  const head = /(?:type\s+Attrs\s*=\s*|interface\s+Attrs\s*(?:extends\s+[^{]+)?)\{/.exec(prelude);
  if (!head) return undefined;

  let depth = 1;
  let body = "";
  for (let index = head.index + head[0].length; index < prelude.length && depth > 0; index += 1) {
    const char = prelude[index]!;
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (depth > 0) body += char;
  }

  const keys: string[] = [];
  let nested = 0;
  let segment = "";
  const flush = () => {
    const match = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(segment);
    if (match) keys.push(match[1]!);
    segment = "";
  };
  for (const char of body) {
    if (char === "{" || char === "(" || char === "[" || char === "<") nested += 1;
    else if (char === "}" || char === ")" || char === "]" || char === ">") nested = Math.max(0, nested - 1);
    if (nested === 0 && (char === ";" || char === "\n" || char === ",")) {
      flush();
      continue;
    }
    segment += char;
  }
  flush();
  return keys;
}
