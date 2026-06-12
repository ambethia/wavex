// Module declarations for .wx files as transformed by the wavex Vite plugin.
// Reference from an app tsconfig: "types": ["@wavex/vite-plugin/client"].
declare module "*.wx" {
  import type { HeadEntry, RenderContext, RenderFunction, ResourceDefinition } from "@wavex/runtime";

  export const resources: readonly ResourceDefinition[];
  export function headEntries(context?: RenderContext): HeadEntry[];

  const render: RenderFunction;
  export default render;
}
