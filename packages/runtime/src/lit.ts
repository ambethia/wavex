/**
 * Lit renderer backend for the WAVEx runtime.
 *
 * Lit is an implementation detail here, not the app authoring model: compiled
 * `.wx` render modules call this adapter, and Lit handles DOM patching,
 * property/attribute updates, and keyed list identity (preserving focus
 * across rerenders). Reusing Lit instead of a bespoke renderer is a core
 * decision — Web Awesome already depends on Lit, so the dependency is shared
 * and deduped through the app bundle.
 *
 * Import from `@wavex/runtime/lit`.
 *
 * @module lit
 */
import { render as litRender } from "lit";
import {
  applyHead,
  createRenderContext,
  createResourceController,
  createSemanticActionDispatcher,
  installSemanticEventDelegation,
  type ActionClient,
  type ActionKindResolver,
  type AnalyticsClient,
  type HeadEntry,
  type NavigationState,
  type RenderContext,
  type RenderFunction,
  type ResourceClient,
  type ResourceController,
  type ResourceDefinition,
  type RouteContext
} from "./index.js";

/** Clients and resources wired into a mount; omit clients in tests to render without a backend. */
export interface LitMountOptions {
  resources?: readonly ResourceDefinition[];
  resourceClient?: ResourceClient;
  actionClient?: ActionClient;
  resolveActionKind?: ActionKindResolver;
  analytics?: AnalyticsClient;
}

/** The exports of a compiled `.wx` page module, as loaded by the bootstrap/router. */
export interface WavexPageModule<Result = unknown> {
  default?: RenderFunction<Result>;
  render?: RenderFunction<Result>;
  resources?: readonly ResourceDefinition[];
}

/** A live mounted page: the router and HMR drive it through `setPage`/`setRender`/`update`. */
export interface LitMount<Result = unknown> {
  context: RenderContext;
  update(nextContext?: RenderContext): void;
  setRender(nextRender: RenderFunction<Result>): void;
  setResources(nextResources: readonly ResourceDefinition[]): void;
  /** Atomically swap render, resources, route, and head in a single update (used by the client router). */
  setPage(page: {
    render: RenderFunction<Result>;
    resources: readonly ResourceDefinition[];
    route: RouteContext;
    head?: (context?: RenderContext) => HeadEntry[];
  }): void;
  /** Navigation lifecycle from the client router; rerenders so `+if navigation.pending` UI updates. */
  setNavigation(navigation: NavigationState): void;
  dispose(): void;
  root: HTMLElement;
  result?: Result;
}

/**
 * Mount a render function into a root element with the full runtime wired up:
 * resource subscriptions (rerendering on every value/state change), semantic
 * event delegation, action lifecycle rerenders, and `+head` application.
 * Updates are batched per microtask; Lit patches the DOM in place, so node
 * identity and focus survive rerenders.
 */
export function mountLit<Result = unknown>(
  root: HTMLElement,
  render: RenderFunction<Result>,
  initialContext: RenderContext = {},
  options: LitMountOptions = {}
): LitMount<Result> {
  const context = createRenderContext(initialContext);
  let result: Result | undefined;
  let renderCurrent = render;
  let resourceDefinitions = [...(options.resources ?? [])];
  let resourceController: ResourceController | undefined;
  let updateRequested = false;
  let disposed = false;
  let headCurrent: ((context?: RenderContext) => HeadEntry[]) | undefined;

  const update = (nextContext: RenderContext = {}) => {
    if (disposed) return;
    // A synchronous render supersedes any queued microtask render.
    updateRequested = false;
    Object.assign(context, createRenderContext({ ...context, ...nextContext }));
    resourceController?.update(resourceDefinitions);
    result = renderCurrent(context);
    litRender(result as unknown, root);
    if (headCurrent && typeof document !== "undefined") applyHead(headCurrent(context));
  };

  const requestUpdate = () => {
    if (disposed || updateRequested) return;
    updateRequested = true;
    queueMicrotask(() => {
      if (disposed) {
        updateRequested = false;
        return;
      }
      updateRequested = false;
      update();
    });
  };

  if (options.actionClient) {
    const dispatcher = createSemanticActionDispatcher(context, {
      actionClient: options.actionClient,
      dispatch: context.dispatch,
      resolveActionKind: options.resolveActionKind,
      analytics: options.analytics
    });
    // Action lifecycle states (pending/idle/error) must rerender the page:
    // once synchronously after dispatch marks pending, and again on settle.
    context.dispatch = (event) => {
      const dispatched = dispatcher(event);
      requestUpdate();
      return Promise.resolve(dispatched).finally(() => requestUpdate());
    };
  }

  const disposeDelegation = installSemanticEventDelegation(root, context);
  resourceController = createResourceController(context, resourceDefinitions, {
    client: options.resourceClient,
    onChange: requestUpdate
  });

  const setRender = (nextRender: RenderFunction<Result>) => {
    if (disposed) return;
    renderCurrent = nextRender;
    update();
  };

  const setResources = (nextResources: readonly ResourceDefinition[]) => {
    if (disposed) return;
    resourceDefinitions = [...nextResources];
    resourceController ??= createResourceController(context, resourceDefinitions, {
      client: options.resourceClient,
      onChange: requestUpdate
    });
    update();
  };

  const setNavigation = (navigation: NavigationState) => {
    if (disposed) return;
    context.navigation = navigation;
    requestUpdate();
  };

  const setPage = (page: {
    render: RenderFunction<Result>;
    resources: readonly ResourceDefinition[];
    route: RouteContext;
    head?: (context?: RenderContext) => HeadEntry[];
  }) => {
    if (disposed) return;
    renderCurrent = page.render;
    resourceDefinitions = [...page.resources];
    headCurrent = page.head;
    update({ route: page.route });
  };

  update(context);

  return {
    context,
    root,
    get result() {
      return result;
    },
    update,
    setRender,
    setResources,
    setPage,
    setNavigation,
    dispose() {
      if (disposed) return;
      disposed = true;
      updateRequested = false;
      resourceController?.dispose();
      resourceController = undefined;
      disposeDelegation();
      litRender(undefined, root);
    }
  };
}

/** Mount a compiled `.wx` page module (render export + inferred resources) — the bootstrap entry point. */
export function mountLitPage<Result = unknown>(
  root: HTMLElement,
  pageModule: WavexPageModule<Result>,
  initialContext: RenderContext = {},
  options: LitMountOptions = {}
): LitMount<Result> {
  const render = pageModule.default ?? pageModule.render;
  if (!render) throw new Error("WAVEx page module must export a default render function or named render function.");
  return mountLit(root, render, initialContext, {
    ...options,
    resources: options.resources ?? pageModule.resources
  });
}
