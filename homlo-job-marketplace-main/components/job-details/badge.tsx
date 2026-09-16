import { View, Text, StyleSheet } from "react-native";

import { colors } from "./colors";
import { fonts } from "./typography";

type Props = { label: string };

export default function Badge({ label }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
});