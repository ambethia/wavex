import { render as litRender } from "lit";
import {
  createRenderContext,
  createResourceController,
  createSemanticActionDispatcher,
  installSemanticEventDelegation,
  type ActionClient,
  type ActionKindResolver,
  type RenderContext,
  type RenderFunction,
  type ResourceClient,
  type ResourceController,
  type ResourceDefinition
} from "./index.js";

export interface LitMountOptions {
  resources?: readonly ResourceDefinition[];
  resourceClient?: ResourceClient;
  actionClient?: ActionClient;
  resolveActionKind?: ActionKindResolver;
}

export interface WavexPageModule<Result = unknown> {
  default?: RenderFunction<Result>;
  render?: RenderFunction<Result>;
  resources?: readonly ResourceDefinition[];
}

export interface LitMount<Result = unknown> {
  context: RenderContext;
  update(nextContext?: RenderContext): void;
  setRender(nextRender: RenderFunction<Result>): void;
  setResources(nextResources: readonly ResourceDefinition[]): void;
  dispose(): void;
  root: HTMLElement;
  result?: Result;
}

export function mountLit<Result = unknown>(
  root: HTMLElement,
  render: RenderFunction<Result>,
  initialContext: RenderContext = {},
  options: LitMountOptions = {}
): LitMount<Result> {
  const context = createRenderContext(initialContext);
  if (options.actionClient) {
    context.dispatch = createSemanticActionDispatcher(context, {
      actionClient: options.actionClient,
      dispatch: context.dispatch,
      resolveActionKind: options.resolveActionKind
    });
  }
  let result: Result | undefined;
  let renderCurrent = render;
  let resourceDefinitions = [...(options.resources ?? [])];
  let resourceController: ResourceController | undefined;
  let updateRequested = false;

  const update = (nextContext: RenderContext = {}) => {
    Object.assign(context, createRenderContext({ ...context, ...nextContext }));
    resourceController?.update(resourceDefinitions);
    result = renderCurrent(context);
    litRender(result as unknown, root);
  };

  const requestUpdate = () => {
    if (updateRequested) return;
    updateRequested = true;
    queueMicrotask(() => {
      updateRequested = false;
      update();
    });
  };

  const disposeDelegation = installSemanticEventDelegation(root, context);
  resourceController = createResourceController(context, resourceDefinitions, {
    client: options.resourceClient,
    onChange: requestUpdate
  });

  const setRender = (nextRender: RenderFunction<Result>) => {
    renderCurrent = nextRender;
    update();
  };

  const setResources = (nextResources: readonly ResourceDefinition[]) => {
    resourceDefinitions = [...nextResources];
    resourceController ??= createResourceController(context, resourceDefinitions, {
      client: options.resourceClient,
      onChange: requestUpdate
    });
    update();
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
    dispose() {
      resourceController?.dispose();
      resourceController = undefined;
      disposeDelegation();
      litRender(undefined, root);
    }
  };
}

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
