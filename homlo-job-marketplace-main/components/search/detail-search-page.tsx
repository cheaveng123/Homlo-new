import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { goBack as goBackOrHome } from "@/lib/navigation";
import { PolygonDrawMap } from "@/components/search/polygon-draw-map";
import { isValidPolygon } from "@/lib/polygon";
import { defaultSearchCenter } from "@/lib/job-geography";
import { defaultSearchFilters, payPeriods, type EmploymentFilter, type MapCoordinate, type PayPeriodFilter, type SearchFilters } from "@/lib/search-filters";
import { getDetailSnapshot, publishAppliedFilters } from "@/lib/detail-search-store";
import { trpc } from "@/lib/trpc";

const GREEN = "#58C7A4";
const GREEN_INK = "#0E8160";
const TEXT_PRIMARY = "#1F2933";
const TEXT_SECONDARY = "#6B7280";
const CONTROL_GRAY = "#F1F4F3";
const SELECTED_BG = "#EFF9F5";
const DIVIDER = "#EEF0EF";
const SLIDER_TRACK = "#E3E8E6";
const MUTED = "#9AA19F";

const DISTANCE_MIN = 5;
const DISTANCE_MAX = 50;

const quickSearchOptions: { label: string; icon: "clock" | "graduationcap.fill" | "calendar" | "house.fill"; value: EmploymentFilter | "Remote" }[] = [
  { label: "Part-time", icon: "clock", value: "Part-time" },
  { label: "Internship", icon: "graduationcap.fill", value: "Internship" },
  { label: "Weekend", icon: "calendar", value: "Weekend" },
  { label: "Remote", icon: "house.fill", value: "Remote" },
];

const PRICE_PERIODS: Record<PayPeriodFilter, { min: number; max: number }> = {
  "Per hour": { min: 2, max: 50 },
  "Per day": { min: 16, max: 400 },
  "Per week": { min: 80, max: 2000 },
  "Per month": { min: 320, max: 8000 },
};

const jobTypeRows: {
  key: string;
  label: string;
  icon: "briefcase.fill" | "clock" | "calendar.days" | "graduationcap.fill" | "sun.max";
  value: EmploymentFilter;
}[] = [
  { key: "all", label: "All", icon: "briefcase.fill", value: "Any" },
  { key: "part-time", label: "Part-time", icon: "clock", value: "Part-time" },
  { key: "full-time", label: "Full-time", icon: "calendar.days", value: "Full-time" },
  { key: "internship", label: "Internship", icon: "graduationcap.fill", value: "Internship" },
  { key: "seasonal", label: "Seasonal", icon: "sun.max", value: "Temporary" },
];

type PublishedJobLike = {
  title: string;
  description?: string;
  pay_type?: string;
};

/**
 * Mirrors the backend's employment-type inference (homlo_search_public_jobs)
 * so the counts shown next to each Job type row reflect real published jobs.
 */
function inferEmploymentType(record: PublishedJobLike): EmploymentFilter {
  const title = (record.title ?? "").toLowerCase();
  const description = (record.description ?? "").toLowerCase();
  const hasText = (...words: string[]) => words.some((w) => title.includes(w) || description.includes(w));
  const payType = record.pay_type ?? "";

  if (payType === "hourly" || hasText("part-time", "part time", "parttime")) return "Part-time";
  if (payType === "fixed" || payType === "daily" || hasText("full-time", "full time", "fulltime")) return "Full-time";
  if (hasText("temporary", " temp", "seasonal", "season")) return "Temporary";
  if (hasText("intern", "trainee")) return "Internship";
  if (hasText("weekend", "saturday", "sunday")) return "Weekend";
  return "Any";
}

function sliderValue(raw: string | undefined, min: number, max: number, fallback: number) {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function DetailSearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const snapshot = useMemo(() => getDetailSnapshot(), []);
  const [query, setQuery] = useState(() => snapshot?.query ?? "");
  const [draft, setDraft] = useState<SearchFilters>(() => {
    const base = defaultSearchFilters;
    return snapshot ? { ...base, ...snapshot.filters } : base;
  });

  const distanceValue = sliderValue(draft.radiusKm, DISTANCE_MIN, DISTANCE_MAX, DISTANCE_MAX);
  const pricePeriod = draft.payPeriod ?? "Per hour";
  const priceCfg = PRICE_PERIODS[pricePeriod];
  const priceValue = sliderValue(draft.salaryMax || "", priceCfg.min, priceCfg.max, priceCfg.max);

  const [distanceExpand] = useState(() => new Animated.Value(draft.nearMe ? 1 : 0));

  useEffect(() => {
    Animated.timing(distanceExpand, {
      toValue: draft.nearMe ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [draft.nearMe, distanceExpand]);

  const dropHeight = distanceExpand.interpolate({ inputRange: [0, 1], outputRange: [0, 96] });
  const dropOpacity = distanceExpand.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const dropTranslateY = distanceExpand.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  const publicJobs = trpc.homlo.publicJobs.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const typeCounts = useMemo<Record<string, number>>(() => {
    const records = publicJobs.data?.jobs ?? [];
    const counts: Record<string, number> = { Any: 0, "Part-time": 0, "Full-time": 0, "Internship": 0, "Temporary": 0, "Weekend": 0 };
    for (const job of records) {
      const type = inferEmploymentType(job);
      counts[type] = (counts[type] ?? 0) + 1;
      counts.Any += 1;
    }
    return counts;
  }, [publicJobs.data?.jobs]);
  const countLoaded = Boolean(publicJobs.data?.jobs);

  const selectJobType = (value: EmploymentFilter) => {
    haptic.selection();
    setDraft((current) => ({ ...current, employmentType: value }));
  };

  const toggleNearMe = async (next: boolean) => {
    haptic.selection();
    if (!next) {
      setDraft((current) => ({ ...current, nearMe: false, nearCenter: undefined }));
      return;
    }
    let center: MapCoordinate = defaultSearchCenter;
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.status === "granted" ? true : (await Location.requestForegroundPermissionsAsync()).status === "granted";
      if (granted) {
        const position = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (position) center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      }
    } catch {
      center = defaultSearchCenter;
    }
    setDraft((current) => ({ ...current, nearMe: true, nearCenter: center, polygon: undefined, polygonLabel: undefined }));
  };

  const addAreaPoint = (point: MapCoordinate) => {
    haptic.light();
    setDraft((current) => {
      const next = [...(current.polygon ?? []), point];
      return {
        ...current,
        nearMe: false,
        nearCenter: undefined,
        polygon: next,
        polygonLabel: next.length >= 3 ? `Drawn area (${next.length} points)` : undefined,
      };
    });
  };

  const removeLastAreaPoint = () => {
    haptic.selection();
    setDraft((current) => {
      const next = (current.polygon ?? []).slice(0, -1);
      return { ...current, polygon: next.length > 0 ? next : undefined, polygonLabel: next.length >= 3 ? `Drawn area (${next.length} points)` : undefined };
    });
  };

  const clearArea = () => {
    haptic.selection();
    setDraft((current) => ({ ...current, polygon: undefined, polygonLabel: undefined }));
  };

  const onDistanceChange = (value: number) => {
    setDraft((current) => ({ ...current, radiusKm: value >= DISTANCE_MAX ? "" : String(value) }));
  };

  const onPriceChange = (value: number) => {
    setDraft((current) => {
      const cfg = PRICE_PERIODS[current.payPeriod ?? "Per hour"];
      return { ...current, salaryMax: value >= cfg.max ? "" : String(value) };
    });
  };

  const selectPayPeriod = (period: PayPeriodFilter) => {
    haptic.selection();
    setDraft((current) => ({ ...current, payPeriod: period, salaryMax: "" }));
  };

  const applyFilters = () => {
    haptic.success();
    publishAppliedFilters({ query: query.trim(), filters: draft });
    router.push("/search-results" as never);
  };

  const formatAmount = (value: number) => value.toLocaleString("en-US");

  const distanceLeft = distanceValue >= DISTANCE_MAX ? `${DISTANCE_MAX}km+` : `${distanceValue}km`;
  const priceLeft = priceValue >= priceCfg.max ? `$${formatAmount(priceCfg.max)}+` : `$${formatAmount(priceValue)}`;

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-white" safeAreaClassName="bg-white">
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => goBackOrHome(router)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <IconSymbol name="chevron.left" size={19} color={TEXT_PRIMARY} />
          </Pressable>
          <View style={styles.searchField}>
            <IconSymbol name="magnifyingglass" size={16} color="#8A9390" />
            <TextInput
              accessibilityLabel="Search jobs"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={applyFilters}
              returnKeyType="search"
              placeholder="Search jobs..."
              placeholderTextColor="#8A9390"
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery("")} style={styles.clearButton}>
                <IconSymbol name="xmark" size={15} color="#8A9390" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 84 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.quickSearchTitle}>Quick search</Text>
          <View style={styles.quickSearchGrid}>
            {quickSearchOptions.map((option) => {
              const active = option.value === "Remote" ? draft.arrangement === "Remote" : draft.employmentType === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.label}
                  onPress={() => {
                    haptic.selection();
                    if (option.value === "Remote") setDraft((current) => ({ ...current, arrangement: active ? "Any" : "Remote" }));
                    else setDraft((current) => ({ ...current, employmentType: active ? "Any" : option.value as EmploymentFilter }));
                  }}
                  style={({ pressed }) => [styles.quickSearchPill, active && styles.quickSearchPillActive, pressed && styles.pressed]}
                >
                  <IconSymbol name={option.icon} size={16} color={active ? "#FFFFFF" : GREEN_INK} />
                  <Text style={active ? styles.quickSearchTextActive : styles.quickSearchText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Price range</Text>
            <View style={styles.periodRow}>
              {payPeriods.map((period) => {
                const active = pricePeriod === period;
                return (
                  <Pressable
                    key={period}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${period}`}
                    onPress={() => selectPayPeriod(period)}
                    style={({ pressed }) => [styles.periodPill, active && styles.periodPillActive, pressed && styles.pressed]}
                  >
                    <Text style={active ? styles.periodPillTextActive : styles.periodPillText}>{period.replace("Per ", "")}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>{priceLeft}</Text>
              <Text style={styles.valueLabel}>{`$${formatAmount(priceCfg.max)}+`}</Text>
            </View>
            <SingleSlider max={priceCfg.max} min={priceCfg.min} onChange={onPriceChange} value={priceValue} />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Job type</Text>
            <View style={styles.jobTypeList}>
              {jobTypeRows.map((row) => {
                const selected = draft.employmentType === row.value;
                const count = countLoaded ? typeCounts[row.value] ?? 0 : null;
                return (
                  <Pressable
                    key={row.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${row.label}${count !== null ? `, ${count} jobs` : ""}`}
                    onPress={() => selectJobType(row.value)}
                    style={({ pressed }) => [styles.jobTypeRow, selected && styles.jobTypeRowSelected, pressed && styles.pressed]}
                  >
                    <IconSymbol name={row.icon} size={20} color={selected ? GREEN_INK : "#9AA19F"} />
                    <Text style={selected ? styles.jobTypeLabelSelected : styles.jobTypeLabel}>{row.label}</Text>
                    <Text style={selected ? styles.jobTypeCountSelected : styles.jobTypeCount}>
                      {count !== null ? count.toLocaleString() : "—"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Location</Text>
            <View style={styles.mapCard}>
              <View style={styles.mapShell}>
                <PolygonDrawMap
                  center={draft.nearCenter ?? defaultSearchCenter}
                  polygon={draft.polygon ?? []}
                  onAddPoint={addAreaPoint}
                  onRemoveLastPoint={removeLastAreaPoint}
                  onClear={clearArea}
                />
              </View>
              <View style={styles.drawRow}>
                <View style={styles.drawStatusRow}>
                  <IconSymbol name={isValidPolygon(draft.polygon) ? "checkmark.circle.fill" : "mappin"} size={14} color={GREEN_INK} />
                  <Text style={styles.drawStatus}>
                    {isValidPolygon(draft.polygon) ? `Drawn area (${(draft.polygon ?? []).length} points)` : "Tap the map to draw an area"}
                  </Text>
                </View>
                <View style={styles.drawActions}>
                  <DrawChip disabled={!draft.polygon?.length} label="Undo" onPress={removeLastAreaPoint} />
                  <DrawChip disabled={!draft.polygon?.length} label="Clear" onPress={clearArea} />
                </View>
              </View>
            </View>
            <View style={styles.nearMeRow}>
              <View style={styles.locationIconWell}>
                <IconSymbol name="mappin" size={20} color={GREEN_INK} />
              </View>
              <View style={styles.nearMeCopy}>
                <Text style={styles.nearMeTitle}>Near me</Text>
                <Text style={styles.nearMeSubtitle}>Use current location</Text>
              </View>
              <MiniSwitch
                accessibilityLabel="Use current location"
                onValueChange={toggleNearMe}
                value={draft.nearMe}
              />
            </View>
            <Animated.View
              style={{ height: dropHeight, opacity: dropOpacity, overflow: "hidden", transform: [{ translateY: dropTranslateY }] }}
            >
              <View style={styles.distanceDrop}>
                <Text style={styles.subHeading}>Distance</Text>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>{distanceLeft}</Text>
                  <Text style={styles.valueLabel}>{`${DISTANCE_MAX}km+`}</Text>
                </View>
                <SingleSlider max={DISTANCE_MAX} min={DISTANCE_MIN} onChange={onDistanceChange} value={distanceValue} />
              </View>
            </Animated.View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
            onPress={applyFilters}
            style={({ pressed }) => [styles.applyButton, pressed && styles.applyPressed]}
          >
            <Text style={styles.applyText}>Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function MiniSwitch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (next: boolean) => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        value ? styles.switchTrackOn : styles.switchTrackOff,
      ]}
    >
      <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
    </Pressable>
  );
}

function DrawChip({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={[styles.drawChip, disabled && styles.drawChipDisabled]}
    >
      <Text style={[styles.drawChipText, disabled && styles.drawChipTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function SingleSlider({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(0);
  const fraction = (value - min) / (max - min);

  const applyFromX = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const next = Math.min(1, Math.max(0, x / width));
      onChange(Math.round(min + next * (max - min)));
    },
    [width, min, max, onChange],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => applyFromX(event.nativeEvent.locationX),
        onPanResponderMove: (event) => applyFromX(event.nativeEvent.locationX),
      }),
    [applyFromX],
  );

  const thumbOffset = Math.max(0, fraction * (width - 14));

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Slider"
      accessibilityValue={{ min, max, now: value }}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.sliderArea}
      {...responder.panHandlers}
    >
      <View style={styles.sliderRail} />
      <View style={[styles.sliderRailActive, { width: thumbOffset + 7 }]} />
      <View style={[styles.sliderThumb, { left: thumbOffset }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FFFFFF", flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: 8, paddingBottom: 6, paddingHorizontal: 20 },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  searchField: { alignItems: "center", backgroundColor: CONTROL_GRAY, borderRadius: 20, flex: 1, flexDirection: "row", gap: 7, height: 40, paddingHorizontal: 14 },
  searchInput: { color: TEXT_PRIMARY, flex: 1, fontSize: 14, paddingVertical: 0 },
  clearButton: { alignItems: "center", height: 24, justifyContent: "center", width: 24 },
  pressed: { opacity: 0.7 },

  content: { paddingHorizontal: 20 },

  quickSearchTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "800", marginTop: 12 },
  quickSearchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  quickSearchPill: { alignItems: "center", backgroundColor: CONTROL_GRAY, borderRadius: 18, flexDirection: "row", gap: 6, height: 38, justifyContent: "center", paddingHorizontal: 15, width: "47%" },
  quickSearchPillActive: { backgroundColor: GREEN_INK },
  quickSearchText: { color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: "700" },
  quickSearchTextActive: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },

  sectionHeading: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  periodRow: { flexDirection: "row", gap: 8, marginTop: 11 },
  periodPill: { alignItems: "center", backgroundColor: CONTROL_GRAY, borderRadius: 17, flex: 1, height: 33, justifyContent: "center" },
  periodPillActive: { backgroundColor: GREEN },
  periodPillText: { color: "#66706D", fontSize: 12, fontWeight: "600" },
  periodPillTextActive: { color: GREEN_INK, fontSize: 12, fontWeight: "700" },

  sectionBlock: { marginTop: 12 },
  jobTypeList: { marginTop: 10 },
  jobTypeRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 9, flexDirection: "row", gap: 12, height: 44, paddingHorizontal: 10 },
  jobTypeRowSelected: { backgroundColor: SELECTED_BG },
  jobTypeLabel: { color: "#4F5956", flex: 1, fontSize: 14, fontWeight: "500" },
  jobTypeLabelSelected: { color: GREEN_INK, flex: 1, fontSize: 14, fontWeight: "600" },
  jobTypeCount: { color: "#9AA19F", fontSize: 12.5, fontWeight: "500", marginRight: 4 },
  jobTypeCountSelected: { color: GREEN_INK, fontSize: 12.5, fontWeight: "600", marginRight: 4 },

  divider: { backgroundColor: DIVIDER, height: 1, marginHorizontal: -20, marginTop: 20 },
  mapCard: { backgroundColor: "#FFFFFF", borderColor: DIVIDER, borderRadius: 16, borderWidth: 1, marginTop: 12, overflow: "hidden" },
  mapShell: { height: 190 },
  drawRow: { alignItems: "center", flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10 },
  drawStatusRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 6 },
  drawStatus: { color: TEXT_SECONDARY, flex: 1, fontSize: 11.5, fontWeight: "500" },
  drawActions: { flexDirection: "row", gap: 6 },
  drawChip: { alignItems: "center", backgroundColor: CONTROL_GRAY, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  drawChipDisabled: { opacity: 0.45 },
  drawChipText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: "600" },
  drawChipTextDisabled: { color: MUTED },
  nearMeRow: { alignItems: "center", flexDirection: "row", marginTop: 14 },
  distanceDrop: { paddingTop: 18 },
  locationIconWell: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  nearMeCopy: { flex: 1, marginLeft: 6 },
  nearMeTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600" },
  nearMeSubtitle: { color: MUTED, fontSize: 11.5, marginTop: 1 },

  switchTrack: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    height: 20,
    justifyContent: "flex-start",
    padding: 2,
    width: 32,
  },
  switchTrackOff: { backgroundColor: SLIDER_TRACK },
  switchTrackOn: { backgroundColor: GREEN },
  switchKnob: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 16,
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    width: 16,
  },
  switchKnobOn: { transform: [{ translateX: 12 }] },

  subHeading: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
  valueRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  valueLabel: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: "500" },

  sliderArea: { height: 30, justifyContent: "center", marginTop: 8, position: "relative" },
  sliderRail: { backgroundColor: SLIDER_TRACK, borderRadius: 2, height: 3, width: "100%" },
  sliderRailActive: { backgroundColor: GREEN, borderRadius: 2, height: 3, left: 0, position: "absolute" },
  sliderThumb: {
    backgroundColor: "#FFFFFF",
    borderColor: GREEN,
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 0,
    position: "absolute",
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    width: 14,
  },

  footer: { backgroundColor: "#FFFFFF", borderTopColor: DIVIDER, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
  applyButton: { alignItems: "center", backgroundColor: GREEN, borderRadius: 24, height: 47, justifyContent: "center" },
  applyPressed: { opacity: 0.9 },
  applyText: { color: GREEN_INK, fontSize: 14, fontWeight: "700" },
});
