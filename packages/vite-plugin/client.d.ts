// Module declarations for .wx files as transformed by the wavex Vite plugin.
// Reference from an app tsconfig: "types": ["@wavex/vite-plugin/client"].
declare module "*.wx" {
  import type { HeadEntry, RenderContext, RenderFunction, ResourceDefinition } from "@wavex/runtime";

  export const wxFile: {
    readonly id: string;
    readonly localComponents: readonly string[];
  };
  export const resources: readonly ResourceDefinition[];
  export function headEntries(context?: RenderContext): HeadEntry[];
  export const render: RenderFunction;
  export default render;
}

declare module "virtual:wavex/routes" {
  import type { ClientRoute } from "@wavex/runtime";

  export const routes: readonly ClientRoute[];
  export default routes;
}

declare module "virtual:wavex/manifest" {
  import type { ActionKindResolver } from "@wavex/runtime";

  export const actionKinds: Readonly<Record<string, "mutation" | "action">>;
  export const viewTransitions: boolean;
  export const resolveActionKind: ActionKindResolver;
  const manifest: {
    readonly actionKinds: typeof actionKinds;
    readonly viewTransitions: typeof viewTransitions;
    readonly resolveActionKind: typeof resolveActionKind;
  };
  export default manifest;
}

declare module "virtual:wavex/icons" {
  // Side-effect module. With a Font Awesome kit or SVG package installed it points
  // Web Awesome's default icon library at the app's self-hosted icons; compiled
  // .wx modules import it before any Web Awesome component. Import it first from
  // an app-owned entry that renders Web Awesome icons outside .wx templates.
  export {};
}
