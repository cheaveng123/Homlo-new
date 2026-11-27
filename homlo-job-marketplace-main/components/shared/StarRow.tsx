import React from "react";
import { View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";

import { jobsColors } from "@/constants/jobsTheme";

export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row" style={{ gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <AppIcon
          key={i}
          name="star"
          size={size}
          color={jobsColors.mint}
        />
      ))}
    </View>
  );
}