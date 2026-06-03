export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  url?: URL;
}

export interface RenderContext {
  route?: RouteContext;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  dispatch?: (event: WavexActionEvent) => void | Promise<void>;
}

export interface WavexActionEvent {
  type: string;
  target: string;
  event: Event;
  context: RenderContext;
}

export interface HeadEntry {
  tag: "title" | "meta" | "link";
  text?: string;
  attributes?: Record<string, string>;
}

export type RenderFunction<Result = unknown> = (context?: RenderContext) => Result;

export function createRouteContext(input: string | URL = globalThis.location?.href ?? "http://localhost/"): RouteContext {
  const url = input instanceof URL ? input : new URL(input, "http://localhost");
  return {
    path: url.pathname,
    params: {},
    query: Object.fromEntries(url.searchParams.entries()),
    url
  };
}

export function createRenderContext(context: RenderContext = {}): RenderContext {
  return {
    route: context.route ?? createRouteContext(),
    props: context.props ?? {},
    state: context.state ?? {},
    resources: context.resources ?? {},
    dispatch: context.dispatch
  };
}

export function installSemanticEventDelegation(root: ParentNode & EventTarget, context: RenderContext): () => void {
  const listener = (event: Event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;

    for (const element of event.composedPath()) {
      if (!(element instanceof Element)) continue;
      for (const attribute of element.getAttributeNames()) {
        if (!attribute.startsWith("data-wx-")) continue;
        const actionTarget = element.getAttribute(attribute);
        if (!actionTarget) continue;
        const type = attribute.slice("data-wx-".length);
        void context.dispatch?.({ type, target: actionTarget, event, context });
      }
      if (element === root) break;
    }
  };

  root.addEventListener("click", listener, { capture: true });
  root.addEventListener("submit", listener, { capture: true });
  return () => {
    root.removeEventListener("click", listener, { capture: true });
    root.removeEventListener("submit", listener, { capture: true });
  };
}

export function applyHead(entries: readonly HeadEntry[], documentRef: Document = document): void {
  for (const entry of entries) {
    if (entry.tag === "title") {
      documentRef.title = entry.text ?? "";
      continue;
    }

    const selector = headSelector(entry);
    const element = selector
      ? (documentRef.head.querySelector(selector) as HTMLElement | null) ?? documentRef.createElement(entry.tag)
      : documentRef.createElement(entry.tag);

    for (const [name, value] of Object.entries(entry.attributes ?? {})) element.setAttribute(name, value);
    if (!element.parentNode) documentRef.head.append(element);
  }
}

function headSelector(entry: HeadEntry): string | undefined {
  if (entry.tag === "meta") {
    const name = entry.attributes?.["name"];
    const property = entry.attributes?.["property"];
    if (name) return `meta[name=\"${cssEscape(name)}\"]`;
    if (property) return `meta[property=\"${cssEscape(property)}\"]`;
  }
  if (entry.tag === "link") {
    const rel = entry.attributes?.["rel"];
    if (rel) return `link[rel=\"${cssEscape(rel)}\"]`;
  }
  return undefined;
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
