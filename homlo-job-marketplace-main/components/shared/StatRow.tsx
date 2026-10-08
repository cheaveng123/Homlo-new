import React from "react";
import { View, Text } from "react-native";

import { jobsColors } from "@/constants/jobsTheme";

export interface StatItem {
  value: string;
  label: string;
}

export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <View
      className="flex-row rounded-2xl overflow-hidden"
      style={{ borderWidth: 1, borderColor: jobsColors.border }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          className="flex-1 items-center py-3.5 px-1"
          style={{
            borderRightWidth: index < items.length - 1 ? 1 : 0,
            borderRightColor: jobsColors.border,
          }}
        >
          <Text className="text-[17px] font-bold" style={{ color: jobsColors.textPrimary }}>
            {item.value}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: jobsColors.textSecondary }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}