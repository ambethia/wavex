import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Attribute, ComponentNode, WavexFile } from "./ast.js";
import { componentReferenceToTag, type Diagnostic } from "./model.js";
import { parseWavex, type ParseWavexOptions } from "./parser.js";
import { maskTypeScriptNonCode } from "./typescript-mask.js";

/**
 * One installed Font Awesome package WAVEx can serve SVG icons from: a kit
 * (`@awesome.me/kit-*`, SVGs under `icons/svgs/`) or an SVG package such as
 * `@fortawesome/fontawesome-free` / `fontawesome-pro` (under `svgs/`). Both
 * lay icons out as `<folder>/<name>.svg` with Font Awesome's folder names
 * (`solid`, `regular`, `brands`, `sharp-solid`, `duotone`, …).
 */
export interface FontAwesomeIconSource {
  packageName: string;
  /** Directory containing the `<folder>/<name>.svg` files. */
  svgDir: string;
}

/**
 * A Font Awesome icon an app uses, as written: from a literal `@icon name:`,
 * a string literal in a value position of a dynamic `name:{{ … }}`
 * expression, or an `icon("…")` declaration imported from `@wavex/runtime`.
 * `family`/`variant` are undefined when the source leaves them to Web
 * Awesome's defaults (`classic`/`solid`). `line`/`column` are 1-based in the
 * file that references the icon.
 */
export interface IconReference {
  name: string;
  family?: string;
  variant?: string;
  line: number;
  column: number;
}

/**
 * Maps an icon to its Font Awesome folder — Web Awesome's own
 * `getIconFolder(name, family, variant)`, loaded from the installed package by
 * {@link loadWebAwesomeIconFolder} so WAVEx serves exactly the URLs Web
 * Awesome's default icon library requests.
 */
export type IconFolderResolver = (name: string, family: string, variant: string) => string;

/** An icon resolved to the SVG file that serves it. */
export interface IconAsset {
  /** Font Awesome folder, e.g. "solid" or "sharp-regular". */
  folder: string;
  name: string;
  /** Absolute path of the SVG in the installed Font Awesome package. */
  file: string;
}

/** Web Awesome's default family/variant, applied when `@icon` leaves them unset. */
const DEFAULT_FAMILY = "classic";
const DEFAULT_VARIANT = "solid";

/**
 * Installed Font Awesome SVG sources in deterministic lookup order: kits
 * (sorted), then `@fortawesome/*` packages that ship an `svgs/` directory
 * (sorted). JS-only `*-svg-icons` packages have no SVG files and are not
 * sources.
 */
export function detectFontAwesomeIconSources(root: string, kits: readonly string[], packages: readonly string[]): FontAwesomeIconSource[] {
  const sources: FontAwesomeIconSource[] = [];
  for (const packageName of [...kits].sort()) {
    const svgDir = join(root, "node_modules", ...packageName.split("/"), "icons", "svgs");
    if (existsSync(svgDir)) sources.push({ packageName, svgDir });
  }
  for (const packageName of [...packages].sort()) {
    const svgDir = join(root, "node_modules", ...packageName.split("/"), "svgs");
    if (existsSync(svgDir)) sources.push({ packageName, svgDir });
  }
  return sources;
}

/**
 * Load Web Awesome's `getIconFolder` from the installed package
 * (`dist/components/icon/library.default.js`). It is the source of truth for
 * the folder the default icon library requests — including Pro+ families —
 * so WAVEx does not replicate the mapping. Throws when the installed Web
 * Awesome predates `setIconPath`/`getIconFolder` (3.8).
 */
export async function loadWebAwesomeIconFolder(webAwesomePackageDir: string): Promise<IconFolderResolver> {
  const modulePath = join(webAwesomePackageDir, "dist", "components", "icon", "library.default.js");
  let module: { getIconFolder?: unknown };
  try {
    module = (await import(pathToFileURL(modulePath).href)) as { getIconFolder?: unknown };
  } catch (error) {
    throw new Error(
      `Cannot load Web Awesome's icon folder mapping from ${modulePath}; self-hosting Font Awesome icons requires Web Awesome 3.8 or later. ${String(error)}`
    );
  }
  if (typeof module.getIconFolder !== "function") {
    throw new Error(
      `${modulePath} does not export getIconFolder; self-hosting Font Awesome icons requires Web Awesome 3.8 or later.`
    );
  }
  const getIconFolder = module.getIconFolder as IconFolderResolver;
  return (name, family, variant) => getIconFolder(name, family, variant);
}

/** Resolve an icon to its SVG file: the first icon source that has `<folder>/<name>.svg`. */
export function resolveIconAsset(
  icon: Pick<IconReference, "name" | "family" | "variant">,
  folderOf: IconFolderResolver,
  sources: readonly FontAwesomeIconSource[]
): IconAsset | undefined {
  const folder = iconFolder(icon, folderOf);
  if (!isIconPathSegment(folder) || !isIconPathSegment(icon.name)) return undefined;
  for (const source of sources) {
    const file = join(source.svgDir, folder, `${icon.name}.svg`);
    if (existsSync(file)) return { folder, name: icon.name, file };
  }
  return undefined;
}

/** The Font Awesome folder for an icon, applying Web Awesome's family/variant defaults. */
export function iconFolder(icon: Pick<IconReference, "name" | "family" | "variant">, folderOf: IconFolderResolver): string {
  return folderOf(icon.name, icon.family || DEFAULT_FAMILY, icon.variant ?? DEFAULT_VARIANT);
}

/** WX103 diagnostics for icons that no installed Font Awesome source provides. */
export function validateIconReferences(
  icons: readonly IconReference[],
  folderOf: IconFolderResolver,
  sources: readonly FontAwesomeIconSource[]
): Diagnostic[] {
  const packages = sources.map((source) => source.packageName).join(", ");
  return icons.flatMap((icon) => {
    if (resolveIconAsset(icon, folderOf, sources)) return [];
    const folder = iconFolder(icon, folderOf);
    const style = `${icon.family || DEFAULT_FAMILY}/${icon.variant ?? DEFAULT_VARIANT}`;
    return [
      {
        code: "WX103",
        severity: "error" as const,
        line: icon.line,
        column: icon.column,
        message: `Unknown Font Awesome icon "${icon.name}" (${style}): ${packages} has no ${folder}/${icon.name}.svg.`
      }
    ];
  });
}

/**
 * Icons a parsed `.wx` file uses through Web Awesome's default icon library:
 * `@icon` / `@wa/icon` heads (not a local `icon.wx`, not another `library:`)
 * whose `name:` is a literal, plus the string literals that can be the value
 * of a dynamic `name:{{ … }}` expression (ternary branches, `||`/`??`
 * operands, the last `&&` operand — never comparison operands), with the
 * element's literal `family:`/`variant:`. Elements whose family or variant is
 * dynamic cannot be collected; declare those icons with `icon()` instead.
 * `icon("…")` declarations in the prelude are collected too.
 */
export function collectTemplateIcons(file: WavexFile, options: { localComponents?: readonly string[] } = {}): {
  icons: IconReference[];
  diagnostics: Diagnostic[];
} {
  const icons: IconReference[] = [];
  const visit = (nodes: WavexFile["nodes"]) => {
    for (const node of nodes) {
      if (node.kind === "component") icons.push(...iconsForComponent(node, options.localComponents ?? []));
      visit(node.children);
    }
  };
  visit(file.nodes);
  const declared = collectDeclaredIcons(file.prelude);
  return { icons: [...icons, ...declared.icons], diagnostics: declared.diagnostics };
}

function iconsForComponent(node: ComponentNode, localComponents: readonly string[]): IconReference[] {
  if (componentReferenceToTag(node.reference, { localComponents, webAwesomeComponents: ["icon"] }) !== "wa-icon") return [];
  const attribute = (name: string) => node.attributes.find((candidate) => candidate.name === name);
  const library = attribute("library");
  if (library && !(library.kind === "literal" && library.value === "default")) return [];
  const family = staticValue(attribute("family"));
  const variant = staticValue(attribute("variant"));
  if (family === DYNAMIC || variant === DYNAMIC) return [];

  const name = attribute("name");
  if (!name) return [];
  const location = name.valueRange?.start ?? name.range?.start ?? node.range.start;
  const names =
    name.kind === "literal" ? [name.value] : name.kind === "expression" ? expressionValueLiterals(name.expression) : [];
  return names
    .filter((value) => value !== "")
    .map((value) => ({ name: value, family, variant, line: location.line, column: location.column }));
}

const DYNAMIC = Symbol("dynamic");

function staticValue(attribute: Attribute | undefined): string | undefined | typeof DYNAMIC {
  if (!attribute) return undefined;
  if (attribute.kind === "literal") return attribute.value;
  if (attribute.kind === "expression") {
    const values = expressionValueLiterals(attribute.expression);
    return isSingleStringLiteral(attribute.expression) ? values[0] : DYNAMIC;
  }
  return DYNAMIC;
}

function isSingleStringLiteral(expression: string): boolean {
  return parseStringLiteral(stripOuterParens(expression.trim())) !== undefined;
}

/**
 * String literals that can be the value of a JavaScript expression: the
 * expression itself when it is a literal, both ternary branches, every `||` /
 * `??` operand, and the last `&&` operand, recursively. Conditions and
 * comparison operands are never values, so `status === 'done' ? 'box' : 'truck'`
 * yields `box` and `truck` only.
 */
export function expressionValueLiterals(expression: string): string[] {
  const text = stripOuterParens(expression.trim());
  if (!text) return [];
  const literal = parseStringLiteral(text);
  if (literal !== undefined) return [literal];
  // Font Awesome has digit icons ("0" … "9"); `@icon name:1` binds the number.
  if (/^\d+$/.test(text)) return [text];

  const question = findTopLevelTernary(text);
  if (question !== -1) {
    const colon = findTernaryColon(text, question + 1);
    if (colon === -1) return [];
    return [...expressionValueLiterals(text.slice(question + 1, colon)), ...expressionValueLiterals(text.slice(colon + 1))];
  }

  const fallbacks = splitTopLevel(text, ["||", "??"]);
  if (fallbacks.length > 1) return fallbacks.flatMap(expressionValueLiterals);
  const conjunction = splitTopLevel(text, ["&&"]);
  if (conjunction.length > 1) return expressionValueLiterals(conjunction.at(-1)!);
  return [];
}

function stripOuterParens(text: string): string {
  let current = text;
  while (current.startsWith("(") && current.endsWith(")") && closingIndex(current, 0) === current.length - 1) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

/** Parse a whole string literal ('…', "…", or a `…` template without substitutions). */
function parseStringLiteral(text: string): string | undefined {
  const quote = text[0];
  if (quote !== '"' && quote !== "'" && quote !== "`") return undefined;
  let value = "";
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === "\\") {
      value += text[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (quote === "`" && char === "$" && text[index + 1] === "{") return undefined;
    if (char === quote) return index === text.length - 1 ? value : undefined;
    value += char;
  }
  return undefined;
}

/** Walk `text` at depth 0 (outside strings and brackets), calling `visit` with each index. */
function scanTopLevel(text: string, visit: (index: number) => boolean | void): void {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(text, index);
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && visit(index) === true) return;
  }
}

function skipString(text: string, start: number): number {
  const quote = text[start];
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text[index] === quote) return index;
  }
  return text.length;
}

function closingIndex(text: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"' || char === "'" || char === "`") {
      index = skipString(text, index);
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** A `?` that starts a conditional expression (not `?.` optional chaining or `??`). */
function isTernaryQuestion(text: string, index: number): boolean {
  if (text[index] !== "?") return false;
  if (text[index + 1] === "?" || text[index - 1] === "?") return false;
  return !(text[index + 1] === "." && !/[0-9]/.test(text[index + 2] ?? ""));
}

function findTopLevelTernary(text: string): number {
  let found = -1;
  scanTopLevel(text, (index) => {
    if (isTernaryQuestion(text, index)) {
      found = index;
      return true;
    }
    return false;
  });
  return found;
}

function findTernaryColon(text: string, from: number): number {
  const rest = text.slice(from);
  let nested = 0;
  let found = -1;
  scanTopLevel(rest, (index) => {
    if (isTernaryQuestion(rest, index)) nested += 1;
    else if (rest[index] === ":") {
      if (nested === 0) {
        found = from + index;
        return true;
      }
      nested -= 1;
    }
    return false;
  });
  return found;
}

function splitTopLevel(text: string, operators: readonly string[]): string[] {
  const parts: string[] = [];
  let last = 0;
  let skipUntil = -1;
  scanTopLevel(text, (index) => {
    if (index < skipUntil) return false;
    const operator = operators.find((candidate) => text.startsWith(candidate, index));
    if (!operator) return false;
    // `??=`, `||=`, `&&=` are assignments, not operators on values.
    if (text[index + operator.length] === "=") return false;
    parts.push(text.slice(last, index));
    last = index + operator.length;
    skipUntil = last;
    return false;
  });
  parts.push(text.slice(last));
  return parts.map((part) => part.trim());
}

/**
 * `icon("…")` declarations in TypeScript/JavaScript source that imports
 * `icon` from `@wavex/runtime` (named, aliased, or through a namespace
 * import). Declarations must use string literals for the name and for any
 * `family`/`variant` option so WAVEx can collect them; other calls are
 * reported as WX104.
 */
export function collectDeclaredIcons(source: string): { icons: IconReference[]; diagnostics: Diagnostic[] } {
  const structural = maskTypeScriptNonCode(source);
  const callees = runtimeIconCallees(source, structural);
  const icons: IconReference[] = [];
  const diagnostics: Diagnostic[] = [];
  if (callees.length === 0) return { icons, diagnostics };

  for (const callee of callees) {
    const pattern = new RegExp(`(?<![\\w$.])${callee.replace(/[.$]/g, "\\$&")}\\s*\\(`, "g");
    for (const match of structural.matchAll(pattern)) {
      const callStart = match.index ?? 0;
      if (isDefinitionNotCall(structural, callStart, callStart + match[0].length - 1)) continue;
      const position = lineColumn(source, callStart);
      const declaration = parseIconCallArguments(source, callStart + match[0].length);
      if (declaration) icons.push({ ...declaration, ...position });
      else {
        diagnostics.push({
          code: "WX104",
          severity: "error",
          ...position,
          message: `${callee}() declarations need string literal arguments (icon("name", { family: "…", variant: "…" })) so WAVEx can collect and serve the icon.`
        });
      }
    }
  }
  return { icons: icons.sort(byPosition), diagnostics: diagnostics.sort(byPosition) };
}

/** `function icon(…)` or a method shorthand `icon(…) { … }` that happens to share the name. */
function isDefinitionNotCall(structural: string, nameStart: number, openParen: number): boolean {
  if (/\bfunction\s*\*?\s*$/.test(structural.slice(Math.max(0, nameStart - 16), nameStart))) return true;
  const close = closingIndex(structural, openParen);
  return close !== -1 && structural.slice(close + 1).trimStart().startsWith("{");
}

function byPosition(left: { line: number; column: number }, right: { line: number; column: number }): number {
  return left.line - right.line || left.column - right.column;
}

/** Local callee names for `icon` imported from `@wavex/runtime`: `icon`, an alias, or `ns.icon`. */
function runtimeIconCallees(source: string, structural: string): string[] {
  const callees: string[] = [];
  for (const match of source.matchAll(/\bimport\s+([^;'"()]*?)\s*\bfrom\s*(["'])([^"'\n]*)\2/g)) {
    // Skip matches that start inside a comment or string.
    if (structural.slice(match.index, match.index + "import".length) !== "import") continue;
    if (match[3] !== "@wavex/runtime") continue;
    const clause = match[1]!.trim();
    if (/^type\b/.test(clause)) continue;
    const namespace = /\*\s*as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (namespace) callees.push(`${namespace[1]}.icon`);
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? "";
    for (const entry of named.split(",")) {
      const [imported, local] = entry.trim().split(/\s+as\s+/);
      if (imported === "icon") callees.push(local?.trim() || "icon");
    }
  }
  return [...new Set(callees)];
}

/** Parse `"name"` or `"name", { family: "…", variant: "…" }` followed by `)`; undefined if not all literal. */
function parseIconCallArguments(source: string, start: number): Omit<IconReference, "line" | "column"> | undefined {
  let index = skipWhitespace(source, start);
  const name = readStringLiteral(source, index);
  if (!name) return undefined;
  index = skipWhitespace(source, name.end);
  let family: string | undefined;
  let variant: string | undefined;
  if (source[index] === ",") {
    index = skipWhitespace(source, index + 1);
    if (source[index] === "{") {
      const close = closingIndex(source, index);
      if (close === -1) return undefined;
      const options = parseLiteralOptions(source.slice(index + 1, close));
      if (!options) return undefined;
      ({ family, variant } = options);
      index = skipWhitespace(source, close + 1);
      if (source[index] === ",") index = skipWhitespace(source, index + 1);
    }
  }
  if (source[index] !== ")") return undefined;
  return { name: name.value, family, variant };
}

function parseLiteralOptions(body: string): { family?: string; variant?: string } | undefined {
  const options: { family?: string; variant?: string } = {};
  for (const entry of body.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const match = /^(["']?)(family|variant)\1\s*:\s*([\s\S]+)$/.exec(trimmed);
    if (!match) return undefined;
    const value = parseStringLiteral(match[3]!.trim());
    if (value === undefined) return undefined;
    options[match[2] as "family" | "variant"] = value;
  }
  return options;
}

function readStringLiteral(source: string, start: number): { value: string; end: number } | undefined {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== "`") return undefined;
  const end = skipString(source, start);
  const value = parseStringLiteral(source.slice(start, end + 1));
  return value === undefined ? undefined : { value, end: end + 1 };
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index]!)) index += 1;
  return index;
}

function lineColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/** Icons referenced by one app source file, plus its `icon()` declaration diagnostics. */
export interface SourceIcons {
  /** Absolute path of the `.wx` template or TypeScript/JavaScript file. */
  file: string;
  icons: IconReference[];
  diagnostics: Diagnostic[];
}

const DECLARATION_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Scan an app's `src/` for the icons it uses: `.wx` templates and preludes
 * ({@link collectTemplateIcons}) and `icon()` declarations in
 * TypeScript/JavaScript files ({@link collectDeclaredIcons}). Files without
 * icons or diagnostics are omitted. Pass the same parse options the compiler
 * uses so component heads parse identically.
 */
export function collectAppIcons(appRoot: string, parseOptions: Omit<ParseWavexOptions, "fileName"> = {}): SourceIcons[] {
  const results: SourceIcons[] = [];
  for (const file of listSourceFiles(join(appRoot, "src"))) {
    const source = readFileSync(file, "utf8");
    const found = file.endsWith(".wx")
      ? collectTemplateIcons(parseWavex(source, { ...parseOptions, fileName: file }), { localComponents: parseOptions.localComponents })
      : collectDeclaredIcons(source);
    if (found.icons.length > 0 || found.diagnostics.length > 0) results.push({ file, ...found });
  }
  return results;
}

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(path));
    else if (entry.isFile() && isIconSourceFile(entry.name)) files.push(path);
  }
  return files.sort();
}

/** Whether a file name is one {@link collectAppIcons} scans: a `.wx` template or a non-declaration TypeScript/JavaScript module. */
export function isIconSourceFile(fileName: string): boolean {
  if (fileName.endsWith(".wx")) return true;
  if (/\.d\.[mc]?ts$/.test(fileName)) return false;
  return DECLARATION_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function isIconPathSegment(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Icons Web Awesome's own components request from the default icon library
 * (for example `<wa-page>`'s `bars` navigation toggle): literal
 * `<wa-icon name="…">` tags without a `library` attribute in the installed
 * package's bundled component code. Setting an icon path redirects these too,
 * so a self-hosting app must serve them alongside its own icons.
 */
export function readWebAwesomeDefaultLibraryIcons(webAwesomePackageDir: string): Array<Pick<IconReference, "name" | "family" | "variant">> {
  const found = new Map<string, Pick<IconReference, "name" | "family" | "variant">>();
  for (const dir of [join(webAwesomePackageDir, "dist", "chunks"), join(webAwesomePackageDir, "dist", "components")]) {
    for (const file of listJavaScriptFiles(dir)) {
      const code = readFileSync(file, "utf8");
      if (!code.includes("<wa-icon")) continue;
      for (const match of code.matchAll(/<wa-icon\b([^>]*)>/g)) {
        const attributes = match[1]!;
        if (/\blibrary\s*=/.test(attributes)) continue;
        const name = /\bname="([a-z0-9-]+)"/.exec(attributes)?.[1];
        if (!name) continue;
        const family = /\bfamily="([a-z0-9-]+)"/.exec(attributes)?.[1];
        const variant = /\bvariant="([a-z0-9-]+)"/.exec(attributes)?.[1];
        found.set(`${family ?? ""}/${variant ?? ""}/${name}`, { name, family, variant });
      }
    }
  }
  return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function listJavaScriptFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files.sort();
}
