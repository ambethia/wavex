export declare const api: {
  talks: {
    list: { _returnType: Array<{ title: string; minutes: number }> };
    page: { _returnType: { page: Array<{ title: string; minutes: number }>; isDone: boolean; continueCursor: string } };
  };
  "talks-alt": {
    list: { _returnType: Array<{ title: string; minutes: number }> };
  };
};
