import { View, Text, StyleSheet, Image } from "react-native";

import { colors } from "./colors";
import { type } from "./typography";

/**
 * A `require()` handle for a bundled asset — the form React Native's `Image`
 * `source` prop takes, and what `jobTypeImage` returns.
 */
export type Stat = { value: string; label: string; image?: number };

/** Home draws these at 46px in a 64px tile; the stat cell is far narrower, so
 *  it is scaled down here rather than shrunk inside its tile. */
const STAT_IMAGE_SIZE = 38;

export default function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.cell, i < stats.length - 1 && styles.cellDivider]}>
          {stat.image ? (
            // The same custom artwork as the home row under "Don't know where
            // to start?" — see components/shared/jobTypeImage.ts.
            <Image
              source={stat.image}
              style={styles.image}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={type.statValue} numberOfLines={1}>
            {stat.value}
          </Text>
          <Text style={type.statLabel} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  cellDivider: {
    borderRightWidth: 0.5,
    borderRightColor: colors.border,
  },
  image: { width: STAT_IMAGE_SIZE, height: STAT_IMAGE_SIZE, marginBottom: 3 },
});
