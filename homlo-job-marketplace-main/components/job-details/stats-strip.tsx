import { View, Text, StyleSheet } from "react-native";

import { colors } from "./colors";
import { type } from "./typography";

export type Stat = { value: string; label: string };

export default function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.cell, i < stats.length - 1 && styles.cellDivider]}>
          <Text style={type.statValue} numberOfLines={1}>
            {stat.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
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
  label: {
    fontFamily: type.caption.fontFamily,
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
});