import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from "react-native";

import { familyForWeight } from "@/lib/typography";

export function Text({ style, ...props }: TextProps) {
  const flattenedStyle = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontFamily: _ignoredFontFamily, fontWeight, ...remainingStyle } = flattenedStyle;

  return <NativeText {...props} style={[remainingStyle, { fontFamily: familyForWeight(fontWeight) }]} />;
}
