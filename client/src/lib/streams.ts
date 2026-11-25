// This tab's open event streams, for extensions: close them all (to free
// browser connections) and hear about failed ones.
const openStreams = new Set<() => void>();
let closedAll = false;
let errorHandler: (() => void) | undefined;

// A stream opened after closeAllStreams() is closed at once.
const registerStream = (close: () => void) => {
  if (closedAll) {
    close();
    return () => undefined;
  }
  openStreams.add(close);
  return () => {
    openStreams.delete(close);
  };
};

const closeAllStreams = () => {
  closedAll = true;
  openStreams.forEach((close) => close());
  openStreams.clear();
};

const onStreamError = (handler: () => void) => {
  errorHandler = handler;
};

export { closeAllStreams, onStreamError, registerStream };
export const notifyStreamError = () => errorHandler?.();
