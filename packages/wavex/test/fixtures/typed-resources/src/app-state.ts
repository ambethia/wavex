declare module "@wavex/runtime" {
  interface Register {
    state: {
      auth: { user: { email: string } | null };
      pledges: { detailId: string | null };
    };
  }
}

export {};
