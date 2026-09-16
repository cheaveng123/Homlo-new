import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, ChevronDown, Search, Zap } from "lucide-react-native";

import { JobCard, type Job } from "@/components/JobCard";
import { useJobStore } from "@/components/job-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { defaultSearchCenter } from "@/lib/job-geography";
import type { JobSearchParams, SearchJobRecord } from "@/hooks/use-job-search";
import { consumeAppliedFilters, type DetailSearchPayload } from "@/lib/detail-search-store";
import { FALLBACK_JOB_IMAGE } from "@/lib/job-banner";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { polygonToBboxString } from "@/lib/polygon";
import {
  filtersBbox,
  hourlyEquivalent,
  nearSearchCenter,
  type SearchFilters,
} from "@/lib/search-filters";

// The wizard sends salary bounds in the selected period (Hourly / Monthly /
// Yearly); the search backend compares pay_amount in hourly-equivalent units,
// matching how the rest of the app converts salary bounds before querying.
const HOURS_PER_PERIOD: Record<string, number> = { Hourly: 1, Monthly: 160, Yearly: 2080 };
const NEAR_RADIUS_KM = 35;

function paramValue(raw: Record<string, string | string[] | undefined>, key: string): string {
  const value = raw?.[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function parsePolygon(raw: string): MapCoordinate[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point) => {
      if (!point || typeof point !== "object") return false;
      const candidate = point as { latitude?: unknown; longitude?: unknown };
      return (
        typeof candidate.latitude === "number" &&
        typeof candidate.longitude === "number" &&
        Number.isFinite(candidate.latitude) &&
        Number.isFinite(candidate.longitude)
      );
    }) as MapCoordinate[];
  } catch {
    return [];
  }
}

// Banner image → employer logo → generic category placeholder.
function resolveJobImage(record: SearchJobRecord): string {
  const banner = record.banner_image?.trim();
  if (banner) return banner;
  const logo = getProfilePhotoUrl(record.employer_photo_key);
  if (logo) return logo;
  return FALLBACK_JOB_IMAGE;
}

function payParts(record: SearchJobRecord): { priceRange: string; priceUnit: string } {
  const amount = Number(record.pay_amount);
  const currency = (record.pay_currency || "USD").toUpperCase();
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : String(record.pay_amount);
  const priceUnit = record.pay_type === "hourly" ? "/hr" : record.pay_type === "daily" ? "/day" : "";
  return { priceRange: `${symbol}${formatted}`, priceUnit };
}

function jobTypeLabel(record: SearchJobRecord): string {
  // The DB infers employment type from pay_type: hourly jobs read as
  // part-time-friendly, daily/fixed as fuller schedules.
  return record.pay_type === "hourly" ? "Part-time" : "Full-time";
}

function toQuickJob(record: SearchJobRecord, index: number, saved: boolean): Job {
  const { priceRange, priceUnit } = payParts(record);
  return {
    id: record.id,
    image: resolveJobImage(record),
    jobType: jobTypeLabel(record),
    title: record.title,
    company: record.employer_name?.trim() || "Homlo employer",
    location: record.location_text?.trim() || "Location to be confirmed",
    priceRange,
    priceUnit,
    imageHeight: index === 0 ? 190 : 170,
    saved,
  };
}

function appliedToSearchParams(applied: DetailSearchPayload): JobSearchParams {
  const filters: SearchFilters = applied.filters;
  const searchParams: JobSearchParams = { limit: 20, offset: 0 };

  if (applied.query.trim()) searchParams.query = applied.query.trim();
  if (filters.category && filters.category !== "All") searchParams.category = filters.category;
  if (filters.employmentType !== "Any") searchParams.employmentType = filters.employmentType;
  if (filters.arrangement !== "Any") searchParams.arrangement = filters.arrangement;
  if (filters.experience !== "Any") searchParams.experience = filters.experience;
  if (filters.posted !== "Any time") searchParams.posted = filters.posted;
  if (filters.location.trim()) searchParams.location = filters.location.trim();

  const minimum = filters.salaryMin ? hourlyEquivalent(Number(filters.salaryMin), filters.payPeriod) : undefined;
  const maximum = filters.salaryMax ? hourlyEquivalent(Number(filters.salaryMax), filters.payPeriod) : undefined;
  if (Number.isFinite(minimum ?? 0) && (minimum ?? 0) > 0) searchParams.salaryMin = minimum;
  if (Number.isFinite(maximum ?? 0) && (maximum ?? 0) > 0) searchParams.salaryMax = maximum;

  const sortMap: Record<SearchFilters["sort"], JobSearchParams["sort"]> = {
    Recommended: "recommended",
    Newest: "newest",
    "Salary high to low": "salary_high_to_low",
    Closest: "closest",
  };
  searchParams.sort = sortMap[filters.sort] ?? "recommended";

  const radius = filters.nearMe && filters.radiusKm ? Number(filters.radiusKm) : undefined;
  if (radius && radius > 0) {
    const center = nearSearchCenter(filters);
    searchParams.latitude = center.latitude;
    searchParams.longitude = center.longitude;
    searchParams.radiusKm = radius;
  }

  const bbox = filtersBbox(filters);
  if (bbox) searchParams.bbox = bbox;

  return searchParams;
}

// Maps the wizard route params (and generic search params used elsewhere in
// the app) onto the real search query.
function buildWizardSearchParams(raw: Record<string, string | string[]>, center: MapCoordinate): JobSearchParams {
  const searchParams: JobSearchParams = { limit: 20, offset: 0, sort: "recommended" };

  const query = paramValue(raw, "query");
  if (query) searchParams.query = query;

  const jobType = paramValue(raw, "jobType");
  if (jobType === "Remote") {
    searchParams.arrangement = "Remote";
  } else if (jobType === "Part time") {
    searchParams.employmentType = "Part-time";
  } else if (jobType === "Full time") {
    searchParams.employmentType = "Full-time";
  } else if (jobType === "Weekends") {
    searchParams.employmentType = "Weekend";
  } else {
    const employmentType = paramValue(raw, "employmentType");
    const arrangement = paramValue(raw, "arrangement");
    if (employmentType) searchParams.employmentType = employmentType;
    if (arrangement) searchParams.arrangement = arrangement;
  }

  const field = paramValue(raw, "field") || paramValue(raw, "category");
  if (field) searchParams.category = field;

  const location = paramValue(raw, "location");
  if (location) searchParams.location = location;

  const minSalary = Number(paramValue(raw, "minSalary"));
  const maxSalary = Number(paramValue(raw, "maxSalary"));
  const hours = HOURS_PER_PERIOD[paramValue(raw, "salaryType")] ?? HOURS_PER_PERIOD.Monthly;
  if (Number.isFinite(minSalary) && minSalary > 0) searchParams.salaryMin = minSalary / hours;
  if (Number.isFinite(maxSalary) && maxSalary > 0) searchParams.salaryMax = maxSalary / hours;

  const locationMode = paramValue(raw, "locationMode");
  const polygon = parsePolygon(paramValue(raw, "polygon"));
  if (locationMode === "near") {
    searchParams.latitude = center.latitude;
    searchParams.longitude = center.longitude;
    searchParams.radiusKm = NEAR_RADIUS_KM;
  } else if (locationMode === "draw" && polygon.length >= 3) {
    searchParams.bbox = polygonToBboxString(polygon);
  }

  const latitude = Number(paramValue(raw, "latitude"));
  const longitude = Number(paramValue(raw, "longitude"));
  const radiusKm = Number(paramValue(raw, "radiusKm"));
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    searchParams.latitude = latitude;
    searchParams.longitude = longitude;
    if (Number.isFinite(radiusKm) && radiusKm > 0) searchParams.radiusKm = radiusKm;
  }

  const bbox = paramValue(raw, "bbox");
  if (bbox) searchParams.bbox = bbox;

  return searchParams;
}

export default function SearchResultsScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const { isSaved, toggleSaved } = useJobStore();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DetailSearchPayload | null>(null);
  const [center, setCenter] = useState<MapCoordinate>(defaultSearchCenter);

  // Detailed-search "Apply" publishes filters that the results screen consumes
  // on focus — keep that flow working alongside the wizard's route params.
  useFocusEffect(
    useCallback(() => {
      const applied = consumeAppliedFilters();
      if (applied) setAppliedFilters(applied);
    }, []),
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const position =
          (await Location.getLastKnownPositionAsync({ maxAge: 300_000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (active && position?.coords) {
          setCenter({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      } catch {
        // Location is optional — fall back to the default search center.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const searchParams = useMemo(
    () => (appliedFilters ? appliedToSearchParams(appliedFilters) : buildWizardSearchParams(rawParams, center)),
    [appliedFilters, rawParams, center],
  );

  const { data, error, isFetching, isLoading } = trpc.homlo.searchJobs.useQuery(searchParams, {
    enabled: true,
    staleTime: 30_000,
  });

  const jobs = useMemo(
    () => (data?.jobs ?? []).map((record, index) => toQuickJob(record, index, isSaved(record.id))),
    [data?.jobs, isSaved],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? jobs.filter((job) => `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(needle))
      : jobs;
  }, [jobs, query]);

  const loading = isLoading || (isFetching && (data?.jobs?.length ?? 0) === 0);

  const toggleSave = (id: string) => {
    if (!user) {
      router.push("/login" as never);
      return;
    }
    toggleSaved(id);
  };

  const openJob = (id: string) => {
    router.push({ pathname: "/job/[id]", params: { id } } as never);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <Pressable style={styles.circleBtn} onPress={() => router.back()}>
            <ArrowLeft size={16} color="#12271F" />
          </Pressable>

          <View style={styles.searchBar}>
            <Search size={16} color="#5F7A6E" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Barista, warehouse, driver..."
              placeholderTextColor="#5F7A6E"
              returnKeyType="search"
            />
          </View>

          <Pressable
            style={styles.quickBtn}
            onPress={() => router.push("/quick-search" as never)}
          >
            <Zap size={16} color="#04342C" />
          </Pressable>
        </View>

        <View style={styles.resultHeader}>
          <Text style={styles.resultCount}>{results.length} jobs found</Text>
          <Pressable style={styles.sortBtn}>
            <Text style={styles.sortText}>Best match</Text>
            <ChevronDown size={14} color="#5F7A6E" />
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPressApply={openJob}
              onToggleSave={toggleSave}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color="#5DCAA5" style={{ marginTop: 40, alignSelf: "center" }} />
            ) : error ? (
              <Text style={styles.empty}>Something went wrong. Please try again.</Text>
            ) : (
              <Text style={styles.empty}>No jobs match these filters yet.</Text>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F7F5',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12271F',
    padding: 0,
  },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5DCAA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  resultCount: { fontSize: 14, fontWeight: '500', color: '#12271F' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontSize: 12, color: '#5F7A6E' },
  listContent: { paddingBottom: 24 },
  empty: {
    fontSize: 13,
    color: '#5F7A6E',
    textAlign: 'center',
    marginTop: 40,
  },
});