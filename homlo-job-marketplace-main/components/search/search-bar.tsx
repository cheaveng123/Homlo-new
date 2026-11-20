import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";

import { AppIcon } from "@/components/ui/AppIcon";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";
import AnimatedPlaceholder from "./AnimatedPlaceholder";
import { employerWords, jobSeekerWords } from "./searchPlaceholderWords";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SchemeColors } from "@/constants/theme";

type SearchBarProps = {
  query?: string;
  location?: string;
  onPress: () => void;
  onBack?: () => void;
  onFilters?: () => void;
  filterCount?: number;
  disableTopInset?: boolean;
  role?: "seeker" | "employer";
};

export function SearchBar({
  query,
  onPress,
  onBack,
  onFilters,
  filterCount = 0,
  disableTopInset = false,
  role = "seeker",
}: SearchBarProps) {
  const insets = useSafeAreaInsets();
    const topPadding = disableTopInset ? 0 : Math.max(insets.top, 8) + 20;
  const displayQuery = query?.trim();
  const scheme = useColorScheme();
  const theme = SchemeColors[scheme === "dark" ? "dark" : "light"];
  const isScreenFocused = useIsFocused();

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
            <AppIcon name="back" size={18} color="#17201A" />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={role === "employer" ? "Search applicants" : "Search jobs"}
          onPress={() => {
            haptic.light();
            onPress();
          }}
          style={({ pressed }) => [styles.bar, styles.barFlex, pressed && styles.pressed]}
        >
          <BarContent
            query={displayQuery}
            role={role}
            schemeTheme={theme}
            paused={!isScreenFocused}
          />
        </Pressable>
        {onFilters ? <FilterButton count={filterCount} onPress={onFilters} /> : null}
      </View>
    </View>
  );
}

function FilterButton({ count, onPress }: { count?: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Filters"
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
    >
      <AppIcon name="sliders" size={18} color="#17201A" />
      {count ? (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
function BarContent({
  query,
  role = "seeker",
  schemeTheme,
  paused = false,
}: {
  query?: string;
  role?: "seeker" | "employer";
  schemeTheme?: any;
  paused?: boolean;
}) {
  const displayQuery = query?.trim();
  return (
    <>
      <View style={{ marginRight: 6 }}>
        <AppIcon name="search" size={17} color="#94A098" />
      </View>
      <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
        {displayQuery ? (
          <Text numberOfLines={1} style={[styles.searchText, styles.searchTextActive]}>
            {displayQuery}
          </Text>
        ) : (
          <AnimatedPlaceholder
            words={role === "employer" ? employerWords : jobSeekerWords}
            visible={!displayQuery}
            paused={paused}
            color={schemeTheme?.softBlue ?? "#7FAEF0"}
            prefixColor={schemeTheme?.muted ?? "#6F7F75"}
            fontSize={15}
            lineHeight={22}
          />
        )}
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8E5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E5",
    paddingHorizontal: 16,
    height: 56,
    gap: 10,
  },
  barFlex: { flex: 1 },
  filterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 16, borderWidth: 1, justifyContent: "center", position: "relative", width: 48, height: 48 },
  filterBadge: { alignItems: "center", backgroundColor: "#0891B2", borderColor: "#FFFFFF", borderRadius: 8, borderWidth: 1.5, height: 16, justifyContent: "center", minWidth: 16, paddingHorizontal: 3, position: "absolute", right: -3, top: -4 },
  filterBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800" },
  searchText: { color: "#94A098", flex: 1, fontSize: 15, fontWeight: "400" },
  searchTextActive: { color: "#17201A", fontWeight: "500" },
  pressed: { opacity: 0.82 },
});
