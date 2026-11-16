/**
 * Vitest stand-in for `react-native`.
 *
 * Metro is the only runtime that must see the real `react-native` module;
 * Vite/rollup cannot parse its Flow-annotated source. Only the pieces that
 * lib/ helpers touch at module scope or in tested paths belong here.
 */
export const Image = {
  getSize: (_uri: string): Promise<{ width: number; height: number }> =>
    Promise.reject(new Error("react-native Image.getSize is unavailable in tests")),
};

export default { Image };
