import { colors as tokensColors } from "./tokens";
import { colors as legacyColors, fonts, font, radii as legacyRadii } from "./legacy";

export const colors = { ...tokensColors, ...legacyColors };
export const radii = {
  ...legacyRadii,
  searchBar: 16,
  standard: 20 /* PLACEHOLDER, no committed value */,
} as const;
export { fonts, font };
export { radius } from "./tokens";
export { spacing } from "./tokens";
export { fontFamily } from "./tokens";
export { type } from "./tokens";
export { sizes } from "./tokens";
