import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "@/lib/router";

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
        category: job.category ?? null,
        subtitle: `${job.employerName} · ${job.locationLabel.split(",")[0]}`,
        // "$180 / hour" -> "$180": the pin shows the amount, the card the rest.
        label: job.salaryLabel.split(" / ")[0],
        latitude: job.lat,
        longitude: job.lng,
      })),
    [jobs],
  );

  return (
    <View style={{ flex: 1 }}>
      <NearbyJobsMap
        jobs={pins}
        onBack={() => router.back()}
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
