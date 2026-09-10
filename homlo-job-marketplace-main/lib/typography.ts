import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { TextStyle } from "react-native";

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
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
