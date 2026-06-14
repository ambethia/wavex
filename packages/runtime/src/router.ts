import { matchRoutePath, parseQueryString, type RouteDefinition } from "@wavex/core";
import type {
  HeadEntry,
  NavigationState,
  RenderContext,
  RenderFunction,
  ResourceDefinition,
  RouteContext
} from "./index.js";

export interface RoutePageModule<Result = unknown> {
  default?: RenderFunction<Result>;
  render?: RenderFunction<Result>;
  resources?: readonly ResourceDefinition[];
  headEntries?: (context?: RenderContext) => HeadEntry[];
}

export interface ClientRoute extends RouteDefinition {
  load: () => Promise<RoutePageModule>;
  /** Layout modules, outermost first (src/pages/+layout.wx, then nested). */
  layouts?: ReadonlyArray<{ file: string; load: () => Promise<RoutePageModule> }>;
  /** +error.wx modules, outermost first; the deepest one handles route errors. */
  errors?: ReadonlyArray<{ file: string; load: () => Promise<RoutePageModule> }>;
}

/**
 * Compose +layout.wx modules around a page render. Each layout receives the
 * inner content through context.slots.default, matching the compiler's
 * semantic slot projection for bare `slot` elements.
 */
export function composeLayoutRender(
  layouts: ReadonlyArray<RoutePageModule>,
  page: RoutePageModule
): {
  render: RenderFunction;
  resources: readonly ResourceDefinition[];
  headEntries: (context?: RenderContext) => HeadEntry[];
} {
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

  // Layout head entries first, page entries last so the page wins on conflicts.
  const headSources = [...layouts, page];
  const headEntries = (context?: RenderContext) =>
    headSources.flatMap((module) => module.headEntries?.(context) ?? []);

  return { render, resources, headEntries };
}

/**
 * The mounted page host the router drives. @wavex/runtime/lit's mount
 * satisfies this shape; any renderer backend can implement it.
 */
export interface RouterPageHost {
  setPage(page: {
    render: RenderFunction;
    resources: readonly ResourceDefinition[];
    route: RouteContext;
    head?: (context?: RenderContext) => HeadEntry[];
  }): void;
  update(nextContext?: { route?: RouteContext }): void;
  /** Navigation lifecycle for declarative progress UI (optional for custom hosts). */
  setNavigation?(navigation: NavigationState): void;
}

export interface ClientRouterOptions {
  routes: readonly ClientRoute[];
  host: RouterPageHost;
  /** Render function used when no route matches the current path. */
  notFound?: RenderFunction;
  /**
   * Wrap navigation commits in `document.startViewTransition` (default true).
   * Automatically skipped when unsupported, under `prefers-reduced-motion`,
   * and on the initial load; HMR swaps never transition.
   */
  viewTransitions?: boolean;
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

/**
 * Progressive client router: intercepts internal link clicks (native `a href`
 * stays native), drives the History API, lazy-loads the matched route's
 * module and layouts, and atomically swaps the page into the host via
 * `setPage` — which re-scopes Convex subscriptions to the new route. Stale
 * navigations are cancelled by token, and `popstate` is handled for
 * back/forward.
 */
export function createClientRouter(options: ClientRouterOptions): ClientRouter {
  const win = options.window ?? window;
  const notFound = options.notFound ?? defaultNotFound;
  const viewTransitionsEnabled = options.viewTransitions ?? true;
  let navigationToken = 0;
  let current: ActivePage | undefined;
  let navigationPending = false;
  let disposed = false;

  const setNavigation = (navigation: NavigationState) => {
    navigationPending = navigation.pending;
    options.host.setNavigation?.(navigation);
    const documentElement = win.document?.documentElement;
    if (!documentElement) return;
    if (navigation.pending) documentElement.setAttribute("data-wx-navigating", "");
    else documentElement.removeAttribute("data-wx-navigating");
  };

  /**
   * Commit a page swap, wrapped in a View Transition when appropriate.
   * pending->false clears inside the update callback, atomically with the
   * swap: clearing earlier flickers the old snapshot, clearing after
   * `finished` bakes the progress UI into the new snapshot.
   */
  const commitWithTransition = async (token: number, pop: boolean, commit: () => void): Promise<boolean> => {
    const documentRef = win.document as Document & {
      startViewTransition?: (
        update: (() => void) | { update: () => void; types?: string[] }
      ) => { updateCallbackDone: Promise<void> };
    };
    const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const useTransition =
      viewTransitionsEnabled && current !== undefined && typeof documentRef.startViewTransition === "function" && !reducedMotion;

    const guardedCommit = () => {
      if (token !== navigationToken) return false; // superseded during the frame gap
      setNavigation({ pending: false });
      commit();
      return true;
    };

    if (!useTransition) return guardedCommit();

    let committed = false;
    let updateInvoked = false;

    let transition: { updateCallbackDone: Promise<void> };
    try {
      // Object signature carries direction types for :active-view-transition-type().
      transition = documentRef.startViewTransition!({
        update: () => {
          updateInvoked = true;
          committed = guardedCommit();
        },
        types: ["wavex-navigation", pop ? "backward" : "forward"]
      });
    } catch (error) {
      // Older Chromium builds only accept the function signature. Do not
      // misclassify arbitrary transition/commit failures as API-shape fallback.
      if (!(error instanceof TypeError) || updateInvoked) throw error;
      transition = documentRef.startViewTransition!(() => {
        committed = guardedCommit();
      });
    }
    await transition.updateCallbackDone;
    return committed;
  };

  const commitPage = (next: ActivePage) => {
    if (!next.page) return;
    const composed = composeLayoutRender(next.layouts?.map((layout) => layout.module) ?? [], next.page);
    options.host.setPage({
      render: composed.render,
      resources: composed.resources,
      route: next.route,
      head: composed.headEntries
    });
    current = next;
  };

  const applyCurrent = () => {
    if (!current?.page) return;
    commitPage(current);
  };

  const navigate = async (to: string, navOptions: { replace?: boolean; pop?: boolean } = {}) => {
    if (disposed) return;
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
      if (navigationPending) setNavigation({ pending: false });
      current = { route };
      options.host.setPage({ render: notFound, resources: [], route });
      options.onNavigate?.(route);
      return;
    }

    const clientRoute = match.route as ClientRoute;
    setNavigation({ pending: true, to: route });
    try {
      const layoutDefs = clientRoute.layouts ?? [];
      const [module, ...layoutModules] = await Promise.all([
        clientRoute.load(),
        ...layoutDefs.map((layout) => layout.load())
      ]);
      if (token !== navigationToken) return; // superseded; the newer navigation owns pending state

      const committed = await commitWithTransition(token, navOptions.pop ?? false, () => {
        commitPage({
          route,
          file: clientRoute.file,
          page: module,
          layouts: layoutDefs.map((layout, index) => ({ file: layout.file, module: layoutModules[index]! }))
        });
      });
      if (!committed) return;
    } catch (error) {
      if (token !== navigationToken) return;
      const committed = await renderErrorRoute(token, clientRoute, route, error);
      if (!committed) return;
    }
    options.onNavigate?.(route);
  };

  /** Deterministic error UI: render the deepest +error.wx for the route, bare (no layouts). */
  const renderErrorRoute = async (token: number, clientRoute: ClientRoute, route: RouteContext, error: unknown): Promise<boolean> => {
    const errorDef = clientRoute.errors?.at(-1);
    if (!errorDef) {
      setNavigation({ pending: false });
      throw error;
    }
    let errorModule: RoutePageModule;
    try {
      errorModule = await errorDef.load();
    } catch (loadError) {
      if (token !== navigationToken) return false;
      setNavigation({ pending: false });
      throw loadError;
    }
    if (token !== navigationToken) return false;
    const errorRender = errorModule.default ?? errorModule.render;
    if (!errorRender) {
      setNavigation({ pending: false });
      throw error;
    }
    setNavigation({ pending: false });
    options.host.setPage({
      render: (context = {}) => errorRender({ ...context, attrs: { ...context.attrs, error } }),
      resources: [],
      route,
      head: (context) => errorModule.headEntries?.(context) ?? []
    });
    current = { route, file: errorDef.file, page: errorModule, layouts: [] };
    return true;
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const AnchorElement = (win as Window & { HTMLAnchorElement?: typeof HTMLAnchorElement }).HTMLAnchorElement ?? globalThis.HTMLAnchorElement;
    if (typeof AnchorElement !== "function") return;
    const anchor = event.composedPath().find((node): node is HTMLAnchorElement => {
      return node instanceof AnchorElement && node.hasAttribute("href");
    });
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
      if (disposed || !current) return;
      const normalized = file.replace(/^\/+/, "");
      if (current.file?.replace(/^\/+/, "") === normalized) {
        commitPage({ ...current, page: module });
        return;
      }
      const layoutIndex = current.layouts?.findIndex((entry) => entry.file.replace(/^\/+/, "") === normalized) ?? -1;
      if (layoutIndex >= 0) {
        const layouts = [...(current.layouts ?? [])];
        layouts[layoutIndex] = { ...layouts[layoutIndex]!, module };
        commitPage({ ...current, layouts });
      }
    },
    get current() {
      return current;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      navigationToken += 1;
      if (navigationPending) setNavigation({ pending: false });
      win.document.removeEventListener("click", onClick);
      win.removeEventListener("popstate", onPopState);
    }
  };
}
