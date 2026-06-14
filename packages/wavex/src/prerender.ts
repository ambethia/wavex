import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createDefaultConfig, createRouteDefinition, normalizeSlashes } from "@wavex/core";
import { readdirSync } from "node:fs";

export interface HeadEntryLike {
  tag: "title" | "meta" | "link";
  text?: string;
  attributes?: Record<string, string>;
}

interface PageModuleLike {
  default?: (context?: unknown) => unknown;
  render?: (context?: unknown) => unknown;
  resources?: readonly unknown[];
  headEntries?: (context?: unknown) => HeadEntryLike[];
}

/**
 * Prerender static routes (no params, no resources) into dist/<path>/index.html.
 * Uses the app's own Vite config (the wavex plugin) through ssrLoadModule, and
 * @lit-labs/ssr to stringify the composed Lit template. Prerendering is an
 * output optimization: the client bootstrap removes the prerendered DOM before
 * mounting the live app.
 */
export async function prerender(rootInput: string): Promise<void> {
  const root = resolve(rootInput);
  const distIndex = join(root, "dist", "index.html");
  if (!existsSync(distIndex)) {
    console.error(`wavex prerender: ${distIndex} not found — run the build first.`);
    process.exitCode = 1;
    return;
  }

  // Lit SSR needs the DOM shim globals before any component module loads.
  await import("@lit-labs/ssr/lib/install-global-dom-shim.js");
  const { render } = await import("@lit-labs/ssr");
  const { collectResult } = await import("@lit-labs/ssr/lib/render-result.js");
  const { composeLayoutRender } = await import("@wavex/runtime");
  const { createServer } = await import("vite");

  const server = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "error"
  });

  try {
    const config = createDefaultConfig();
    const pagesDir = join(root, config.pagesDir);
    const shell = readFileSync(distIndex, "utf8");
    let count = 0;

    for (const file of walkWxFiles(pagesDir)) {
      const relativeFile = normalizeSlashes(file.slice(root.length + 1));
      const route = createRouteDefinition(relativeFile, config.pagesDir);
      if (!route) continue;
      if (route.segments.some((segment) => segment.kind !== "static")) continue;

      const layoutFiles = layoutChain(route.file, config.pagesDir, root);
      const [page, ...layouts] = (await Promise.all(
        [route.file, ...layoutFiles].map((moduleFile) => server.ssrLoadModule(`/${moduleFile}`))
      )) as PageModuleLike[];

      const composed = composeLayoutRender(layouts as never[], page as never);
      if (composed.resources.length > 0) continue; // needs live data; not a static page

      const context = { route: { path: route.path, params: {}, query: {} } };
      const body = await collectResult(render(composed.render(context) as never));
      const head = composed.headEntries(context);
      const html = injectPrerender(shell, body, head);

      const outFile = route.path === "/" ? distIndex : join(root, "dist", ...route.path.split("/").filter(Boolean), "index.html");
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, html);
      console.log(`prerendered ${route.path} -> ${normalizeSlashes(outFile.slice(root.length + 1))}`);
      count += 1;
    }

    if (count === 0) console.log("wavex prerender: no static, resource-free routes to prerender.");
  } finally {
    await server.close();
  }
}

export function injectPrerender(shell: string, body: string, head: HeadEntryLike[]): string {
  const reconciledHead = reconcileHeadEntries(head);
  let html = insertPrerenderBody(stripPrerenderArtifacts(shell), body);
  html = removeConflictingShellHeadTags(html, reconciledHead.entries);

  if (reconciledHead.title) {
    const titleTag = `<title data-wx-head>${escapeHtml(reconciledHead.title.text ?? "")}</title>`;
    html = /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
      ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => titleTag)
      : insertBeforeHeadClose(html, titleTag);
  }

  const metaTags = reconciledHead.entries
    .map((entry) => {
      const attributes = Object.entries(entry.attributes ?? {})
        .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
        .join(" ");
      return `<${entry.tag} ${attributes} data-wx-head>`;
    })
    .join("");
  if (metaTags) html = insertBeforeHeadClose(html, metaTags);

  return html;
}

function reconcileHeadEntries(head: HeadEntryLike[]): { title?: HeadEntryLike; entries: HeadEntryLike[] } {
  const entries: HeadEntryLike[] = [];
  const keyedIndexes = new Map<string, number>();
  let title: HeadEntryLike | undefined;

  for (const entry of head) {
    if (entry.tag === "title") {
      title = entry;
      continue;
    }

    const key = headEntryKey(entry);
    if (!key) {
      entries.push(entry);
      continue;
    }

    const existingIndex = keyedIndexes.get(key);
    if (existingIndex === undefined) {
      keyedIndexes.set(key, entries.length);
      entries.push(entry);
    } else {
      entries[existingIndex] = entry;
    }
  }

  return { title, entries };
}

function headEntryKey(entry: HeadEntryLike): string | undefined {
  if (entry.tag === "meta") {
    const name = entry.attributes?.["name"];
    const property = entry.attributes?.["property"];
    if (name) return `meta:name:${name}`;
    if (property) return `meta:property:${property}`;
  }
  if (entry.tag === "link") {
    const rel = entry.attributes?.["rel"];
    if (rel) return `link:rel:${rel}`;
  }
  return undefined;
}

function insertPrerenderBody(html: string, body: string): string {
  const injected = html.replace(
    /(<body\b[^>]*>)/i,
    (_match, bodyOpen: string) => `${bodyOpen}<div data-wx-prerender>${body}</div>`
  );
  if (injected === html) throw new Error("wavex prerender: shell is missing a <body> tag.");
  return injected;
}

function insertBeforeHeadClose(html: string, markup: string): string {
  const inserted = html.replace(/<\/head>/i, () => `${markup}</head>`);
  if (inserted === html) throw new Error("wavex prerender: shell is missing a closing </head> tag.");
  return inserted;
}

function removeConflictingShellHeadTags(html: string, entries: HeadEntryLike[]): string {
  const managedKeys = new Set(entries.map((entry) => headEntryKey(entry)).filter((key): key is string => key !== undefined));
  if (managedKeys.size === 0) return html;

  return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, (headMarkup) =>
    headMarkup.replace(/<(meta|link)\b[^>]*>/gi, (tag, rawTagName: string) => {
      const key = htmlHeadTagKey(rawTagName.toLowerCase(), tag);
      return key && managedKeys.has(key) ? "" : tag;
    })
  );
}

function htmlHeadTagKey(tagName: string, source: string): string | undefined {
  if (tagName === "meta") {
    const name = readHtmlAttribute(source, "name");
    const property = readHtmlAttribute(source, "property");
    if (name) return `meta:name:${name}`;
    if (property) return `meta:property:${property}`;
  }
  if (tagName === "link") {
    const rel = readHtmlAttribute(source, "rel");
    if (rel) return `link:rel:${rel}`;
  }
  return undefined;
}

function readHtmlAttribute(source: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|[\\s/])${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, "i").exec(source);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPrerenderArtifacts(html: string): string {
  let stripped = html;
  while (/<div\b(?=[^>]*\bdata-wx-prerender\b)[^>]*>/i.test(stripped)) {
    stripped = stripFirstPrerenderBlock(stripped);
  }
  return stripped
    .replace(/<title\b(?=[^>]*\bdata-wx-head\b)[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<(?:meta|link)\b(?=[^>]*\bdata-wx-head\b)[^>]*>/gi, "");
}

function stripFirstPrerenderBlock(html: string): string {
  const open = /<div\b(?=[^>]*\bdata-wx-prerender\b)[^>]*>/i.exec(html);
  if (!open) return html;

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let tag = tagPattern.exec(html); tag; tag = tagPattern.exec(html)) {
    if (tag[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return html.slice(0, open.index) + html.slice(tag.index + tag[0].length);
      continue;
    }
    if (!/\/\s*>$/.test(tag[0])) depth += 1;
  }

  throw new Error("wavex prerender: existing data-wx-prerender block is malformed.");
}

function layoutChain(routeFile: string, pagesDir: string, root: string): string[] {
  const relativeToPages = routeFile.startsWith(`${pagesDir}/`) ? routeFile.slice(pagesDir.length + 1) : routeFile;
  const directories = relativeToPages.split("/").slice(0, -1);
  const layouts: string[] = [];
  let dir = pagesDir;
  if (existsSync(join(root, dir, "+layout.wx"))) layouts.push(`${pagesDir}/+layout.wx`);
  for (const segment of directories) {
    dir = `${dir}/${segment}`;
    if (existsSync(join(root, dir, "+layout.wx"))) layouts.push(`${dir}/+layout.wx`);
  }
  return layouts;
}

function walkWxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkWxFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".wx")) files.push(path);
  }
  return files.sort();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
