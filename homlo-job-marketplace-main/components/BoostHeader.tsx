import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";

import { colors, fonts } from "@/theme";

export function BoostHeader({
  step,
  failed = false,
  canGoBack = true,
}: {
  step: 1 | 2 | 3;
  failed?: boolean;
  canGoBack?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {canGoBack ? (
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <AppIcon name="back" size={26} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.bars}>
        {[1, 2, 3].map((value) => (
          <View
            key={value}
            style={[
              styles.bar,
              value <= step && { backgroundColor: failed && value === step ? colors.danger : colors.teal },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{step}/3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 10 },
  placeholder: { width: 26 },
  bars: { flex: 1, flexDirection: "row", gap: 6 },
  bar: { backgroundColor: "#DFE4E1", borderRadius: 4, flex: 1, height: 4 },
  label: { color: colors.sub, fontFamily: fonts.bold, fontSize: 12 },
});
