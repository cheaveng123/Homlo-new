import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JobCardItem } from "@/components/jobs/JobCardItem";
import { ScreenContainer } from "@/components/screen-container";
import { AppIcon } from "@/components/ui/AppIcon";
import { Text } from "@/components/ui/text";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { PostTabButton } from "@/components/post-tab-button";
import { useJobSearch } from "@/hooks/use-job-search";
import { haptic } from "@/lib/haptics";
import { goBack } from "@/lib/navigation";

type DiscoveryKind = "part-time" | "internships" | "weekend" | "remote";
type SortMode = "Recent" | "Pay";

type DiscoveryConfig = {
  title: string;
  primaryLabel: string;
  primaryOptions: string[];
};

const configs: Record<DiscoveryKind, DiscoveryConfig> = {
  "part-time": { title: "Part-time Jobs", primaryLabel: "Schedule", primaryOptions: ["Any schedule", "Morning", "Afternoon", "Evening"] },
  internships: { title: "Internship Jobs", primaryLabel: "Field", primaryOptions: ["All fields", "Technology", "Marketing", "Sales", "Design"] },
  weekend: { title: "Weekend Jobs", primaryLabel: "Shift", primaryOptions: ["Any time", "Daytime", "Evening", "Event work"] },
  remote: { title: "Remote Jobs", primaryLabel: "Experience", primaryOptions: ["Any experience", "No experience", "Entry level", "2+ years"] },
};

const kinds = Object.keys(configs) as DiscoveryKind[];
const locationOptions = ["All locations", "Phnom Penh", "Remote"];
const payOptions = ["Any pay", "Under $400", "$400+"];
const sortOptions: { label: string; value: SortMode }[] = [{ label: "Most recent", value: "Recent" }, { label: "Highest pay", value: "Pay" }];
const parsePay = (value: string) => Number(value.replace(/[^0-9]/g, "").slice(0, 4)) || 0;

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { kind: rawKind } = useLocalSearchParams<{ kind?: string }>();
  const kind: DiscoveryKind = kinds.includes(rawKind as DiscoveryKind) ? rawKind as DiscoveryKind : "part-time";
  const config = configs[kind];
  const [primaryFilter, setPrimaryFilter] = useState(config.primaryOptions[0]);
  const [location, setLocation] = useState("All locations");
  const [payRange, setPayRange] = useState("Any pay");
  const [sort, setSort] = useState<SortMode>("Recent");
  const [filterVisible, setFilterVisible] = useState(false);

  // Build server-side search params from discover kind and filters
  const searchParams = useMemo(() => {
    const base: Record<string, unknown> = { limit: 50, sort: "recommended" };
    if (kind === "part-time") base.employmentType = "Part-time";
    if (kind === "remote") base.arrangement = "Remote";
    if (location === "Remote") base.arrangement = "Remote";
    else if (location === "Phnom Penh") base.location = "Phnom Penh";
    if (payRange === "Under $400") base.salaryMax = 400;
    else if (payRange === "$400+") base.salaryMin = 400;
    return base;
  }, [kind, location, payRange]);

  const { jobs: serverJobs, loading: searchLoading } = useJobSearch(searchParams as any);

  const results = useMemo(() => {
    const filtered = serverJobs.filter((job) => {
      const kindMatches =
        kind === "part-time"
          ? job.tag === "Part-time"
          : kind === "internships"
            ? true
            : kind === "weekend"
              ? /(saturday|sunday)/i.test(job.schedule ?? "")
              : true;
      const locationMatches =
        location === "All locations" ||
        (location === "Remote" ? job.arrangement === "Remote" : job.location.includes("Phnom Penh"));
      const pay = parsePay(job.pay);
      const payMatches =
        payRange === "Any pay" || (payRange === "Under $400" ? pay < 400 : pay >= 400);
      return kindMatches && locationMatches && payMatches && matchesPrimary(kind, primaryFilter, job);
    });
    return [...filtered].sort((left, right) => sort === "Pay" ? parsePay(right.pay) - parsePay(left.pay) : 0);
  }, [serverJobs, kind, location, payRange, primaryFilter, sort]);

  const activeFilterCount = [primaryFilter !== config.primaryOptions[0], location !== "All locations", payRange !== "Any pay", sort !== "Recent"].filter(Boolean).length;
  const resetFilters = () => { setPrimaryFilter(config.primaryOptions[0]); setLocation("All locations"); setPayRange("Any pay"); setSort("Recent"); };

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-[#FFFFFF]" edges={["left", "right", "bottom"]}>
      <View style={styles.screen}>
        {searchLoading && results.length === 0 ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0891B2" /></View>
        ) : (
          <FlatList
            contentContainerStyle={[styles.content, { paddingBottom: 94 + Math.max(insets.bottom, 8) }]}
            data={results}
            keyExtractor={(job) => job.id}
            ListEmptyComponent={<EmptyState onReset={resetFilters} />}
            ListHeaderComponent={<View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}><View style={styles.topBar}><ScalePressable accessibilityLabel="Go back" hapticFeedback onPress={() => goBack(router)} style={styles.backButton}><AppIcon name="back" size={21} color="#17201A" /></ScalePressable><View style={styles.headingCopy}><Text style={styles.topTitle}>{config.title}</Text><Text style={styles.resultCount}>{results.length} jobs found</Text></View><Pressable accessibilityLabel={`Open filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`} onPress={() => { haptic.light(); setFilterVisible(true); }} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}><AppIcon name="sliders" size={19} color="#17201A" />{activeFilterCount ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View> : null}</Pressable></View><View style={styles.headerRule} /></View>}
            renderItem={({ item }) => <JobCardItem job={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}
        <DiscoveryTabBar insetsBottom={Math.max(insets.bottom, 8)} router={router} />
      </View>
      <DiscoveryFilterSheet config={config} filterVisible={filterVisible} location={location} onClose={() => setFilterVisible(false)} onPrimaryChange={setPrimaryFilter} onLocationChange={setLocation} onPayChange={setPayRange} onReset={resetFilters} onSortChange={setSort} payRange={payRange} primaryFilter={primaryFilter} sort={sort} />
    </ScreenContainer>
  );
}


function DiscoveryFilterSheet({ config, filterVisible, location, onClose, onPrimaryChange, onLocationChange, onPayChange, onReset, onSortChange, payRange, primaryFilter, sort }: { config: DiscoveryConfig; filterVisible: boolean; location: string; onClose: () => void; onPrimaryChange: (value: string) => void; onLocationChange: (value: string) => void; onPayChange: (value: string) => void; onReset: () => void; onSortChange: (value: SortMode) => void; payRange: string; primaryFilter: string; sort: SortMode }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={filterVisible}><View style={styles.sheetOverlay}><Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.sheetDismiss} /><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Filter jobs</Text><Text style={styles.sheetSubtitle}>Refine this search without leaving the results.</Text></View><Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.sheetClose}><AppIcon name="chevron" size={20} color="#17201A" style={{ transform: [{ rotate: "90deg" }] }} /></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><FilterGroup label={config.primaryLabel} onSelect={onPrimaryChange} options={config.primaryOptions} selected={primaryFilter} /><FilterGroup label="Location" onSelect={onLocationChange} options={locationOptions} selected={location} /><FilterGroup label="Pay range" onSelect={onPayChange} options={payOptions} selected={payRange} /><FilterGroup label="Sort by" onSelect={(value) => onSortChange(value as SortMode)} options={sortOptions.map((option) => option.label)} selected={sortOptions.find((option) => option.value === sort)?.label || "Most recent"} valueMap={sortOptions.reduce<Record<string, string>>((map, option) => { map[option.label] = option.value; return map; }, {})} /></ScrollView><View style={styles.sheetFooter}><Pressable onPress={onReset} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}><Text style={styles.resetText}>Reset</Text></Pressable><ScalePressable hapticFeedback onPress={onClose} style={styles.applyButton}><Text style={styles.applyText}>Show results</Text></ScalePressable></View></View></View></Modal>;
}

function FilterGroup({ label, onSelect, options, selected, valueMap }: { label: string; onSelect: (value: string) => void; options: string[]; selected: string; valueMap?: Record<string, string> }) {
  return <View style={styles.filterGroup}><Text style={styles.filterLabel}>{label}</Text><View style={styles.filterOptions}>{options.map((option) => <Pressable key={option} onPress={() => { haptic.selection(); onSelect(valueMap?.[option] || option); }} style={({ pressed }) => [styles.filterChoice, option === selected || valueMap?.[option] === selected ? styles.filterChoiceSelected : null, pressed && styles.pressed]}><Text style={[styles.filterChoiceText, option === selected || valueMap?.[option] === selected ? styles.filterChoiceTextSelected : null]}>{option}</Text></Pressable>)}</View></View>;
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return <View style={styles.emptyState}><View style={styles.emptyIcon}><AppIcon name="brief" size={24} color="#0891B2" /></View><Text style={styles.emptyTitle}>No jobs found</Text><Text style={styles.emptyCopy}>Try widening your filters to see more opportunities.</Text><ScalePressable hapticFeedback onPress={onReset} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Reset filters</Text></ScalePressable></View>;
}

function DiscoveryTabBar({ insetsBottom, router }: { insetsBottom: number; router: ReturnType<typeof useRouter> }) {
  const tabs = [{ label: "Home", icon: "home" as const, route: "/" }, { label: "Jobs", icon: "search" as const, route: "/explore" }, { label: "Inbox", icon: "bell" as const, route: "/inbox" }, { label: "Profile", icon: "user" as const, route: "/profile" }];
  return <View style={[styles.tabBar, { paddingBottom: insetsBottom }]}>{tabs.slice(0, 2).map((tab) => { const active = tab.label === "Jobs"; return <Pressable accessibilityLabel={tab.label} key={tab.label} onPress={() => router.dismissTo(tab.route as never)} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}><AppIcon name={tab.icon} size={27} color={active ? "#0891B2" : "#66736A"} /><Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text></Pressable>; })}<View style={styles.tabItem}><PostTabButton /></View><Pressable accessibilityLabel="Inbox" onPress={() => router.dismissTo("/inbox" as never)} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}><AppIcon name="bell" size={27} color="#66736A" /><Text style={styles.tabLabel}>Inbox</Text></Pressable><Pressable accessibilityLabel="Profile" onPress={() => router.dismissTo("/profile" as never)} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}><AppIcon name="user" size={27} color="#66736A" /><Text style={styles.tabLabel}>Profile</Text></Pressable></View>;
}

function matchesPrimary(kind: DiscoveryKind, selected: string, job: any) {
  if (selected.startsWith("Any") || selected === "All fields") return true;
  if (kind === "internships") return job.category === selected;
  if (kind === "remote") return selected === "No experience" ? job.noExperience : selected === "Entry level" ? job.experience === "Entry level" : selected === "2+ years" ? job.experience === "2–3 years" : true;
  if (kind === "part-time") return selected === "Evening" ? job.schedule.includes("PM") : selected === "Morning" ? job.schedule.includes("AM") || job.schedule.includes("Morning") : selected === "Afternoon" ? job.schedule.includes("PM") || job.schedule.includes("Afternoon") : true;
  return selected === "Event work" ? job.category === "Hospitality" : selected === "Evening" ? job.schedule.includes("PM") : true;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FFFFFF", flex: 1, position: "relative" },
  content: { backgroundColor: "#FFFFFF", paddingHorizontal: 20 },
  header: { backgroundColor: "#FFFFFF", borderBottomColor: "#E2E8E5", borderBottomWidth: 1, marginHorizontal: -20 },
  topBar: { alignItems: "center", flexDirection: "row", minHeight: 64, paddingHorizontal: 20, paddingVertical: 10 },
  backButton: { alignItems: "center", height: 42, justifyContent: "center", marginRight: 3, width: 42 },
  headingCopy: { flex: 1 },
  topTitle: { color: "#17201A", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  resultCount: { color: "#66736A", fontSize: 10.5, marginTop: 2 },
  filterButton: { alignItems: "center", backgroundColor: "#F4F8F5", borderRadius: 12, height: 42, justifyContent: "center", position: "relative", width: 42 },
  filterBadge: { alignItems: "center", backgroundColor: "#0891B2", borderColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, height: 16, justifyContent: "center", minWidth: 16, position: "absolute", right: 0, top: 1 },
  filterBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  headerRule: { display: "none" },
  jobCard: { alignItems: "flex-start", borderBottomColor: "#E8ECEA", borderBottomWidth: 1, flexDirection: "row", minHeight: 124, paddingHorizontal: 1, paddingVertical: 13 },
  jobImage: { backgroundColor: "#E8F0EC", borderRadius: 8, height: 82, width: 74 },
  jobCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", minHeight: 31 },
  jobTitle: { color: "#17201A", flex: 1, fontSize: 12.5, fontWeight: "800", lineHeight: 16 },
  bookmarkButton: { alignItems: "center", height: 26, justifyContent: "center", marginLeft: 5, width: 24 },
  companyText: { color: "#4F5E56", fontSize: 10.5, marginTop: 1 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 5 },
  metaText: { color: "#66736A", flex: 1, fontSize: 10, lineHeight: 14 },
  payRow: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 5 },
  payText: { color: "#0891B2", fontSize: 11, fontWeight: "800" },
  jobTag: { backgroundColor: "#F1F4F2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  jobTagText: { color: "#526158", fontSize: 9.5, fontWeight: "600" },
  postedText: { color: "#7C8781", flex: 1, fontSize: 9.5, textAlign: "right" },
  cardPressed: { opacity: 0.72 },
  pressed: { opacity: 0.65 },
  emptyState: { alignItems: "center", padding: 34 },
  emptyIcon: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 26, height: 52, justifyContent: "center", width: 52 },
  emptyTitle: { color: "#17201A", fontSize: 16, fontWeight: "800", marginTop: 12 },
  emptyCopy: { color: "#66736A", fontSize: 12.5, lineHeight: 18, marginTop: 6, textAlign: "center" },
  emptyButton: { backgroundColor: "#0891B2", borderRadius: 11, marginTop: 16, paddingHorizontal: 14, paddingVertical: 10 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },
  tabBar: { alignItems: "stretch", backgroundColor: "#FFFFFF", borderTopColor: "#E2E8E5", borderTopWidth: 1, bottom: 0, flexDirection: "row", left: 0, minHeight: 56, paddingTop: 8, position: "absolute", right: 0 },
  tabItem: { alignItems: "center", flex: 1, gap: 3 },
  tabLabel: { color: "#66736A", fontSize: 9.5, lineHeight: 12 },
  tabLabelActive: { color: "#0891B2", fontWeight: "800" },
  sheetOverlay: { backgroundColor: "rgba(23,32,26,0.3)", flex: 1, justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: { backgroundColor: "#F7F8F6", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "82%" },
  sheetHandle: { alignSelf: "center", backgroundColor: "#C9D4CE", borderRadius: 3, height: 4, marginTop: 10, width: 38 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  sheetTitle: { color: "#17201A", fontSize: 18, fontWeight: "800" },
  sheetSubtitle: { color: "#66736A", fontSize: 11.5, marginTop: 3 },
  sheetClose: { alignItems: "center", height: 36, justifyContent: "center", width: 36 },
  sheetContent: { paddingBottom: 12, paddingHorizontal: 20 },
  filterGroup: { borderTopColor: "#E2E8E5", borderTopWidth: 1, paddingVertical: 15 },
  filterLabel: { color: "#17201A", fontSize: 13, fontWeight: "800", marginBottom: 10 },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChoice: { backgroundColor: "#FFFFFF", borderColor: "#DCE5E0", borderRadius: 10, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10 },
  filterChoiceSelected: { backgroundColor: "#0891B2", borderColor: "#0891B2" },
  filterChoiceText: { color: "#526158", fontSize: 11.5, fontWeight: "600" },
  filterChoiceTextSelected: { color: "#FFFFFF", fontWeight: "800" },
  sheetFooter: { backgroundColor: "#FFFFFF", borderTopColor: "#E2E8E5", borderTopWidth: 1, flexDirection: "row", gap: 10, padding: 15 },
  resetButton: { alignItems: "center", borderColor: "#DCE5E0", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 26 },
  resetText: { color: "#526158", fontSize: 13, fontWeight: "800" },
  applyButton: { alignItems: "center", backgroundColor: "#0891B2", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 20 },
  applyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 80 },
});
