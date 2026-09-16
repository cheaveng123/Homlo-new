import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors } from "./colors";
import { fonts } from "./typography";

// Stand-in for any image that doesn't exist yet, or that the app hasn't
// loaded a real URL for. Every screen that needs a real photo (cover image,
// company logo, employer avatar) renders this instead of <Image>, marked
// with an "IMAGE:" comment at the call site — search for that string when
// wiring up real data.
//
// Keep this component even after real images are wired in: it should stay
// as the fallback UI for employers/users who haven't uploaded a photo yet.

type Props = {
  width?: number;
  height?: number;
  borderRadius?: number;
  icon?: keyof typeof Feather.glyphMap;
  label?: string;
  style?: ViewStyle;
};

export default function ImagePlaceholder({
  width,
  height,
  borderRadius = 10,
  icon = "image",
  label,
  style,
}: Props) {
  return (
    <View style={[styles.base, { width, height, borderRadius }, style]}>
      <Feather name={icon} size={21} color={colors.placeholderIcon} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.placeholderBg,
    borderWidth: 1.5,
    borderColor: colors.placeholderBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.placeholderIcon,
    marginTop: 5,
  },
});