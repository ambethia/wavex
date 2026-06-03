import { render as litRender } from "lit";
import { createRenderContext, installSemanticEventDelegation, type RenderContext, type RenderFunction } from "@wavex/runtime";

export interface LitMount<Result = unknown> {
  context: RenderContext;
  update(nextContext?: RenderContext): void;
  setRender(nextRender: RenderFunction<Result>): void;
  dispose(): void;
  root: HTMLElement;
  result?: Result;
}

export function mountLit<Result = unknown>(
  root: HTMLElement,
  render: RenderFunction<Result>,
  initialContext: RenderContext = {}
): LitMount<Result> {
  const context = createRenderContext(initialContext);
  let result: Result | undefined;
  let renderCurrent = render;
  const disposeDelegation = installSemanticEventDelegation(root, context);

  const update = (nextContext: RenderContext = {}) => {
    Object.assign(context, createRenderContext({ ...context, ...nextContext }));
    result = renderCurrent(context);
    litRender(result as unknown, root);
  };

  const setRender = (nextRender: RenderFunction<Result>) => {
    renderCurrent = nextRender;
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
    dispose() {
      disposeDelegation();
      litRender(undefined, root);
    }
  };
}
