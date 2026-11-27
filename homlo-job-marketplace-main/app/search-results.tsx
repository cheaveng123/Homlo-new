import { locationService } from "@/lib/location-service";
import { useFocusEffect, useLocalSearchParams, useRouter } from "@/lib/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { type ResultFilterNew } from "@/src/new/screens/SearchResultsScreenNew";
import { SearchResultsPage } from "@/components/search/SearchResultsPage";
import { JobSummaryNew, ScreenStateNew } from "@/src/new/types/jobNew";
import type { JobCardData, WorkArrangement } from "@/components/jobs/jobCardTypes";
import { logoColorFor } from "@/components/jobs/toJobCardData";
import { useJobStore } from "@/components/job-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { defaultSearchCenter } from "@/lib/job-geography";
import { computePositionsLeft } from "@/lib/positions";
import type { JobSearchParams, SearchJobRecord } from "@/hooks/use-job-search";
import { consumeAppliedFilters, type DetailSearchPayload } from "@/lib/detail-search-store";
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

const FILTERS = ["All", "Full-time", "Part-time", "Weekend", "Remote"];

// `?jobType=` -> the matching FILTERS pill. `applyPill` clears employmentType and
// arrangement before re-applying the active pill, so an incoming jobType has to
// become the active pill or it is dropped before the query runs.
const JOB_TYPE_TO_PILL: Record<string, string> = {
  "Part time": "Part-time",
  "Full time": "Full-time",
  Weekends: "Weekend",
  Remote: "Remote",
};

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "H";
  return parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Real search record → the card's view-model. Data mapping only.
function toCardData(record: SearchJobRecord, arrangement: WorkArrangement): JobCardData {
  const { priceRange, priceUnit } = payParts(record);
  const company = record.employer_name?.trim() || "Homlo employer";
  const place = record.location_text?.trim() || "";
  return {
    id: record.id,
    title: record.title,
    employerName: company,
    employerColor: logoColorFor(company),
    imageUrl: record.banner_image || null,
    payLabel: `${priceRange}${priceUnit}`,
    workArrangement: arrangement,
    locationLabel: arrangement === "remote" ? null : place || null,
    positionsLeft: computePositionsLeft(record.workers_needed, record.workers_hired),
    positionsTotal: record.workers_needed > 0 ? record.workers_needed : null,
  };
}

function toSummary(d: JobCardData, liked: boolean): JobSummaryNew {
  return {
    id: d.id,
    title: d.title,
    locationLabel: d.locationLabel ?? (d.workArrangement === "remote" ? "Remote" : ""),
    payLabel: d.payLabel,
    positionsLeft: d.positionsLeft ?? 0,
    positionsTotal: d.positionsTotal ?? 0,
    employerInitials: initialsOf(d.employerName),
    employerName: d.employerName,
    imageUri: d.imageUrl ?? undefined,
    typeLabel: d.workArrangement === "remote" ? "Remote" : undefined,
    liked,
    boosted: d.boosted === true || d.boost?.isSponsored === true,
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

// The filter pill row layers on top of whichever params the route/wizard
// produced. It owns the two dimensions the pills represent, so both keys are
// cleared first and only the active pill's one is re-applied — "All" therefore
// really means all, instead of leaving a wizard-supplied type in place.
function applyPill(params: JobSearchParams, pill: string): JobSearchParams {
  const next: JobSearchParams = { ...params };
  delete next.employmentType;
  delete next.arrangement;
  if (pill === "Remote") next.arrangement = "Remote";
  else if (pill !== "All") next.employmentType = pill;
  return next;
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
  const salaryType = paramValue(raw, "salaryType");
  const hours = HOURS_PER_PERIOD[salaryType] ?? HOURS_PER_PERIOD.Monthly;
  if (Number.isFinite(minSalary) && minSalary > 0) searchParams.salaryMin = minSalary / hours;
  if (Number.isFinite(maxSalary) && maxSalary > 0) searchParams.salaryMax = maxSalary / hours;

  const locationMode = paramValue(raw, "locationMode");
  const polygon = parsePolygon(paramValue(raw, "polygon"));
  if (locationMode === "near") {
    searchParams.latitude = center.latitude;
    searchParams.longitude = center.longitude;
    searchParams.radiusKm = NEAR_RADIUS_KM;
  } else if (polygon.length >= 3) {
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

const FILTERS_NEW: ResultFilterNew[] = FILTERS.map((f) => ({ id: f, label: f }));

export default function SearchResultsScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const { isSaved, toggleSaved } = useJobStore();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // The pill row layers over whatever the route supplied. `pillOverride` is only
  // the user's own tap, so an incoming ?jobType= keeps winning until they choose
  // a pill themselves - deriving it avoids setState-in-effect and keeps the route
  // authoritative when the same screen is pushed again with new params.
  const routePill = JOB_TYPE_TO_PILL[paramValue(rawParams, "jobType")] ?? "All";
  const [pillOverride, setPillOverride] = useState<string | null>(null);
  const activeFilter = pillOverride ?? routePill;
  const [appliedFilters, setAppliedFilters] = useState<DetailSearchPayload | null>(null);
  const [center, setCenter] = useState<MapCoordinate>(defaultSearchCenter);

  // The typed term goes to the server rather than filtering the current page in
  // memory — otherwise a query that matches nothing on the first 20 rows shows an
  // empty list even though the backend has matches. Debounced so each keystroke
  // doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

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
        const position = await locationService.getBestAvailablePosition(300_000);
        if (active && position) {
          setCenter({ latitude: position.latitude, longitude: position.longitude });
        }
      } catch {
        // Location is optional — fall back to the default search center.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const searchParams = useMemo(() => {
    const base = appliedFilters
      ? appliedToSearchParams(appliedFilters)
      : buildWizardSearchParams(rawParams, center);
    const next = applyPill(base, activeFilter);
    // A typed term wins over any query the route/wizard supplied, so the box
    // always reflects what the user is actually searching for.
    const typed = debouncedQuery.trim();
    if (typed) next.query = typed;
    return next;
  }, [appliedFilters, rawParams, center, activeFilter, debouncedQuery]);

  const { data, error, isFetching, isLoading, refetch } = trpc.homlo.searchJobs.useQuery(searchParams, {
    enabled: true,
    staleTime: 30_000,
  });

  // The record carries no arrangement column, so the card reads it off the
  // filter that produced these results.
  const arrangement: WorkArrangement = activeFilter === "Remote" ? "remote" : "onsite";

  // The server already applied `query`, so no second client-side pass here.
  const results = useMemo(
    () => (data?.jobs ?? []).map((record) => toSummary(toCardData(record, arrangement), isSaved(record.id))),
    [data?.jobs, arrangement, isSaved],
  );

  const loading = isLoading || (isFetching && (data?.jobs?.length ?? 0) === 0);

  let state: ScreenStateNew = "ready";
  if (loading) state = "loading";
  else if (error) state = "error";
  else if (results.length === 0) state = "empty";

  const openJob = (id: string) => {
    router.push({ pathname: "/job/[id]", params: { id } } as never);
  };

  const toggleSave = (id: string) => {
    if (!user) {
      router.push("/login" as never);
      return;
    }
    toggleSaved(id);
  };

  const handleClearFilters = useCallback(() => {
    setPillOverride("All");
    setQuery("");
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <SearchResultsPage
        state={state}
        query={query}
        onBack={() => router.back()}
        onEditQuery={() => {}}
        onChangeQuery={setQuery}
        onPressFilter={() => {}}
        filters={FILTERS_NEW}
        activeFilterId={activeFilter}
        onSelectFilter={(id) => setPillOverride(id)}
        resultCount={results.length}
        results={results}
        onPressJob={openJob}
        onToggleLike={toggleSave}
        onClearFilters={handleClearFilters}
        onRetry={() => void refetch()}
      />
    </View>
  );
}