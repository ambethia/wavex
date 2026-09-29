declare module "@wavex/runtime" {
  interface Register {
    state: {
      auth: {
        user: { email: string; forwarding: { address: string } | null } | null;
        emails: Array<{ id: string; subject: string }>;
      };
    };
  }
}

export {};
