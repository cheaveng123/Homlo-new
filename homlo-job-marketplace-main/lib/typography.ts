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
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from "@expo-google-fonts/space-grotesk";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  ...MaterialIcons.font,
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
