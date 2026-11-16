import React from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { AppIcon } from "@/components/ui/AppIcon";

import { jobsColors } from "@/constants/jobsTheme";

export default function MessagesStubScreen() {
  const router = useRouter();
  const { employerId } = useLocalSearchParams<{ employerId?: string }>();

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5 pt-14 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ width: 30 }}>
          <AppIcon name="back" size={22} color={jobsColors.textPrimary} />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-10" style={{ paddingBottom: 80 }}>
        <Text className="text-[17px] font-bold text-center" style={{ color: jobsColors.textPrimary }}>
          Messaging is coming soon
        </Text>
        <Text className="mt-2 text-sm text-center" style={{ color: jobsColors.textSecondary }}>
          {employerId
            ? "Message this employer directly once messaging is available."
            : "Direct messaging with employers will be available soon."}
        </Text>
      </View>
    </View>
  );
}