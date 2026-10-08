import React from "react";
import { View, Image } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";

import { jobsColors } from "@/constants/jobsTheme";

export function Avatar({
  uri,
  size = 88,
  ring = true,
}: {
  uri?: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#F2F3F5",
        borderWidth: ring ? 4 : 0,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: ring ? 0.12 : 0,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: ring ? 2 : 0,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <AppIcon name="user" size={size * 0.42} color={jobsColors.textTertiary} />
      )}
    </View>
  );
}