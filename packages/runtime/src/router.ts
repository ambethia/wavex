import { matchRoutePath, parseQueryString, type RouteDefinition } from "@wavex/core";
import type {
  HeadEntry,
  NavigationState,
  RenderContext,
  RenderFunction,
  ResourceDefinition,
  RouteContext
} from "./index.js";

/** Runtime shape of a lazily loaded page or layout module. */
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

/** A document or custom scroll container's two-dimensional scroll offset. */
export interface ScrollPosition {
  x: number;
  y: number;
}

/** Custom scroll container seams for client-router scroll restoration. */
export interface ClientRouterScrollOptions {
  /** Read the current scroll offset (defaults to `window.scrollX/Y`). */
  getPosition?: () => ScrollPosition;
  /** Apply an offset after a route commit (defaults to `window.scrollTo`). */
  scrollTo?: (position: ScrollPosition) => void;
}

/** Options for creating the progressive-enhancement client router. */
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
  /**
   * Reset push/replace navigations to the top (or their `#fragment` target)
   * and restore history offsets after page commits, including across reloads.
   * Pass false to leave all scrolling to the app/browser, or provide custom
   * seams for a scroll container.
   */
  scrollRestoration?: false | ClientRouterScrollOptions;
  window?: Window;
  onNavigate?: (route: RouteContext) => void;
}

/** Imperative router controller returned by createClientRouter. */
export interface ClientRouter {
  /**
   * Navigate to an in-app URL. `replace` swaps the current history entry;
   * `scroll: false` keeps the current scroll offset (e.g. for query-param
   * filter updates) instead of resetting to the top or `#fragment` target.
   */
  navigate(to: string, options?: { replace?: boolean; scroll?: boolean }): Promise<void>;
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

interface WavexHistoryMetadata {
  key: string;
  scroll: ScrollPosition;
}

interface InternalNavigationOptions {
  replace?: boolean;
  scroll?: boolean;
  pop?: boolean;
  scrollPosition?: ScrollPosition;
}

/** Where to scroll once a navigation commits: a saved offset or a `#fragment` target. */
type ScrollTarget = { position: ScrollPosition } | { fragment: string; fallback?: ScrollPosition };

const defaultNotFound: RenderFunction = () => undefined;
const topOfPage: ScrollPosition = { x: 0, y: 0 };
const historyStateKey = "__wavex";
let historyEntrySequence = 0;

function createHistoryEntryKey(): string {
  historyEntrySequence += 1;
  return `wx-${historyEntrySequence}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function historyMetadata(state: unknown): WavexHistoryMetadata | undefined {
  if (!isRecord(state)) return undefined;
  const metadata = state[historyStateKey];
  if (!isRecord(metadata) || typeof metadata.key !== "string") return undefined;
  const scroll = metadata.scroll;
  if (!isRecord(scroll) || typeof scroll.x !== "number" || typeof scroll.y !== "number") return undefined;
  if (!Number.isFinite(scroll.x) || !Number.isFinite(scroll.y)) return undefined;
  return { key: metadata.key, scroll: { x: scroll.x, y: scroll.y } };
}

function withHistoryMetadata(state: unknown, metadata: WavexHistoryMetadata): Record<string, unknown> {
  const base = isRecord(state) ? state : {};
  const existing = isRecord(base[historyStateKey]) ? base[historyStateKey] : {};
  return {
    ...base,
    [historyStateKey]: {
      ...existing,
      key: metadata.key,
      scroll: { ...metadata.scroll }
    }
  };
}

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
  const scrollOptions = options.scrollRestoration === false ? undefined : options.scrollRestoration ?? {};
  const getScrollPosition = scrollOptions?.getPosition ?? (() => ({ x: win.scrollX, y: win.scrollY }));
  const scrollTo = scrollOptions?.scrollTo ?? ((position: ScrollPosition) => win.scrollTo(position.x, position.y));
  const savedScrollPositions = new Map<string, ScrollPosition>();
  const initialHistoryMetadata = historyMetadata(win.history.state);
  let activeHistoryKey = initialHistoryMetadata?.key ?? createHistoryEntryKey();
  // The router restores offsets itself once the async page swap commits, so
  // native window restoration would only jump the outgoing page.
  const history = win.history as History & { scrollRestoration?: ScrollRestoration };
  const previousScrollRestoration = scrollOptions && "scrollRestoration" in history ? history.scrollRestoration : undefined;
  if (previousScrollRestoration !== undefined) history.scrollRestoration = "manual";
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

  const clearNavigation = () => {
    if (navigationPending) setNavigation({ pending: false });
  };

  const captureScrollPosition = (persist: boolean): void => {
    if (!scrollOptions) return;
    const position = { ...getScrollPosition() };
    savedScrollPositions.set(activeHistoryKey, position);
    if (persist) {
      win.history.replaceState(
        withHistoryMetadata(win.history.state, { key: activeHistoryKey, scroll: position }),
        ""
      );
    }
  };

  const scrollToFragment = (fragment: string): boolean => {
    let id: string;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      id = fragment;
    }
    if (!id) return false;
    const documentRef = win.document as Partial<Document>;
    const element = documentRef.getElementById?.(id) ?? documentRef.getElementsByName?.(id)[0];
    if (!element || typeof element.scrollIntoView !== "function") return false;
    element.scrollIntoView();
    return true;
  };

  const restoreScrollPosition = async (token: number, target: ScrollTarget | undefined): Promise<void> => {
    if (!scrollOptions || !target || token !== navigationToken || disposed) return;
    if (typeof win.requestAnimationFrame === "function") {
      await new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));
    }
    if (token !== navigationToken || disposed) return;
    if ("position" in target) scrollTo(target.position);
    else if (!scrollToFragment(target.fragment) && target.fallback) scrollTo(target.fallback);
  };

  /**
   * Pop restores the entry's saved offset; the initial load restores a
   * reload's persisted offset or its fragment; push/replace go to the
   * fragment (falling back to the top) unless `scroll: false`.
   */
  const navigationScrollTarget = (
    url: URL,
    navOptions: InternalNavigationOptions,
    initialLoad: boolean
  ): ScrollTarget | undefined => {
    const fragment = url.hash.slice(1);
    if (navOptions.pop) return { position: navOptions.scrollPosition ?? topOfPage };
    if (initialLoad) {
      const persisted = initialHistoryMetadata?.key === activeHistoryKey ? initialHistoryMetadata.scroll : undefined;
      if (persisted) return { position: persisted };
      return fragment ? { fragment } : undefined;
    }
    if (navOptions.scroll === false) return undefined;
    return fragment ? { fragment, fallback: topOfPage } : { position: topOfPage };
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

  const navigate = async (to: string, navOptions: InternalNavigationOptions = {}) => {
    if (disposed) return;
    const url = new URL(to, win.location.href);
    // The entry navigation (replace to the current URL) keeps the document's
    // offset: a reload restores its persisted offset, a fresh load honours
    // the fragment, and otherwise the browser's position stands.
    const initialLoad =
      navigationToken === 0 &&
      navOptions.replace === true &&
      !navOptions.pop &&
      url.pathname === win.location.pathname &&
      url.search === win.location.search;
    const token = ++navigationToken;
    const scrollTarget = scrollOptions ? navigationScrollTarget(url, navOptions, initialLoad) : undefined;
    if (!navOptions.pop) {
      const method = navOptions.replace ? "replaceState" : "pushState";
      const hasFragment = to.includes("#");
      if (!navOptions.replace) captureScrollPosition(true);
      if (!navOptions.replace) activeHistoryKey = createHistoryEntryKey();
      // Entries that keep their offset (`scroll: false`, a plain initial load) record the live one.
      const entryScroll =
        scrollTarget && "position" in scrollTarget ? scrollTarget.position : scrollTarget ? topOfPage : { ...getScrollPosition() };
      if (scrollOptions) savedScrollPositions.set(activeHistoryKey, entryScroll);
      const nextState = scrollOptions
        ? withHistoryMetadata(navOptions.replace ? win.history.state : {}, {
            key: activeHistoryKey,
            scroll: entryScroll
          })
        : {};
      win.history[method](nextState, "", url.pathname + url.search + (hasFragment ? url.hash || "#" : ""));
    }

    const match = matchRoutePath(options.routes, url.pathname);
    const route: RouteContext = {
      path: url.pathname,
      params: match?.params ?? {},
      query: parseQueryString(url.search)
    };

    if (!match) {
      clearNavigation();
      options.host.setPage({ render: notFound, resources: [], route });
      current = { route };
      await restoreScrollPosition(token, scrollTarget);
      if (token !== navigationToken) return;
      options.onNavigate?.(route);
      return;
    }

    const clientRoute = match.route as ClientRoute;
    const layoutDefs = clientRoute.layouts ?? [];
    let module: RoutePageModule;
    let layoutModules: RoutePageModule[];

    setNavigation({ pending: true, to: route });
    try {
      [module, ...layoutModules] = await Promise.all([
        clientRoute.load(),
        ...layoutDefs.map((layout) => layout.load())
      ]);
    } catch (error) {
      if (token !== navigationToken) return;
      const committed = await renderErrorRoute(token, clientRoute, route, error);
      if (!committed) return;
      await restoreScrollPosition(token, scrollTarget);
      if (token !== navigationToken) return;
      options.onNavigate?.(route);
      return;
    }
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
    await restoreScrollPosition(token, scrollTarget);
    if (token !== navigationToken) return;
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
    const href = anchor.getAttribute("href") ?? "";
    const hasFragment = href.includes("#");
    const sameDocument = url.pathname === win.location.pathname && url.search === win.location.search;
    if (sameDocument && hasFragment) return;
    // Progressive interception: unmatched paths stay native browser navigations.
    if (!matchRoutePath(options.routes, url.pathname)) return;

    event.preventDefault();
    const target = url.pathname + url.search + (hasFragment ? url.hash || "#" : "");
    void navigate(target);
  };

  const queriesEqual = (left: Record<string, string>, right: Record<string, string>) => {
    const leftEntries = Object.entries(left);
    return leftEntries.length === Object.keys(right).length && leftEntries.every(([key, value]) => right[key] === value);
  };

  const onPopState = (event: PopStateEvent) => {
    if (current?.route.path === win.location.pathname && queriesEqual(current.route.query, parseQueryString(win.location.search))) {
      activeHistoryKey = historyMetadata(event.state)?.key ?? activeHistoryKey;
      navigationToken += 1;
      clearNavigation();
      return;
    }
    captureScrollPosition(false);
    const metadata = historyMetadata(event.state ?? win.history.state);
    activeHistoryKey = metadata?.key ?? createHistoryEntryKey();
    const scrollPosition = savedScrollPositions.get(activeHistoryKey) ?? metadata?.scroll ?? topOfPage;
    savedScrollPositions.set(activeHistoryKey, scrollPosition);
    const hasFragment = win.location.href.includes("#");
    void navigate(win.location.pathname + win.location.search + (hasFragment ? win.location.hash || "#" : ""), {
      pop: true,
      scrollPosition
    });
  };

  // Persist the live offset so a reload (or a cross-document return) restores it.
  const onPageHide = () => captureScrollPosition(true);

  win.document.addEventListener("click", onClick);
  win.addEventListener("popstate", onPopState);
  win.addEventListener("pagehide", onPageHide);

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
      captureScrollPosition(true);
      disposed = true;
      navigationToken += 1;
      clearNavigation();
      win.document.removeEventListener("click", onClick);
      win.removeEventListener("popstate", onPopState);
      win.removeEventListener("pagehide", onPageHide);
      if (previousScrollRestoration !== undefined) history.scrollRestoration = previousScrollRestoration;
    }
  };
}
