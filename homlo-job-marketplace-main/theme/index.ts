import { colors as tokensColors, fontFamily as tokensFontFamily } from "./tokens";
import { colors as legacyColors, fonts, font, radii as legacyRadii, fontFamily as legacyFontFamily } from "./legacy";

export const colors = { ...tokensColors, ...legacyColors, textPrimary: legacyColors.text, textSecondary: legacyColors.muted };
export const radii = {
  ...legacyRadii,
  searchBar: 16,
  standard: 20 /* PLACEHOLDER, no committed value */,
} as const;
export { fonts, font };
export { radius } from "./tokens";
export { spacing } from "./tokens";
export const fontFamily = { ...tokensFontFamily, ...legacyFontFamily };
export { type } from "./tokens";
export { sizes } from "./tokens";
