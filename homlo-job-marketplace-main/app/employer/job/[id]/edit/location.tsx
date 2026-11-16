import { useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Region } from "react-native-maps";
import { AppIcon } from "@/components/ui/AppIcon";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { JobLocationPicker, type PickedAddress } from "@/components/JobLocationPicker";
import { writeJobEditDraft } from "@/lib/job-edit-draft";
import { goBack } from "@/lib/navigation";

/**
 * Location picker for the Edit job screen. Reuses the same JobLocationPicker
 * as the post-job wizard; the pinned address is written to the edit draft
 * (AsyncStorage) and merged by the screen when it regains focus.
 */
export default function LocationPickerScreen() {
  const router = useRouter();
  const { id, lat, lng } = useLocalSearchParams<{ id: string; lat?: string; lng?: string }>();
  const [picked, setPicked] = useState<PickedAddress | null>(null);

  const initialRegion = useMemo<Region | undefined>(() => {
    const latitude = lat && lat.trim() ? Number(lat) : NaN;
    const longitude = lng && lng.trim() ? Number(lng) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
    return { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [lat, lng]);

  function confirm() {
    if (!id || !picked) return;
    void writeJobEditDraft(id, {
      locationLabel: picked.formatted,
      latitude: picked.latitude,
      longitude: picked.longitude,
    }).then(() => goBack(router));
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <TouchableOpacity onPress={() => goBack(router)} hitSlop={10}>
          <AppIcon name="back" size={20} color="#17201A" />
        </TouchableOpacity>
        <Text className="text-[15px] font-semibold text-foreground">Job location</Text>
        <View style={{ width: 20 }} />
      </View>

      <View className="flex-1 px-4 pb-5">
        <JobLocationPicker onSelect={setPicked} initialRegion={initialRegion} />

        <TouchableOpacity
          onPress={confirm}
          disabled={!picked}
          className={`mt-4 rounded-2xl py-3.5 items-center flex-row justify-center gap-2 ${
            picked ? "bg-primary" : "bg-border"
          }`}
        >
          <AppIcon name="check" size={16} color={picked ? "#FFFFFF" : "#66736A"} />
          <Text className={`text-[14px] font-semibold ${picked ? "text-white" : "text-muted"}`}>
            Use this location
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}