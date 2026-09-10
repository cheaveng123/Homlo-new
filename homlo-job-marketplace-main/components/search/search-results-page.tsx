import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useJobSearch, type JobSearchParams } from "@/hooks/use-job-search";
import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { MarketplaceJobCard } from "@/components/marketplace-job-card";
import { JobListingSkeleton } from "@/components/job-listing-skeleton";
import { type Job } from "@/components/job-store";
import { haptic } from "@/lib/haptics";
import {
  countActiveFilters,
  defaultSearchFilters,
  filtersBbox,
  hourlyEquivalent,
  nearSearchCenter,
  type ArrangementFilter,
  type EmploymentFilter,
  type SearchFilters,
} from "@/lib/search-filters";
import { goBack as goBackOrHome } from "@/lib/navigation";
import { logJobEvent } from "@/lib/event-logging";
import { consumeAppliedFilters, publishDetailSnapshot } from "@/lib/detail-search-store";

type QuickChipIcon = "briefcase.fill" | "clock" | "graduationcap.fill" | "calendar" | "house.fill" | "ellipsis";

type QuickChip = {
  label: string;
  icon: QuickChipIcon;
  tone: string;
  color: string;
  kind: "all" | "part-time" | "internships" | "weekend" | "remote" | "more";
};

const quickChips: QuickChip[] = [
  { label: "All Jobs", icon: "briefcase.fill", tone: "#EAF6EC", color: "#16803C", kind: "all" },
  { label: "Part-time", icon: "clock", tone: "#EFF8F0", color: "#16803C", kind: "part-time" },
  { label: "Internship", icon: "graduationcap.fill", tone: "#EAF3FB", color: "#23739A", kind: "internships" },
  { label: "Weekends", icon: "calendar", tone: "#FFF3E5", color: "#C96F16", kind: "weekend" },
  { label: "Remote", icon: "house.fill", tone: "#F0ECFA", color: "#6650A3", kind: "remote" },
  { label: "More", icon: "ellipsis", tone: "#F1F3F1", color: "#17201A", kind: "more" },
];

const popularSearches: { label: string; kind: QuickChip["kind"] }[] = [
  { label: "Part-time jobs", kind: "part-time" },
  { label: "Internship opportunities", kind: "internships" },
  { label: "Weekend jobs", kind: "weekend" },
  { label: "Remote jobs", kind: "remote" },
];

function mapFiltersToSearchParams(filters: SearchFilters, keyword: string): JobSearchParams {
  const sortMap: Record<string, "recommended" | "newest" | "salary_high_to_low" | "closest"> = {
    Recommended: "recommended",
    Newest: "newest",
    "Salary high to low": "salary_high_to_low",
    Closest: "closest",
  };

  const salaryMin = filters.salaryMin ? hourlyEquivalent(Number(filters.salaryMin), filters.payPeriod) : undefined;
  const salaryMax = filters.salaryMax ? hourlyEquivalent(Number(filters.salaryMax), filters.payPeriod) : undefined;
  const distanceKm = filters.nearMe && filters.radiusKm ? Number(filters.radiusKm) : undefined;
  const geoCenter = distanceKm ? nearSearchCenter(filters) : undefined;

  return {
    query: keyword || undefined,
    location: filters.location || undefined,
    category: filters.category !== "All" ? filters.category : undefined,
    employmentType: filters.employmentType !== "Any" ? filters.employmentType : undefined,
    arrangement: filters.arrangement !== "Any" ? filters.arrangement : undefined,
    experience: filters.experience !== "Any" ? filters.experience : undefined,
    salaryMin: Number.isFinite(salaryMin ?? 0) && (salaryMin ?? 0) > 0 ? salaryMin : undefined,
    salaryMax: Number.isFinite(salaryMax ?? 0) && (salaryMax ?? 0) > 0 ? salaryMax : undefined,
    posted: filters.posted !== "Any time" ? filters.posted : undefined,
    sort: sortMap[filters.sort] ?? "recommended",
    latitude: geoCenter?.latitude,
    longitude: geoCenter?.longitude,
    radiusKm: distanceKm,
    bbox: filtersBbox(filters),
    limit: 20,
    offset: 0,
  };
}

function appliedSummary(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.employmentType !== "Any") parts.push(filters.employmentType);
  if (filters.arrangement !== "Any") parts.push(filters.arrangement);
  if (filters.category !== "All") parts.push(filters.category);
  if (filters.experience !== "Any") parts.push(filters.experience);
  if (filters.posted !== "Any time") parts.push(filters.posted);
  if (filters.location.trim()) parts.push(filters.location.trim());
  if (filters.salaryMin || filters.salaryMax) {
    const periodSuffix = { "Per hour": "/hr", "Per day": "/day", "Per week": "/wk", "Per month": "/mo" }[filters.payPeriod ?? "Per hour"];
    parts.push(`$${filters.salaryMin || 0}–$${filters.salaryMax || "∞"}${periodSuffix}`);
  }
  if (filters.nearMe && filters.radiusKm) parts.push(`Near me · ${filters.radiusKm} km`);
  if (filters.sort !== "Recommended") parts.push(filters.sort);
  return parts.join(" · ");
}

function EmptyState({ onAdjust }: { onAdjust: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <IconSymbol name="magnifyingglass" size={24} color="#16803C" />
      </View>
      <Text style={styles.emptyTitle}>No jobs found</Text>
      <Text style={styles.emptyText}>Try adjusting your filters or search terms to find more opportunities.</Text>
      <ScalePressable accessibilityLabel="Adjust search" hapticFeedback onPress={onAdjust} style={styles.emptyAdjustButton}>
        <Text style={styles.emptyAdjustText}>Adjust search</Text>
      </ScalePressable>
    </View>
  );
}

export function SearchResultsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    query?: string;
    category?: string;
    employmentType?: string;
    arrangement?: string;
    location?: string;
  }>();
  const insets = useSafeAreaInsets();
  const showBackButton = pathname === "/search-results" || pathname === "/explore";

  const [keyword, setKeyword] = useState(params.query ?? "");
  const [draftKeyword, setDraftKeyword] = useState(params.query ?? "");
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...defaultSearchFilters,
    ...(params.category && params.category !== "All" ? { category: params.category } : {}),
    ...(params.employmentType ? { employmentType: params.employmentType as EmploymentFilter } : {}),
    ...(params.arrangement ? { arrangement: params.arrangement as ArrangementFilter } : {}),
    ...(params.location ? { location: params.location } : {}),
  }));
  const listRef = useRef<FlatList<Job>>(null);

  const searchParams = useMemo(() => mapFiltersToSearchParams(filters, keyword), [filters, keyword]);
  const { jobs, loading, error, refetch, isFetching } = useJobSearch(searchParams, { enabled: true });

  const results = jobs;
  const activeFilterCount = countActiveFilters(filters);
  const isLoading = loading || isFetching;
  const searching = keyword.trim().length > 0;

  useEffect(() => {
    publishDetailSnapshot({ query: keyword, filters });
  }, [filters, keyword]);

  useFocusEffect(
    useCallback(() => {
      const applied = consumeAppliedFilters();
      if (!applied) return;
      setKeyword(applied.query);
      setDraftKeyword(applied.query ?? "");
      setFilters(applied.filters);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const submitSearch = useCallback(() => {
    haptic.success();
    setKeyword(draftKeyword.trim());
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [draftKeyword]);

  const resetAll = useCallback(() => {
    haptic.light();
    setKeyword("");
    setDraftKeyword("");
    setFilters(defaultSearchFilters);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const clearKeywordOnly = useCallback(() => {
    haptic.light();
    setKeyword("");
    setDraftKeyword("");
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const goBack = useCallback(() => {
    haptic.light();
    goBackOrHome(router);
  }, [router]);

  const openDetailFilters = useCallback(() => {
    haptic.light();
    publishDetailSnapshot({ query: keyword, filters });
    router.push("/detailed-search" as never);
  }, [filters, keyword, router]);

  const handleChip = useCallback(
    (chip: QuickChip) => {
      haptic.light();
      if (chip.kind === "all") {
        if (pathname !== "/search-results") {
          router.push("/search-results" as never);
        } else {
          resetAll();
        }
        return;
      }
      if (chip.kind === "more") {
        openDetailFilters();
        return;
      }
      router.push(`/discover/${chip.kind}` as never);
    },
    [openDetailFilters, pathname, resetAll, router],
  );

  const handlePopular = useCallback(
    (kind: QuickChip["kind"]) => {
      haptic.light();
      router.push(`/discover/${kind}` as never);
    },
    [router],
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: Job; index: number | null }[] }) => {
      for (const viewable of viewableItems) {
        if (viewable.index == null) continue;
        logJobEvent({ jobId: viewable.item.id, eventType: "impression", feedContext: "search", feedPosition: viewable.index });
      }
    },
    [],
  );

  const listEmpty = isLoading ? (
    <View style={styles.loadingBody}>
      <JobListingSkeleton count={5} />
    </View>
  ) : error ? (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Unable to load jobs. Please try again.</Text>
      <ScalePressable accessibilityLabel="Retry" hapticFeedback onPress={() => refetch()} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </ScalePressable>
    </View>
  ) : (
    <EmptyState onAdjust={openDetailFilters} />
  );

  const header = (
    <View>
      <View style={[styles.heroHeader, { paddingTop: Math.max(insets.top, 12) + 9 }]}>
        <View style={styles.topBar}>
          {showBackButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBack}
              hitSlop={10}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <IconSymbol name="chevron.left" size={21} color="#17201A" />
            </Pressable>
          ) : null}
          <View style={styles.heroHeading}>
            <Text style={styles.topTitle}>Search</Text>
            <Text style={styles.heroSubtitle}>Find the right opportunity for you</Text>
          </View>
        </View>

        <View style={styles.discoveryControls}>
          <View style={styles.searchRow}>
            <IconSymbol name="magnifyingglass" size={20} color="#66736A" style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="Search opportunities"
              onChangeText={setDraftKeyword}
              onSubmitEditing={submitSearch}
              placeholder="Job title, skill, or company"
              placeholderTextColor="#94A098"
              returnKeyType="search"
              style={styles.searchInput}
              value={draftKeyword}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open job filters"
            onPress={openDetailFilters}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <IconSymbol name="slider.horizontal.3" size={18} color="#16803C" />
            <Text style={styles.filterText}>Filters</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.categoryRail} horizontal showsHorizontalScrollIndicator={false}>
          {quickChips.map((chip) => {
            const active = chip.kind === "all";
            return (
              <Pressable
                key={chip.label}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                onPress={() => handleChip(chip)}
                style={({ pressed }) => [styles.categoryItem, active && styles.categoryItemActive, pressed && styles.pressed]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: chip.tone }]}>
                  <IconSymbol name={chip.icon} size={16} color={chip.color} />
                </View>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionRule} />

      {!searching ? (
        <>
          <View style={styles.popularHeader}>
            <Text style={styles.sectionTitle}>Popular searches</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View all jobs" onPress={clearKeywordOnly} hitSlop={8}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.popularList}>
            {popularSearches.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handlePopular(item.kind)}
                style={({ pressed }) => [styles.popularRow, pressed && styles.pressed]}
              >
                <View style={styles.popularIcon}>
                  <IconSymbol name="magnifyingglass" size={16} color="#16803C" />
                </View>
                <View style={styles.popularCopy}>
                  <Text style={styles.popularTitle}>{item.label}</Text>
                  <Text style={styles.popularSubtitle}>Find flexible work near you</Text>
                </View>
                <IconSymbol name="chevron.right" size={17} color="#66736A" />
              </Pressable>
            ))}
          </View>
          <View style={styles.sectionRule} />
        </>
      ) : null}

      <View style={styles.contextRow}>
        <Text style={styles.resultLabel}>{isLoading ? "Loading jobs" : `${results.length} jobs found`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort search results"
          onPress={openDetailFilters}
          style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
        >
          <Text style={styles.viewResultsText}>Sort by: {filters.sort}</Text>
          <IconSymbol name="chevron.down" size={15} color="#16803C" />
        </Pressable>
      </View>

      {activeFilterCount > 0 ? (
        <View style={styles.appliedRow}>
          <Text numberOfLines={1} style={styles.appliedText}>
            Applied: {appliedSummary(filters)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={resetAll} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}>
      <FlatList<Job>
        ref={listRef}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }]}
        data={results}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={styles.cardRow}>
            <MarketplaceJobCard
              job={item}
              onPress={() => {
                logJobEvent({ jobId: item.id, eventType: "click", feedContext: "search", feedPosition: index });
                router.push({ pathname: "/job/[id]", params: { id: item.id } } as never);
              }}
            />
          </View>
        )}
        onViewableItemsChanged={handleViewableItemsChanged}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { backgroundColor: "#F7F8F6", flex: 1 },
  listContent: {},

  heroHeader: {
    backgroundColor: "#F7F8F6",
    overflow: "hidden",
    paddingBottom: 14,
    paddingHorizontal: 20,
    position: "relative",
  },

  topBar: { alignItems: "center", flexDirection: "row" },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", marginRight: 4, width: 40 },
  heroHeading: { flex: 1 },
  topTitle: { color: "#17201A", fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  heroSubtitle: { color: "#66736A", fontSize: 13, marginTop: 4 },

  discoveryControls: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 18 },
  searchRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", height: 48 },
  searchIcon: { marginLeft: 12 },
  searchInput: { color: "#17201A", flex: 1, fontSize: 14, height: 48, paddingHorizontal: 10 },

  filterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 4, height: 48, justifyContent: "center", paddingHorizontal: 13 },
  filterText: { color: "#16803C", fontSize: 13, fontWeight: "700" },
  filterCount: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 9.5, height: 19, justifyContent: "center", marginLeft: 2, minWidth: 19, paddingHorizontal: 4 },
  filterCountText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" },

  categoryRail: { gap: 8, paddingRight: 20, paddingTop: 16 },
  categoryItem: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 13, paddingVertical: 7 },
  categoryItemActive: { backgroundColor: "#EAF6EC", borderColor: "#16803C" },
  categoryIcon: { alignItems: "center", borderRadius: 15, height: 30, justifyContent: "center", width: 30 },
  categoryLabel: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  categoryLabelActive: { color: "#16803C", fontWeight: "700" },

  sectionRule: { backgroundColor: "#FFFFFF", height: 10 },

  popularHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  sectionTitle: { color: "#17201A", fontSize: 16, fontWeight: "800" },
  seeAllText: { color: "#16803C", fontSize: 13, fontWeight: "700" },

  popularList: { gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  popularRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E8ECEA", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  popularIcon: { alignItems: "center", backgroundColor: "#EAF6EC", borderRadius: 19, height: 38, justifyContent: "center", width: 38 },
  popularCopy: { flex: 1 },
  popularTitle: { color: "#17201A", fontSize: 14.5, fontWeight: "700" },
  popularSubtitle: { color: "#66736A", fontSize: 11.5, marginTop: 1 },

  contextRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  resultLabel: { color: "#66736A", fontSize: 12.5 },
  sortButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  viewResultsText: { color: "#17201A", fontSize: 12.5, fontWeight: "600" },

  appliedRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10 },
  appliedText: { color: "#16803C", flex: 1, fontSize: 12.5, fontWeight: "600" },
  clearText: { color: "#17201A", fontSize: 12.5, fontWeight: "700" },

  cardRow: { paddingBottom: 12, paddingHorizontal: 16 },
  loadingBody: { backgroundColor: "#F7F8F6", paddingHorizontal: 16, paddingTop: 8 },

  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40 },
  emptyIcon: { alignItems: "center", backgroundColor: "#EAF6EC", borderRadius: 22, height: 52, justifyContent: "center", width: 52 },
  emptyTitle: { color: "#17201A", fontSize: 16, fontWeight: "700", marginTop: 14, textAlign: "center" },
  emptyText: { color: "#66736A", fontSize: 12.5, lineHeight: 18, marginTop: 6, textAlign: "center" },
  emptyAdjustButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, marginTop: 18, paddingHorizontal: 18, paddingVertical: 11 },
  emptyAdjustText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },

  errorContainer: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40 },
  errorText: { color: "#A04141", fontSize: 14, fontWeight: "500", marginBottom: 16, textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },

  pressed: { opacity: 0.75 },
});