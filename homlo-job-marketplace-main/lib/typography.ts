import type { TextStyle } from "react-native";

// Font files live in assets/fonts and are bundled into the app binary by
// `npx react-native-asset` (see react-native.config.js). Each file's internal
// name equals the family string used below (e.g. "Inter_400Regular"), so the
// same string works on iOS and Android. Families in use:
//   Inter, Plus Jakarta Sans (also as "PlusJakartaSans-Bold" etc. for
//   theme/tokens.ts), Figtree (job cards), Bricolage Grotesque 700 (home
//   section titles), Noto Sans Khmer (src/new).

export const fontFamilies = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.bold },
  heading: { fontFamily: fontFamilies.semibold },
  title: { fontFamily: fontFamilies.semibold },
  body: { fontFamily: fontFamilies.regular },
  label: { fontFamily: fontFamilies.medium },
  button: { fontFamily: fontFamilies.semibold },
} as const;

export function familyForWeight(weight: TextStyle["fontWeight"]) {
  const numericWeight = typeof weight === "number" ? weight : Number(weight);
  if (weight === "bold" || numericWeight >= 700) return fontFamilies.bold;
  if (numericWeight >= 600) return fontFamilies.semibold;
  if (numericWeight >= 500 || weight === "medium") return fontFamilies.medium;
  return fontFamilies.regular;
}

/**
 * Design-token font-family names. These mirror the exact family keys that
 * `fontAssets` above loads in app/_layout.tsx, so screens can reference
 * `fonts.heading.bold` / `fonts.body.regular` without extra loading.
 */
export const fonts = {
  heading: {
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semibold: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
    extrabold: "PlusJakartaSans_800ExtraBold",
  },
  body: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
  },
} as const;

/** Reusable text styles — spread these into StyleSheet entries. */
export const type = {
  // Big stat numbers, screen titles
  displayNumber: { fontFamily: fonts.heading.extrabold, fontSize: 22 },
  screenName: { fontFamily: fonts.heading.bold, fontSize: 21, letterSpacing: -0.2 },
  sectionTitle: { fontFamily: fonts.heading.semibold, fontSize: 15 },
  cardTitle: { fontFamily: fonts.heading.semibold, fontSize: 14.5 },

  // Body / meta text
  label: { fontFamily: fonts.body.medium, fontSize: 12.5 },
  meta: { fontFamily: fonts.body.regular, fontSize: 12 },
  tag: { fontFamily: fonts.body.semibold, fontSize: 10.5 },
  navLabel: { fontFamily: fonts.body.semibold, fontSize: 9.5 },
} as const;
