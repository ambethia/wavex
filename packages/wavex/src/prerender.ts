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
  let html = stripPrerenderArtifacts(shell).replace(/(<body[^>]*>)/i, `$1<div data-wx-prerender>${body}</div>`);

  const titleEntry = head.find((entry) => entry.tag === "title");
  if (titleEntry) {
    const titleTag = `<title data-wx-head>${escapeHtml(titleEntry.text ?? "")}</title>`;
    html = /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
      ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, titleTag)
      : html.replace(/<\/head>/i, `${titleTag}</head>`);
  }

  const metaTags = head
    .filter((entry) => entry.tag !== "title")
    .map((entry) => {
      const attributes = Object.entries(entry.attributes ?? {})
        .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
        .join(" ");
      return `<${entry.tag} ${attributes} data-wx-head>`;
    })
    .join("");
  if (metaTags) html = html.replace(/<\/head>/i, `${metaTags}</head>`);

  return html;
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
