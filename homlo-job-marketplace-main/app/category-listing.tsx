import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";

import ExploreCategoryJobsWaveGradientHeaderScreen from "@/components/jobs/ExploreCategoryJobsWaveGradientHeaderScreen";
import { JobCard } from "@/components/jobs/JobCard";
import type { SearchJobRecord } from "@/hooks/use-job-search";
import { trpc } from "@/lib/trpc";
import { logJobEvent } from "@/lib/event-logging";
import { haptic } from "@/lib/haptics";
import { defaultSearchCenter, haversineDistance } from "@/lib/job-geography";
import { useUserLocation } from "@/lib/use-user-location";
import { employerIdForCompany } from "@/lib/mock/employerMockData";
import { goBack } from "@/lib/navigation";
import { computePositionsLeft } from "@/lib/positions";
import { isAwaitingData, useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";

const THUMB_BG = ["#14324A", "#C97A16", "#0891B2", "#14324A", "#F5A524"];
const EMPLOYER_BG = ["#14324A", "#F5A524"];

function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}



function jobDistance(record: SearchJobRecord, center: { latitude: number; longitude: number }): string {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const km = haversineDistance(center, { latitude: lat, longitude: lng });
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }
  return record.location_text?.trim() || "Location TBC";
}

function jobSalary(record: SearchJobRecord): string {
  const amount = Number(record.pay_amount);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : String(record.pay_amount ?? "");
  const currency = (record.pay_currency ?? "USD").toUpperCase();
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const unit = record.pay_type === "hourly" ? "hr" : record.pay_type === "daily" ? "day" : "mo";
  return `${symbol}${formatted} / ${unit}`;
}

function jobToListing(record: SearchJobRecord, center: { latitude: number; longitude: number }) {
  return {
    id: record.id,
    title: record.title,
    employerName: record.employer_name?.trim() || "Homlo employer",
    employerColor: THUMB_BG[hashOf(record.employer_name ?? record.id) % THUMB_BG.length],
    payLabel: jobSalary(record),
    locationLabel: jobDistance(record, center),
    positionsLeft: computePositionsLeft(record.workers_needed, record.workers_hired),
    positionsTotal: Number(record.workers_needed) > 0 ? Number(record.workers_needed) : null,
  };
}

function employersFrom(records: SearchJobRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const name = (record.employer_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name], index) => ({
      id: employerIdForCompany(name),
      initial: (name[0] ?? "?").toUpperCase(),
      name,
      bg: EMPLOYER_BG[index % EMPLOYER_BG.length],
    }));
}

export default function CategoryListingRoute() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ category?: string; title?: string }>();
  const category = (raw.category ?? "").trim();
  const title = (raw.title ?? (category ? `${category} jobs` : "All jobs")).trim();
  const { location } = useUserLocation();
  const center = location ?? defaultSearchCenter;

  const searchQuery = trpc.homlo.searchJobs.useQuery(
    { ...(category ? { category } : {}), limit: 40, sort: "recommended" },
    { staleTime: 30_000 }
  );
  const { data } = searchQuery;
  // Not `isLoading` (false for a pending query that isn't fetching yet).
  const isLoading = isAwaitingData(searchQuery);

  const jobs = useMemo(
    () => (data?.jobs ?? []).map((record) => jobToListing(record, center)),
    [data, center]
  );
  const employers = useMemo(() => employersFrom(data?.jobs ?? []), [data]);
  const showSkeleton = useFirstLoadSkeletonFlag({
    loading: isLoading,
    data: jobs.length ? jobs : undefined,
  });

  return (
    <View style={styles.screen}>
      <ExploreCategoryJobsWaveGradientHeaderScreen
        categoryTitle={title}
        countLabel={showSkeleton ? undefined : `${jobs.length} jobs near you`}
        employers={showSkeleton ? [] : employers}
        jobs={showSkeleton ? [] : jobs}
        jobsLoading={showSkeleton}
        onBack={() => goBack(router)}
        onJobPress={(jobId) => {
          haptic.light();
          logJobEvent({ jobId, eventType: "click", feedContext: "category" });
          router.push({ pathname: "/job/[id]", params: { id: jobId } } as never);
        }}
        onEmployerPress={(employerId) => {
          haptic.light();
          router.push({ pathname: "/employer/[employerId]", params: { employerId } } as never);
        }}
        renderJobCard={(job, _index, onPress) => (
          <JobCard
            job={{
              id: job.id,
              title: job.title,
              employerName: job.employerName,
              employerColor: job.employerColor,
              payLabel: job.payLabel,
              workArrangement: 'onsite',
              locationLabel: job.locationLabel,
              positionsLeft: job.positionsLeft,
              positionsTotal: job.positionsTotal,
            }}
            variant="row"
            hideSave
            onPress={onPress}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F6F5" },
});