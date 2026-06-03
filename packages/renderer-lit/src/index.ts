import { render as litRender } from "lit";
import { createRenderContext, installSemanticEventDelegation, type RenderContext, type RenderFunction } from "@wavex/runtime";

export interface LitMount<Result = unknown> {
  context: RenderContext;
  update(nextContext?: RenderContext): void;
  dispose(): void;
  root: HTMLElement;
  result?: Result;
}

export function mountLit<Result = unknown>(
  root: HTMLElement,
  render: RenderFunction<Result>,
  initialContext: RenderContext = {}
): LitMount<Result> {
  let context = createRenderContext(initialContext);
  let result: Result | undefined;
  const disposeDelegation = installSemanticEventDelegation(root, context);

  const update = (nextContext: RenderContext = {}) => {
    context = createRenderContext({ ...context, ...nextContext });
    result = render(context);
    litRender(result as unknown, root);
  };

  update(context);

  return {
    context,
    root,
    get result() {
      return result;
    },
    update,
    dispose() {
      disposeDelegation();
      litRender(undefined, root);
    }
  };
}
