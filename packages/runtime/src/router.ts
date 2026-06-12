import { matchRoutePath, parseQueryString, type RouteDefinition } from "@wavex/core";
import type { RenderFunction, ResourceDefinition, RouteContext } from "./index.js";

export interface RoutePageModule<Result = unknown> {
  default?: RenderFunction<Result>;
  render?: RenderFunction<Result>;
  resources?: readonly ResourceDefinition[];
}

export interface ClientRoute extends RouteDefinition {
  load: () => Promise<RoutePageModule>;
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
  /** Swap the module for a route file in place (HMR), keeping route state. */
  hotReplacePage(file: string, module: RoutePageModule): void;
  current?: { route: RouteContext; file?: string };
  dispose(): void;
}

const defaultNotFound: RenderFunction = () => undefined;

export function createClientRouter(options: ClientRouterOptions): ClientRouter {
  const win = options.window ?? window;
  const notFound = options.notFound ?? defaultNotFound;
  let navigationToken = 0;
  let current: { route: RouteContext; file?: string } | undefined;

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
    const module = await clientRoute.load();
    if (token !== navigationToken) return; // superseded by a newer navigation
    const render = module.default ?? module.render;
    if (!render) throw new Error(`WAVEx route module for ${clientRoute.file} has no render export.`);

    current = { route, file: clientRoute.file };
    options.host.setPage({ render, resources: module.resources ?? [], route });
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
      const normalized = file.replace(/^\/+/, "");
      if (!current?.file || current.file.replace(/^\/+/, "") !== normalized) return;
      const render = module.default ?? module.render;
      if (!render) return;
      options.host.setPage({ render, resources: module.resources ?? [], route: current.route });
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
