import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useJobSearch, type JobSearchParams } from "@/hooks/use-job-search";
import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { SearchJobCard } from "@/components/search/search-job-card";
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

const popularSearches: { label: string; image: number; kind: "part-time" | "full-time" | "weekend" | "remote" }[] = [
  { label: "Part-time", image: require("../../assets/images/parttime_new-removebg-preview.png"), kind: "part-time" },
  { label: "Full-time", image: require("../../assets/images/fulltime.png"), kind: "full-time" },
  { label: "Weekends", image: require("../../assets/images/weekend-removebg-preview.png"), kind: "weekend" },
  { label: "Remote", image: require("../../assets/images/remote.png"), kind: "remote" },
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
  const [searchFocused, setSearchFocused] = useState(false);
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
    (kind: "part-time" | "full-time" | "weekend" | "remote") => {
      haptic.light();
      if (kind === "full-time") {
        router.push({ pathname: "/search-results", params: { employmentType: "Full-time" } } as never);
        return;
      }
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
          <Text style={styles.brand}>Homlo</Text>
          <View style={styles.topBarSpacer} />
          <View style={styles.locationSelector}>
            <IconSymbol name="mappin" size={16} color="#16803C" />
            <Text style={styles.locationText}>Phnom Penh</Text>
            <IconSymbol name="chevron.down" size={12} color="#17201A" />
          </View>
          <Pressable style={styles.notificationButton}>
            <IconSymbol name="bell" size={20} color="#17201A" />
            <View style={styles.notificationBadge} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchRow, searchFocused && styles.searchRowFocused]}>
            <IconSymbol name="magnifyingglass" size={20} color="#66736A" style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="Search opportunities"
              onChangeText={setDraftKeyword}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={submitSearch}
              placeholder="Search jobs, skills, or companies..."
              placeholderTextColor="#94A098"
              returnKeyType="search"
              style={styles.searchInput}
              value={draftKeyword}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.categoryRail} horizontal showsHorizontalScrollIndicator={false}>
          {quickChips.map((chip) => {
            const active = chip.kind === "all";
            return (
              <Animated.View entering={FadeInDown.delay(80 + chip.label.length * 4).duration(220)} key={chip.label}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={chip.label}
                  onPress={() => handleChip(chip)}
                  style={({ pressed }) => [styles.categoryItem, active && styles.categoryItemActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{chip.label}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionRule} />

      {!searching ? (
        <>
          <View style={styles.popularHeader}>
            <Text style={styles.sectionTitle}>Quick search</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View all jobs" onPress={clearKeywordOnly} hitSlop={8}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.popularList}>
            {popularSearches.map((item) => (
              <Animated.View entering={FadeInDown.delay(100 + item.label.length * 5).duration(240)} key={item.label}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handlePopular(item.kind)}
                style={({ pressed }) => [styles.popularRow, pressed && styles.pressed]}
              >
                <View style={styles.popularIcon}>
                  <Image
                    accessibilityLabel={`${item.label} icon`}
                    resizeMode="contain"
                    source={item.image}
                    style={styles.popularIconImage}
                  />
                </View>
                <View style={styles.popularCopy}>
                  <Text style={styles.popularTitle}>{item.label}</Text>
                  <Text style={styles.popularSubtitle}>Explore flexible work near you</Text>
                </View>
                <IconSymbol name="chevron.right" size={17} color="#66736A" />
              </Pressable>
              </Animated.View>
            ))}
          </View>
          <View style={styles.sectionRule} />
        </>
      ) : null}

      <View style={styles.jobsNearYouRow}>
        <View style={styles.jobsNearYouCopy}>
          <Text style={styles.jobsNearYouTitle}>Jobs near you</Text>
          <Text style={styles.jobsNearYouSubtitle}>Fresh opportunities in your area</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort"
          onPress={openDetailFilters}
          style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
        >
          <IconSymbol name="slider.horizontal.3" size={18} color="#17201A" />
          <Text style={styles.sortButtonText}>Sort</Text>
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
            <SearchJobCard
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
  flex: { backgroundColor: "#FFFFFF", flex: 1 },
  listContent: {},

  heroHeader: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 18,
    paddingHorizontal: 20,
    position: "relative",
  },

  topBar: { alignItems: "center", flexDirection: "row" },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", marginRight: 6, width: 36 },
  brand: { color: "#16803C", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  topBarSpacer: { flex: 1 },
  locationSelector: { alignItems: "center", backgroundColor: "#F7F8F6", borderRadius: 20, flexDirection: "row", gap: 6, marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8 },
  locationText: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  notificationButton: { marginLeft: 10, padding: 6 },
  notificationBadge: { backgroundColor: "#ED1E24", borderColor: "#FFFFFF", borderRadius: 5, borderWidth: 1.5, height: 10, position: "absolute", right: 5, top: 5, width: 10 },

  searchContainer: { marginTop: 18 },
  searchRow: { alignItems: "center", backgroundColor: "#F7F8F6", borderRadius: 15, flex: 1, flexDirection: "row", height: 50, paddingHorizontal: 16 },
  searchRowFocused: { borderColor: "#0F7D5E", borderWidth: 1 },
  searchIcon: { marginRight: 10 },
  searchInput: { color: "#17201A", flex: 1, fontSize: 14, height: 50 },

  jobsNearYouRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingHorizontal: 20 },
  jobsNearYouCopy: { flex: 1 },
  jobsNearYouTitle: { color: "#17201A", fontSize: 18, fontWeight: "800" },
  jobsNearYouSubtitle: { color: "#94A098", fontSize: 12.5, marginTop: 2 },
  sortButton: { alignItems: "center", backgroundColor: "#F7F8F6", borderRadius: 12, flexDirection: "row", gap: 6, marginLeft: 12, paddingHorizontal: 12, paddingVertical: 9 },
  sortButtonText: { color: "#17201A", fontSize: 13, fontWeight: "600" },

  categoryRail: { gap: 8, paddingRight: 20, paddingTop: 16 },
  categoryItem: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  categoryItemActive: { backgroundColor: "#16803C", borderColor: "#16803C" },
  categoryLabel: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  categoryLabelActive: { color: "#FFFFFF", fontWeight: "700" },

  sectionRule: { backgroundColor: "#FFFFFF", height: 10 },

  popularHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  sectionTitle: { color: "#17201A", fontSize: 16, fontWeight: "800" },
  seeAllText: { color: "#16803C", fontSize: 13, fontWeight: "700" },

  popularList: { gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  popularRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E8ECEA", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  popularIcon: { height: 52, justifyContent: "center", width: 52 },
  popularIconImage: { height: "100%", width: "100%" },
  popularCopy: { flex: 1 },
  popularTitle: { color: "#17201A", fontSize: 14.5, fontWeight: "700" },
  popularSubtitle: { color: "#66736A", fontSize: 11.5, marginTop: 1 },

  appliedRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10 },
  appliedText: { color: "#16803C", flex: 1, fontSize: 12.5, fontWeight: "600" },
  clearText: { color: "#17201A", fontSize: 12.5, fontWeight: "700" },

  cardRow: { paddingBottom: 12, paddingHorizontal: 20 },
  loadingBody: { backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 8 },

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
