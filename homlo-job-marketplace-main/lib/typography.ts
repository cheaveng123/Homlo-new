import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
// PERF: Space Grotesk and Manrope are no longer referenced by any screen
// (components/job-details/typography.ts moved off them), so they are not
// loaded at startup any more: 5 fewer font files (464 KB) before first paint.
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import type { TextStyle } from "react-native";

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  // theme/tokens.ts (inbox/chat redesign) references these family names.
  "PlusJakartaSans-Regular": PlusJakartaSans_400Regular,
  "PlusJakartaSans-Medium": PlusJakartaSans_500Medium,
  "PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
  "PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
  "PlusJakartaSans-ExtraBold": PlusJakartaSans_800ExtraBold,
  // Figtree is used only inside job containers — see
  // components/jobs/jobCardTokens.ts. Not part of fonts.heading/body below,
  // so nothing outside the job card changes typeface.
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  // Home section titles only — see components/home/SectionHeader.tsx. Not in
  // `fonts` below, so no other surface picks up this typeface.
  BricolageGrotesque_700Bold,
};

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
