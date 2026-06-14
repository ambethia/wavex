declare module "convex/server" {
  export type FunctionReturnType<FunctionReference> = FunctionReference extends { _returnType: infer Return } ? Return : never;
}
