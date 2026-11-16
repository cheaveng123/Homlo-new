import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { TextNew } from "../components/TextNew";
import { appColors, appRadius, appShadow } from "./theme";

export function SectionCard({
  children,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View accessible={Boolean(accessibilityLabel)} accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <TextNew variant="caption" weight="semibold" color={appColors.muted} style={styles.label}>
      {children}
    </TextNew>
  );
}

export const applicationUiStyles = StyleSheet.create({
  divider: { backgroundColor: appColors.divider, height: StyleSheet.hairlineWidth },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surface,
    borderColor: appColors.border,
    borderRadius: appRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...appShadow.sm,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
