// The slice of convex/server the .wx virtual code imports, for a fixture without the convex package.
declare module "convex/server" {
  export type FunctionReturnType<Reference> = Reference extends { _returnType: infer Return } ? Return : never;
}
