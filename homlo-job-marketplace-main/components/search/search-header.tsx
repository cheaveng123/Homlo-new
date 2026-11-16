import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { haptic } from "@/lib/haptics";
import { defaultQuickChips, type QuickChip } from "@/components/search/quick-chips";

const CHIP_ICON: Record<QuickChip["icon"], IconName> = {
  "square.grid.2x2": "grid",
  clock: "clock",
  "graduationcap.fill": "grad",
  calendar: "calendar",
  mappin: "pin",
};

type SearchHeaderProps = {
  keyword: string;
  location: string;
  activeChip: string | null;
  filterCount?: number;
  autoFocus?: boolean;
  disableTopInset?: boolean;
  onChangeKeyword: (value: string) => void;
  onChangeLocation: (value: string) => void;
  onSearch: () => void;
  onOpenFilters: () => void;
  onQuickChip: (chip: QuickChip) => void;
};

export function SearchHeader({ keyword, location, activeChip, filterCount = 0, autoFocus = false, disableTopInset = false, onChangeKeyword, onChangeLocation, onSearch, onOpenFilters, onQuickChip }: SearchHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const headerTopPadding = disableTopInset ? 0 : Math.max(insets.top, 12);

  return (
    <View style={[styles.headerShell, { paddingTop: headerTopPadding }]}>
      <Text style={styles.eyebrow}>HOMLO JOBS</Text>
      <Text style={styles.title}>Search jobs near you</Text>
      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <AppIcon name="search" size={18} color="#16803C" />
          <TextInput
            accessibilityLabel="Search jobs, skills, or companies"
            autoFocus={autoFocus}
            onChangeText={onChangeKeyword}
            onSubmitEditing={onSearch}
            placeholder={isCompact ? "Search jobs" : "Search jobs, skills, or companies"}
            placeholderTextColor="#94A098"
            returnKeyType="search"
            style={styles.searchInput}
            value={keyword}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.searchRow}>
          <AppIcon name="pin" size={18} color="#16803C" />
          <TextInput
            accessibilityLabel="Location"
            onChangeText={onChangeLocation}
            onSubmitEditing={onSearch}
            placeholder="Location"
            placeholderTextColor="#94A098"
            returnKeyType="search"
            style={styles.searchInput}
            value={location}
          />
          <ScalePressable accessibilityLabel="Run search" hapticFeedback onPress={onSearch} style={styles.searchButton}>
            <AppIcon name="search" size={17} color="#FFFFFF" />
          </ScalePressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        {defaultQuickChips.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter by ${chip.label}`}
              onPress={() => {
                haptic.light();
                onQuickChip(chip);
              }}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
            >
              <AppIcon name={CHIP_ICON[chip.icon]} size={13} color={active ? "#16803C" : "#17201A"} />
              <Text style={active ? styles.chipTextActive : styles.chipText}>{chip.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filterCount > 0 ? `More filters, ${filterCount} active` : "More filters"}
          onPress={onOpenFilters}
          style={({ pressed }) => [styles.chip, filterCount > 0 && styles.chipActive, pressed && styles.pressed]}
        >
          <AppIcon name="sliders" size={13} color={filterCount > 0 ? "#16803C" : "#17201A"} />
          <Text style={filterCount > 0 ? styles.chipTextActive : styles.chipText}>Filters{filterCount > 0 ? ` · ${filterCount}` : ""}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerShell: { backgroundColor: "#F7F8F6", paddingHorizontal: 16, paddingBottom: 8 },
  eyebrow: { color: "#16803C", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#17201A", fontSize: 21, fontWeight: "700", letterSpacing: -0.4, marginTop: 4 },
  searchCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8E5",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  searchRow: { alignItems: "center", flexDirection: "row", minHeight: 44, paddingVertical: 4 },
  searchInput: { color: "#17201A", flex: 1, fontSize: 14, marginLeft: 10, paddingVertical: 6 },
  divider: { backgroundColor: "#EEF2EF", height: 1 },
  searchButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 10, height: 34, justifyContent: "center", marginLeft: 8, width: 56 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 14, paddingRight: 4 },
  chip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: "#EAF6EC", borderColor: "#16803C" },
  chipText: { color: "#17201A", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#16803C", fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.78 },
});