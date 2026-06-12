declare module "*.wx" {
  import type { RenderContext, RenderFunction, ResourceDefinition } from "@wavex/runtime";

  export const resources: readonly ResourceDefinition[];
  export function head(context?: RenderContext): unknown;

  const render: RenderFunction;
  export default render;
}
