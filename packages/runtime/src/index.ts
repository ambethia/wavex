/**
 * Browser runtime for WAVEx apps: routing, resource lifecycle, the Convex
 * bridge, mutation/action state, head management, error boundaries, and
 * analytics.
 *
 * The split of responsibilities is deliberate: WAVEx owns resources, routing,
 * actions, head, and analytics, while the renderer backend (see
 * `@wavex/runtime/lit`) owns low-level DOM patching and keyed list identity.
 * Apps are client-side by default — prerendered HTML is an output
 * optimization, and Convex realtime subscriptions start after boot.
 *
 * The Convex bridge wraps the official Convex browser client behind the
 * {@link ResourceClient} and {@link ActionClient} interfaces: `$$module:fn`
 * query bindings become live route-scoped subscriptions (torn down on
 * navigation), and mutations/actions dispatch through the client with
 * explicit pending/error lifecycle state ({@link ActionState}) for templates.
 *
 * @module @wavex/runtime
 */
import { analyticsEventNameForTarget } from "./analytics.js";
/** The current route as seen by templates: `route.path`, `route.params`, `route.query`. */
export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  url?: URL;
}

/** Lifecycle of a live query resource; drives `+loading` / `+error` / `+empty` template states. */
export type ResourceLifecycleStatus = "loading" | "ready" | "error";

/** Current state of one subscribed Convex query resource. */
export interface ResourceState<T = unknown> {
  status: ResourceLifecycleStatus;
  value?: T;
  error?: unknown;
  updatedAt?: number;
}

/** Lifecycle of a mutation/action dispatch; drives `+pending` / `+idle` / `+mutation-error` states. */
export type ActionLifecycleStatus = "idle" | "pending" | "error";

/** Current state of one semantic action target (mutation or Convex action). */
export interface ActionState<T = unknown> {
  status: ActionLifecycleStatus;
  pending: boolean;
  result?: T;
  error?: unknown;
  updatedAt?: number;
}

/**
 * Everything a compiled render function can see: the route, component attrs,
 * local state, live resource values and their lifecycle states, action
 * states, projected slot content, and the semantic action dispatcher.
 * Compiled `.wx` modules read from this; the runtime owns writing to it.
 */
export interface RenderContext {
  route?: RouteContext;
  /** Component attributes (and the route error for +error.wx pages). */
  attrs?: Record<string, unknown>;
  state?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  resourceStates?: Record<string, ResourceState>;
  actionStates?: Record<string, ActionState>;
  /** Client navigation lifecycle — `navigation.pending` while a route loads. */
  navigation?: NavigationState;
  /** Slot content projected into layouts and local components (semantic slot composition). */
  slots?: Record<string, unknown>;
  dispatch?: (event: WavexActionEvent) => void | Promise<void>;
}

/**
 * The client router's navigation lifecycle, exposed declaratively in template
 * context. Render an nprogress-style indicator with `+if navigation.pending`;
 * the router also mirrors this onto `<html data-wx-navigating>` for CSS-only
 * indicators.
 */
export interface NavigationState {
  pending: boolean;
  /** The destination route while a navigation is pending. */
  to?: RouteContext;
}

export type ResourceArgsFactory<TArgs = unknown> = (context: RenderContext) => TArgs;

/**
 * A Convex query resource as emitted by the compiler for a `$$module:fn`
 * binding. Args may be a static value or a factory reading the render
 * context (e.g. `route.params`), which makes the subscription re-resolve on
 * navigation.
 */
export interface ResourceDefinition<TArgs = unknown> {
  name: string;
  modulePath: string;
  functionName: string;
  raw?: string;
  kind?: "query";
  args?: TArgs | ResourceArgsFactory<TArgs>;
  getArgs?: ResourceArgsFactory<TArgs>;
}

export interface ResolvedResourceDefinition<TArgs = unknown> {
  name: string;
  modulePath: string;
  functionName: string;
  raw?: string;
  kind: "query";
  args: TArgs;
}

export interface ResourceSubscriptionHandlers<T = unknown> {
  next(value: T): void;
  error(error: unknown): void;
}

export type ResourceTeardown = void | (() => void) | { dispose?: () => void; unsubscribe?: () => void; getCurrentValue?: () => unknown };

/**
 * The subscription seam between the runtime and a realtime backend. The real
 * implementation wraps the official Convex browser client
 * ({@link createConvexResourceClient}); tests use fake clients — runtime
 * behavior is deliberately testable without a live deployment.
 */
export interface ResourceClient {
  subscribe<T = unknown>(
    definition: ResolvedResourceDefinition,
    handlers: ResourceSubscriptionHandlers<T>
  ): ResourceTeardown;
}

/** Manages the live subscriptions for a mounted page; `update` diffs definitions, `dispose` tears all down. */
export interface ResourceController {
  update(nextDefinitions?: readonly ResourceDefinition[]): void;
  dispose(): void;
}

export interface ResourceControllerOptions {
  client?: ResourceClient;
  onChange?: () => void;
}

/** A `$$module:fn` mutation/action target parsed from a semantic event attribute. */
export interface ActionDefinition<TArgs = unknown> {
  target: string;
  modulePath: string;
  functionName: string;
  raw?: string;
  kind?: "mutation" | "action";
  args?: TArgs;
}

export interface ResolvedActionDefinition<TArgs = unknown> {
  target: string;
  modulePath: string;
  functionName: string;
  raw?: string;
  kind: "mutation" | "action";
  args: TArgs;
}

/** Dispatch seam for mutations/actions; wraps the Convex client in production ({@link createConvexActionClient}). */
export interface ActionClient {
  invoke(definition: ResolvedActionDefinition): Promise<unknown>;
}

/**
 * Resolves whether a `$$` target is a Convex mutation or action. The Vite
 * plugin supplies one backed by the function-kind manifest discovered from
 * `convex/` sources, so templates never declare the kind.
 */
export type ActionKindResolver = (definition: ActionDefinition, event: WavexActionEvent) => "mutation" | "action" | undefined;

export interface SemanticActionDispatcherOptions {
  actionClient?: ActionClient;
  dispatch?: (event: WavexActionEvent) => void | Promise<void>;
  resolveActionKind?: ActionKindResolver;
  onActionResult?: (definition: ResolvedActionDefinition, result: unknown, event: WavexActionEvent) => void;
  onActionError?: (definition: ResolvedActionDefinition, error: unknown, event: WavexActionEvent) => void;
  throwActionErrors?: boolean;
  /** Optional analytics sink; semantic Convex actions are captured automatically (`:track:` overrides the name). */
  analytics?: import("./analytics.js").AnalyticsClient;
}

/** Structural slice of the official Convex browser client the runtime depends on (subscriptions). */
export interface ConvexBrowserClientLike {
  onUpdate(
    query: unknown,
    args: Record<string, unknown>,
    callback: (result: unknown) => unknown,
    onError?: (error: Error) => unknown
  ): ResourceTeardown;
}

/** Structural slice of the Convex client used for mutations and actions. */
export interface ConvexActionClientLike {
  mutation(mutation: unknown, args: Record<string, unknown>): Promise<unknown>;
  action(action: unknown, args: Record<string, unknown>): Promise<unknown>;
}

export interface ConvexResourceClientOptions {
  api?: unknown;
  resolveFunction?: (definition: ResolvedResourceDefinition) => unknown;
}

export interface ConvexActionClientOptions {
  api?: unknown;
  resolveFunction?: (definition: ResolvedActionDefinition) => unknown;
}

/** A semantic event captured by delegation: `:click:save` produces `{ type: "click", target: "save" }`. */
export interface WavexActionEvent {
  type: string;
  target: string;
  event: Event;
  element: Element;
  context: RenderContext;
}

/** One managed head node from a `+head` directive (title, meta, or link). */
export interface HeadEntry {
  tag: "title" | "meta" | "link";
  text?: string;
  attributes?: Record<string, string>;
}

/** The shape of a compiled `.wx` module's render export; `Result` is the renderer backend's template type. */
export type RenderFunction<Result = unknown> = (context?: RenderContext) => Result;

interface ActiveResource {
  key: string;
  name: string;
  teardown: ResourceTeardown;
}

/** Build a {@link RouteContext} from a URL (defaults to the current location); params are filled in by the router. */
export function createRouteContext(input: string | URL = globalThis.location?.href ?? "http://localhost/"): RouteContext {
  const url = input instanceof URL ? input : new URL(input, "http://localhost");
  return {
    path: url.pathname,
    params: {},
    query: Object.fromEntries(url.searchParams.entries()),
    url
  };
}

/** Normalize a partial context into a fully-populated {@link RenderContext} with empty defaults. */
export function createRenderContext(context: RenderContext = {}): RenderContext {
  return {
    route: context.route ?? createRouteContext(),
    attrs: context.attrs ?? {},
    state: context.state ?? {},
    resources: context.resources ?? {},
    resourceStates: context.resourceStates ?? {},
    actionStates: context.actionStates ?? {},
    navigation: context.navigation ?? { pending: false },
    dispatch: context.dispatch
  };
}

/**
 * Subscribe the context's resources through a {@link ResourceClient} and keep
 * `context.resources` / `context.resourceStates` current. Subscriptions are
 * keyed by function address and resolved args: `update()` diffs the wanted
 * set against active subscriptions, so navigation tears down only what
 * actually changed (route-scoped subscriptions), and `onChange` schedules a
 * rerender on every value/state transition.
 */
export function createResourceController(
  context: RenderContext,
  definitions: readonly ResourceDefinition[] = [],
  options: ResourceControllerOptions = {}
): ResourceController {
  const activeResources = new Map<string, ActiveResource>();
  let currentDefinitions = [...definitions];
  let disposed = false;

  const update = (nextDefinitions: readonly ResourceDefinition[] = currentDefinitions) => {
    if (disposed) return;
    currentDefinitions = [...nextDefinitions];
    ensureResourceContainers(context);

    const nextKeys = new Set<string>();
    for (const definition of currentDefinitions) {
      let resolved: ResolvedResourceDefinition;
      try {
        resolved = resolveResourceDefinition(definition, context);
      } catch (error) {
        markResourceError(context, definition.name, error);
        options.onChange?.();
        continue;
      }

      const key = resourceKey(resolved);
      nextKeys.add(key);
      if (activeResources.has(key)) continue;

      markResourceLoading(context, resolved.name);
      const active: ActiveResource = { key, name: resolved.name, teardown: undefined };
      activeResources.set(key, active);

      if (!options.client) continue;

      try {
        const teardown = options.client.subscribe(resolved, {
          next(value) {
            if (!activeResources.has(key)) return;
            markResourceReady(context, resolved.name, value);
            options.onChange?.();
          },
          error(error) {
            if (!activeResources.has(key)) return;
            markResourceError(context, resolved.name, error);
            options.onChange?.();
          }
        });
        active.teardown = teardown;

        const currentValue = readCurrentValue(teardown);
        if (currentValue !== undefined) markResourceReady(context, resolved.name, currentValue);
      } catch (error) {
        markResourceError(context, resolved.name, error);
        options.onChange?.();
      }
    }

    for (const [key, active] of activeResources) {
      if (nextKeys.has(key)) continue;
      disposeResource(active.teardown);
      activeResources.delete(key);
      if (![...activeResources.values()].some((resource) => resource.name === active.name)) {
        clearResource(context, active.name);
      }
    }
  };

  update(currentDefinitions);

  return {
    update,
    dispose() {
      disposed = true;
      for (const active of activeResources.values()) disposeResource(active.teardown);
      activeResources.clear();
    }
  };
}

/**
 * Adapt the official Convex browser client to the {@link ResourceClient}
 * seam. Function addresses resolve through the generated `api` object when
 * provided (typed references), falling back to string paths.
 */
export function createConvexResourceClient(
  client: ConvexBrowserClientLike,
  options: ConvexResourceClientOptions = {}
): ResourceClient {
  return {
    subscribe(definition, handlers) {
      const query = options.resolveFunction?.(definition) ?? resolveConvexApiReference(options.api, definition) ?? convexFunctionPath(definition);
      const args = normalizeConvexArgs(definition.args);
      const unknownHandlers = handlers as ResourceSubscriptionHandlers<unknown>;
      return client.onUpdate(query, args, (result) => unknownHandlers.next(result), (error) => unknownHandlers.error(error));
    }
  };
}

/** Adapt the Convex client to the {@link ActionClient} seam; dispatches by inferred kind (mutation vs action). */
export function createConvexActionClient(
  client: ConvexActionClientLike,
  options: ConvexActionClientOptions = {}
): ActionClient {
  return {
    async invoke(definition) {
      const reference = options.resolveFunction?.(definition) ?? resolveConvexApiReference(options.api, definition) ?? convexFunctionPath(definition);
      const args = normalizeConvexArgs(definition.args);
      return definition.kind === "action" ? client.action(reference, args) : client.mutation(reference, args);
    }
  };
}

/**
 * Build the dispatcher behind `context.dispatch`. `$$module:fn` targets go
 * through the action client with full lifecycle handling — pending state,
 * form `preventDefault`/reset on success, error state, and an automatic
 * analytics capture (`:track:` overrides the event name). Non-Convex targets
 * fall through to `options.dispatch` (app-defined handlers).
 */
export function createSemanticActionDispatcher(
  context: RenderContext,
  options: SemanticActionDispatcherOptions = {}
): (event: WavexActionEvent) => Promise<void> {
  return async (event) => {
    const action = parseConvexActionTarget(event.target);
    if (!action) {
      await options.dispatch?.(event);
      return;
    }

    if (event.type === "submit" && typeof event.event.preventDefault === "function") event.event.preventDefault();

    const definition: ResolvedActionDefinition = {
      ...action,
      kind: options.resolveActionKind?.(action, event) ?? action.kind ?? "mutation",
      args: collectActionArgs(event)
    };

    markActionPending(context, definition.target);

    if (options.analytics) {
      const trackOverride = event.element.getAttribute?.("data-wx-track") ?? undefined;
      options.analytics.capture(trackOverride ?? analyticsEventNameForTarget(definition.target), {
        wx_event_type: event.type,
        wx_target: definition.target,
        wx_kind: definition.kind,
        wx_module: definition.modulePath,
        wx_function: definition.functionName
      });
    }

    try {
      const result = options.actionClient ? await options.actionClient.invoke(definition) : undefined;
      resetSubmittedForm(event);
      markActionIdle(context, definition.target, result);
      options.onActionResult?.(definition, result, event);
    } catch (error) {
      markActionError(context, definition.target, error);
      options.onActionError?.(definition, error, event);
      if (options.throwActionErrors) throw error;
    }
  };
}

/**
 * Listen for click/submit/change at the root (capture phase) and route
 * `data-wx-*` action attributes — the compiled form of `:event:target` — to
 * `context.dispatch`. Delegation means compiled templates carry no inline
 * listeners. Returns an uninstall function.
 */
export function installSemanticEventDelegation(root: ParentNode & EventTarget, context: RenderContext): () => void {
  const listener = (event: Event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;

    const attribute = `data-wx-${event.type}`;
    for (const element of event.composedPath()) {
      if (!(element instanceof Element)) continue;
      const actionTarget = element.getAttribute(attribute);
      if (actionTarget) {
        void context.dispatch?.({ type: event.type, target: actionTarget, event, element, context });
      }
      if (element === root) break;
    }
  };

  root.addEventListener("click", listener, { capture: true });
  root.addEventListener("submit", listener, { capture: true });
  root.addEventListener("change", listener, { capture: true });
  return () => {
    root.removeEventListener("click", listener, { capture: true });
    root.removeEventListener("submit", listener, { capture: true });
    root.removeEventListener("change", listener, { capture: true });
  };
}

/**
 * Reconcile `document.title` and `data-wx-head`-managed meta/link nodes with
 * the given entries. Only nodes the runtime created are touched, so static
 * head content from `index.html` (and prerendered head output, which emits
 * the same shape) survives client navigation.
 */
export function applyHead(entries: readonly HeadEntry[], documentRef: Document = document): void {
  const managed = new Set<Element>(documentRef.head.querySelectorAll("[data-wx-head]"));

  for (const entry of entries) {
    if (entry.tag === "title") {
      const existing = documentRef.head.querySelector("title") as HTMLTitleElement | null;
      const element = existing ?? documentRef.createElement("title");
      element.textContent = entry.text ?? "";
      element.setAttribute("data-wx-head", "");
      if (!element.parentNode) documentRef.head.append(element);
      documentRef.title = entry.text ?? "";
      managed.delete(element);
      continue;
    }

    const selector = headSelector(entry);
    const existing = selector ? (documentRef.head.querySelector(selector) as HTMLElement | null) : null;
    const element = existing ?? documentRef.createElement(entry.tag);

    for (const name of element.getAttributeNames()) {
      if (name !== "data-wx-head" && !(name in (entry.attributes ?? {}))) element.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(entry.attributes ?? {})) element.setAttribute(name, value);
    element.setAttribute("data-wx-head", "");
    if (!element.parentNode) documentRef.head.append(element);
    managed.delete(element);
  }

  // Remove previously managed entries the current page no longer declares.
  for (const stale of managed) stale.remove();
}

function resolveResourceDefinition(definition: ResourceDefinition, context: RenderContext): ResolvedResourceDefinition {
  const args = definition.getArgs ? definition.getArgs(context) : resolveResourceArgs(definition.args, context);
  return {
    name: definition.name,
    modulePath: definition.modulePath,
    functionName: definition.functionName,
    raw: definition.raw,
    kind: definition.kind ?? "query",
    args: args ?? {}
  };
}

function resolveResourceArgs(args: ResourceDefinition["args"], context: RenderContext): unknown {
  return typeof args === "function" ? args(context) : args;
}

function ensureResourceContainers(context: RenderContext): void {
  context.resources ??= {};
  context.resourceStates ??= {};
}

function markResourceLoading(context: RenderContext, name: string): void {
  ensureResourceContainers(context);
  const previousState = context.resourceStates?.[name];
  context.resourceStates![name] = {
    status: "loading",
    value: context.resources?.[name] ?? previousState?.value,
    updatedAt: Date.now()
  };
}

function markResourceReady(context: RenderContext, name: string, value: unknown): void {
  ensureResourceContainers(context);
  context.resources![name] = value;
  context.resourceStates![name] = { status: "ready", value, updatedAt: Date.now() };
}

function markResourceError(context: RenderContext, name: string, error: unknown): void {
  ensureResourceContainers(context);
  const previousState = context.resourceStates?.[name];
  context.resourceStates![name] = {
    status: "error",
    value: context.resources?.[name] ?? previousState?.value,
    error,
    updatedAt: Date.now()
  };
}

function clearResource(context: RenderContext, name: string): void {
  delete context.resources?.[name];
  delete context.resourceStates?.[name];
}

function disposeResource(teardown: ResourceTeardown): void {
  if (!teardown) return;
  if (typeof teardown === "function") {
    teardown();
    return;
  }
  teardown.unsubscribe?.();
  teardown.dispose?.();
}

function readCurrentValue(teardown: ResourceTeardown): unknown {
  if (!teardown) return undefined;
  if (typeof teardown === "function") return (teardown as { getCurrentValue?: () => unknown }).getCurrentValue?.();
  return teardown.getCurrentValue?.();
}

function resourceKey(definition: ResolvedResourceDefinition): string {
  return [definition.kind, definition.name, definition.modulePath, definition.functionName, stableSerialize(definition.args)].join("\0");
}

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item, seen)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue, seen)}`).join(",")}}`;
}

function parseConvexActionTarget(target: string): ActionDefinition | undefined {
  if (!target.startsWith("$$")) return undefined;
  const withoutSigils = target.slice(2);
  const splitIndex = withoutSigils.lastIndexOf(":");
  const modulePath = splitIndex === -1 ? "" : withoutSigils.slice(0, splitIndex).replace(/:/g, "/");
  const functionName = splitIndex === -1 ? "" : withoutSigils.slice(splitIndex + 1);
  if (!/^[A-Za-z0-9_./-]+$/.test(modulePath) || !/^[A-Za-z_$][\w$]*$/.test(functionName)) {
    throw new Error(
      `Invalid WAVEx Convex action target ${JSON.stringify(target)}. Expected $$module:function; inline args must be lowered to the element args property by the compiler.`
    );
  }
  return { target, modulePath, functionName, raw: target };
}

function collectActionArgs(action: WavexActionEvent): Record<string, unknown> {
  return {
    ...readDataAttributes(action.element),
    ...readFormArgs(action),
    ...readExplicitElementArgs(action.element)
  };
}

function readExplicitElementArgs(element: Element): Record<string, unknown> {
  const args = (element as Element & { args?: unknown }).args;
  if (args === undefined || args === null) return {};
  return normalizeConvexArgs(args);
}

function readFormArgs(action: WavexActionEvent): Record<string, unknown> {
  const form = formElementFromAction(action);
  if (!form || typeof FormData === "undefined") return {};
  return formDataToObject(new FormData(form));
}

function formElementFromAction(action: WavexActionEvent): HTMLFormElement | undefined {
  if (isHtmlFormElement(action.element)) return action.element;
  return isHtmlFormElement(action.event.target) ? action.event.target : undefined;
}

function isHtmlFormElement(value: unknown): value is HTMLFormElement {
  return typeof HTMLFormElement !== "undefined" && value instanceof HTMLFormElement;
}

function resetSubmittedForm(action: WavexActionEvent): void {
  if (action.type !== "submit") return;
  formElementFromAction(action)?.reset();
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [name, value] of formData.entries()) {
    const previous = output[name];
    if (previous === undefined) {
      output[name] = value;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      output[name] = [previous, value];
    }
  }
  return output;
}

function readDataAttributes(element: Element): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const name of element.getAttributeNames()) {
    if (!name.startsWith("data-") || name.startsWith("data-wx-")) continue;
    const value = element.getAttribute(name);
    if (value !== null) output[dataAttributeNameToArgName(name)] = value;
  }
  return output;
}

function dataAttributeNameToArgName(name: string): string {
  return name
    .slice("data-".length)
    .replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

function markActionPending(context: RenderContext, target: string): void {
  context.actionStates ??= {};
  context.actionStates[target] = { status: "pending", pending: true, updatedAt: Date.now() };
}

function markActionIdle(context: RenderContext, target: string, result: unknown): void {
  context.actionStates ??= {};
  context.actionStates[target] = { status: "idle", pending: false, result, updatedAt: Date.now() };
}

function markActionError(context: RenderContext, target: string, error: unknown): void {
  context.actionStates ??= {};
  context.actionStates[target] = { status: "error", pending: false, error, updatedAt: Date.now() };
}

function resolveConvexApiReference(api: unknown, definition: { modulePath: string; functionName: string }): unknown {
  let target = api;
  for (const segment of definition.modulePath.split(/[/:.]/).filter(Boolean)) {
    if (!isObjectLike(target)) return undefined;
    target = (target as Record<string, unknown>)[segment];
  }
  if (!isObjectLike(target)) return undefined;
  return (target as Record<string, unknown>)[definition.functionName];
}

function convexFunctionPath(definition: { modulePath: string; functionName: string }): string {
  return `${definition.modulePath}:${definition.functionName}`;
}

function normalizeConvexArgs(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) return {};
  if (typeof args === "object" && !Array.isArray(args)) return args as Record<string, unknown>;
  throw new Error(`Convex query args for WAVEx resources must be an object; received ${typeof args}.`);
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
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

export {
  analyticsEventNameForTarget,
  createPostHogCaptureClient,
  type AnalyticsClient,
  type PostHogCaptureOptions
} from "./analytics.js";
export {
  composeLayoutRender,
  createClientRouter,
  type ClientRoute,
  type ClientRouter,
  type ClientRouterOptions,
  type RoutePageModule,
  type RouterPageHost
} from "./router.js";
