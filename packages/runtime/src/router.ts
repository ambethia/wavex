import { matchRoutePath, parseQueryString, type RouteDefinition } from "@wavex/core";
import type { RenderFunction, ResourceDefinition, RouteContext } from "./index.js";

export interface RoutePageModule<Result = unknown> {
  default?: RenderFunction<Result>;
  render?: RenderFunction<Result>;
  resources?: readonly ResourceDefinition[];
}

export interface ClientRoute extends RouteDefinition {
  load: () => Promise<RoutePageModule>;
  /** Layout modules, outermost first (src/pages/+layout.wx, then nested). */
  layouts?: ReadonlyArray<{ file: string; load: () => Promise<RoutePageModule> }>;
}

/**
 * Compose +layout.wx modules around a page render. Each layout receives the
 * inner content through context.slots.default, matching the compiler's
 * semantic slot projection for bare `slot` elements.
 */
export function composeLayoutRender(
  layouts: ReadonlyArray<RoutePageModule>,
  page: RoutePageModule
): { render: RenderFunction; resources: readonly ResourceDefinition[] } {
  const pageRender = page.default ?? page.render;
  if (!pageRender) throw new Error("WAVEx page module has no render export.");

  let render: RenderFunction = pageRender;
  const resources: ResourceDefinition[] = [...(page.resources ?? [])];

  for (const layout of [...layouts].reverse()) {
    const layoutRender = layout.default ?? layout.render;
    if (!layoutRender) continue;
    resources.push(...(layout.resources ?? []));
    const inner = render;
    render = (context = {}) => layoutRender({ ...context, slots: { default: inner(context) } });
  }

  return { render, resources };
}

/**
 * The mounted page host the router drives. @wavex/runtime/lit's mount
 * satisfies this shape; any renderer backend can implement it.
 */
export interface RouterPageHost {
  setPage(page: { render: RenderFunction; resources: readonly ResourceDefinition[]; route: RouteContext }): void;
  update(nextContext?: { route?: RouteContext }): void;
}

export interface ClientRouterOptions {
  routes: readonly ClientRoute[];
  host: RouterPageHost;
  /** Render function used when no route matches the current path. */
  notFound?: RenderFunction;
  window?: Window;
  onNavigate?: (route: RouteContext) => void;
}

export interface ClientRouter {
  navigate(to: string, options?: { replace?: boolean }): Promise<void>;
  /** Swap the module for a route or layout file in place (HMR), keeping route state. */
  hotReplacePage(file: string, module: RoutePageModule): void;
  current?: { route: RouteContext; file?: string };
  dispose(): void;
}

interface ActivePage {
  route: RouteContext;
  file?: string;
  page?: RoutePageModule;
  layouts?: Array<{ file: string; module: RoutePageModule }>;
}

const defaultNotFound: RenderFunction = () => undefined;

export function createClientRouter(options: ClientRouterOptions): ClientRouter {
  const win = options.window ?? window;
  const notFound = options.notFound ?? defaultNotFound;
  let navigationToken = 0;
  let current: ActivePage | undefined;

  const applyCurrent = () => {
    if (!current?.page) return;
    const composed = composeLayoutRender(current.layouts?.map((layout) => layout.module) ?? [], current.page);
    options.host.setPage({ render: composed.render, resources: composed.resources, route: current.route });
  };

  const navigate = async (to: string, navOptions: { replace?: boolean; pop?: boolean } = {}) => {
    const url = new URL(to, win.location.href);
    const token = ++navigationToken;
    if (!navOptions.pop) {
      const method = navOptions.replace ? "replaceState" : "pushState";
      win.history[method]({}, "", url.pathname + url.search);
    }

    const match = matchRoutePath(options.routes, url.pathname);
    const route: RouteContext = {
      path: url.pathname,
      params: match?.params ?? {},
      query: parseQueryString(url.search)
    };

    if (!match) {
      current = { route };
      options.host.setPage({ render: notFound, resources: [], route });
      options.onNavigate?.(route);
      return;
    }

    const clientRoute = match.route as ClientRoute;
    const layoutDefs = clientRoute.layouts ?? [];
    const [module, ...layoutModules] = await Promise.all([
      clientRoute.load(),
      ...layoutDefs.map((layout) => layout.load())
    ]);
    if (token !== navigationToken) return; // superseded by a newer navigation

    current = {
      route,
      file: clientRoute.file,
      page: module,
      layouts: layoutDefs.map((layout, index) => ({ file: layout.file, module: layoutModules[index]! }))
    };
    applyCurrent();
    options.onNavigate?.(route);
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event
      .composedPath()
      .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement && node.hasAttribute("href"));
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download") || anchor.getAttribute("rel")?.split(/\s+/).includes("external")) return;

    const url = new URL(anchor.href, win.location.href);
    if (url.origin !== win.location.origin) return;
    // Progressive interception: unmatched paths stay native browser navigations.
    if (!matchRoutePath(options.routes, url.pathname)) return;

    event.preventDefault();
    void navigate(url.pathname + url.search);
  };

  const onPopState = () => {
    void navigate(win.location.pathname + win.location.search, { pop: true });
  };

  win.document.addEventListener("click", onClick);
  win.addEventListener("popstate", onPopState);

  return {
    navigate: (to, navOptions) => navigate(to, navOptions),
    hotReplacePage(file, module) {
      if (!current) return;
      const normalized = file.replace(/^\/+/, "");
      if (current.file?.replace(/^\/+/, "") === normalized) {
        current.page = module;
        applyCurrent();
        return;
      }
      const layout = current.layouts?.find((entry) => entry.file.replace(/^\/+/, "") === normalized);
      if (layout) {
        layout.module = module;
        applyCurrent();
      }
    },
    get current() {
      return current;
    },
    dispose() {
      win.document.removeEventListener("click", onClick);
      win.removeEventListener("popstate", onPopState);
    }
  };
}
