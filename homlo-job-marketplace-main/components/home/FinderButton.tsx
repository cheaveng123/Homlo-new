import { Pressable, Text, View, StyleSheet } from "react-native";

import { colors, type } from "./theme";

export function FinderButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={type.finderLabel}>Don&apos;t know where to start?</Text>
      <View style={styles.arrowCircle}>
        <Text style={styles.arrowGlyph}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 17,
    paddingLeft: 20,
    paddingRight: 18,
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: 20,
    backgroundColor: "transparent",
    shadowColor: colors.amber,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pressed: { backgroundColor: colors.amberTint },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowGlyph: { color: colors.amberDark, fontSize: 16 },
});