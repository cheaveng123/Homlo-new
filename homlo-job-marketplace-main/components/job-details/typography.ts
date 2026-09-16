// Typography tokens. Both font families are loaded globally via
// lib/typography.ts (fontAssets -> app/_layout useFonts).
//
// Headings use Space Grotesk (distinct, technical) — body and UI text use
// Manrope (clean, legible at small sizes). Two families only, each with one
// clear job — don't introduce a third.

export const fonts = {
  headingSemiBold: "SpaceGrotesk_600SemiBold",
  headingMedium: "SpaceGrotesk_500Medium",
  bodyRegular: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
};

export const type = {
  h1: { fontFamily: fonts.headingSemiBold, fontSize: 20, lineHeight: 27 },
  h2: { fontFamily: fonts.headingSemiBold, fontSize: 16.5, lineHeight: 23 },
  price: { fontFamily: fonts.headingSemiBold, fontSize: 18, lineHeight: 25 },
  statValue: { fontFamily: fonts.headingSemiBold, fontSize: 16, lineHeight: 20 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14.5, lineHeight: 19.5 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 17 },
  button: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
};