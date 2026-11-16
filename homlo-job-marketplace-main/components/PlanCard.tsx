import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";

import { type BoostPlan, fmt, priceFor } from "@/lib/boostData";
import { colors, fonts } from "@/theme";

export function PlanCard({
  plan,
  selected,
  onPress,
  isPro = false,
  style,
}: {
  plan: BoostPlan;
  selected: boolean;
  onPress: () => void;
  isPro?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const foreground = selected ? "#FFFFFF" : colors.muted;
  return (
    <Pressable
      accessibilityLabel={`${plan.name} boost, ${fmt(priceFor(plan, isPro))}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.selected, style]}
    >
      <View style={styles.tag}>
        <Text style={[styles.tagText, { color: foreground }]}>{plan.tag}</Text>
      </View>
      <Text style={[styles.name, { color: foreground }]}>{plan.name}</Text>
      <Text style={[styles.subtitle, { color: foreground }]}>
        {plan.days} days · 1 boost
      </Text>
      <View style={styles.priceBox}>
        <Text style={[styles.price, { color: foreground }]}>
          {fmt(priceFor(plan, isPro))}
        </Text>
        <Text style={[styles.proPrice, { color: foreground }]}>
          {isPro ? "Pro price" : `Pro ${fmt(plan.proPrice)}`}
        </Text>
      </View>
      {selected ? (
        <View style={styles.features}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <AppIcon name="check" color="#FFFFFF" size={14} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.track,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    padding: 14,
  },
  selected: {
    backgroundColor: colors.teal,
    elevation: 6,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tag: {
    backgroundColor: "rgba(0,0,0,0.13)",
    borderBottomLeftRadius: 34,
    paddingBottom: 12,
    paddingLeft: 22,
    paddingRight: 12,
    paddingTop: 8,
    position: "absolute",
    right: 0,
    top: 0,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  name: { fontFamily: fonts.bold, fontSize: 16 },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
    opacity: 0.85,
  },
  priceBox: {
    alignItems: "flex-end",
    position: "absolute",
    right: 14,
    top: 44,
  },
  price: { fontFamily: fonts.bold, fontSize: 20 },
  proPrice: { fontFamily: fonts.bold, fontSize: 11, opacity: 0.85 },
  features: {
    borderTopColor: "rgba(255,255,255,0.3)",
    borderTopWidth: 1,
    gap: 5,
    marginTop: 12,
    paddingRight: 80,
    paddingTop: 10,
  },
  featureRow: { alignItems: "flex-start", flexDirection: "row", gap: 6 },
  featureText: {
    color: "#FFFFFF",
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
});
