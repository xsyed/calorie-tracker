declare const crypto: {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
};
