/**
 * SectionHeader.tsx (home)
 *
 * The heading strip that opens every section on the Home feed. One component so
 * the title type, the "See all" affordance and the spacing above and below stay
 * identical across Recommended, Jobs near you, Popular, Explore and the two icon
 * groups — previously each was assembled separately.
 *
 * Section titles only: this is deliberately not a screen or navigation header,
 * which are owned by their own components.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

export type SectionHeaderProps = {
  title: string;
  /** Small line under the title. Only Recommended uses it today. */
  subtitle?: string;
  /** When provided, renders the trailing "See all" link. */
  onSeeAll?: () => void;
};

export function SectionHeader({ title, subtitle, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: spacing.screenX,
    paddingTop: 22,
    paddingBottom: 12,
  },
  // `flex: 1` so a long title shrinks and truncates instead of pushing the
  // "See all" link off the right edge.
  left: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 22,
    lineHeight: 23,
    letterSpacing: -0.66,
    color: colors.text,
  },
  subtitle: {
    fontFamily: "Figtree_500Medium",
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 4,
  },
  // Sits on the title's first line rather than the block's vertical middle, so
  // the two read as one row; the subtitle must not pull it down.
  link: {
    fontFamily: "Figtree_700Bold",
    fontSize: 13,
    color: colors.teal,
    marginTop: 4,
  },
});