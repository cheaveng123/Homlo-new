import React from "react";
import { View } from "react-native";

import { jobsColors } from "@/constants/jobsTheme";

export function IconTile({ children, size = 42 }: { children: React.ReactNode; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: jobsColors.mintTint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}