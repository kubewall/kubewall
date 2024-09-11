type KwEventSource = {
  url: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  sendMessage: (message: any) => void;
};

export {
  KwEventSource
};