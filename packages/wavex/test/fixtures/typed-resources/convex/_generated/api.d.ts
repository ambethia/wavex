type Reward = { id: string; status: "outstanding" | "fulfilled" };

export declare const api: {
  pledges: {
    list: { _returnType: { page: Array<{ id: string; campaignName: string; rewards: Reward[] }>; isDone: boolean; continueCursor: string } };
    detail: { _returnType: { id: string; campaignName: string; campaignUrl: string | null } };
  };
};
