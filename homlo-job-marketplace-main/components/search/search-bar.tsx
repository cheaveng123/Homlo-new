import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";

type SearchBarProps = {
  query?: string;
  location?: string;
  onPress: () => void;
  onBack?: () => void;
  onFilters?: () => void;
  filterCount?: number;
  disableTopInset?: boolean;
};

export function SearchBar({ query, onPress, onBack, onFilters, filterCount = 0, disableTopInset = false }: SearchBarProps) {
  const insets = useSafeAreaInsets();
  const topPadding = disableTopInset ? 0 : Math.max(insets.top, 8) + 4;
  const displayQuery = query?.trim();

  return (
    <View style={[styles.shell, { paddingTop: topPadding }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              haptic.light();
              onBack();
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <IconSymbol name="chevron.left" size={18} color="#17201A" />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search jobs"
          onPress={() => {
            haptic.light();
            onPress();
          }}
          style={({ pressed }) => [styles.bar, styles.barFlex, pressed && styles.pressed]}
        >
          <BarContent query={displayQuery} />
        </Pressable>
        {onFilters ? <FilterButton count={filterCount} onPress={onFilters} /> : null}
      </View>
    </View>
  );
}

function BarContent({ query }: { query?: string }) {
  return (
    <>
      <IconSymbol name="magnifyingglass" size={16} color="#94A098" />
      <Text numberOfLines={1} style={[styles.searchText, query ? styles.searchTextActive : null]}>
        {query || "Search jobs, skills, or companies..."}
      </Text>
    </>
  );
}

function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} active` : "Filters"}
      accessibilityState={{ expanded: false, selected: count > 0 }}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
    >
      <IconSymbol name="slider.horizontal.3" size={17} color="#17201A" />
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#F7F8F6",
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  backButton: {
    alignItems: "center",
    backgroundColor: "#EDF7EF",
    borderRadius: 19,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  bar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8E5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    shadowColor: "#173C25",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  barFlex: { flex: 1 },
  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8E5",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    position: "relative",
    width: 46,
  },
  filterBadge: {
    alignItems: "center",
    backgroundColor: "#16803C",
    borderColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 3,
    position: "absolute",
    right: -3,
    top: -4,
  },
  filterBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800" },
  searchText: { color: "#94A098", flex: 1, fontSize: 14, fontWeight: "400" },
  searchTextActive: { color: "#17201A", fontWeight: "500" },
  pressed: { opacity: 0.82 },
});