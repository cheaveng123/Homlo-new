import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useMapJobs } from "@/lib/nearestJobs";
import { NearbyJobsMap } from "@/src/components/NearbyJobsMap";

export default function JobsMapScreen() {
  const router = useRouter();
  const jobs = useMapJobs();

  const pins = useMemo(
    () =>
      jobs.map((job) => ({
        id: job.id,
        title: job.title,
        latitude: job.lat,
        longitude: job.lng,
      })),
    [jobs],
  );

  return (
    <View style={{ flex: 1 }}>
      <NearbyJobsMap
        jobs={pins}
        radiusKm={10}
        maxPins={50}
        onViewJob={(job) => {
          router.push({
            pathname: "/job/[id]",
            params: { id: job.id },
          } as never);
        }}
      />
    </View>
  );
}
