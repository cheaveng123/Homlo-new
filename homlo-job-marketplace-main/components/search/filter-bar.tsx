import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { arrangementFilters, employmentFilters, experienceFilters, postedFilters, type SearchFilters } from "@/lib/search-filters";

type FilterPill = {
  key: keyof SearchFilters;
  label: string;
  options: readonly string[];
};

const filterPills: FilterPill[] = [
  { key: "category", label: "Category", options: [] },
  { key: "employmentType", label: "Job type", options: employmentFilters },
  { key: "arrangement", label: "Workplace", options: arrangementFilters },
  { key: "experience", label: "Experience", options: experienceFilters },
  { key: "posted", label: "Date posted", options: postedFilters },
];

type FilterBarProps = {
  filters: SearchFilters;
  categoryOptions: string[];
  activeCount: number;
  onChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onOpenMore: () => void;
};

export function FilterBar({ filters, categoryOptions, activeCount, onChange, onOpenMore }: FilterBarProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false}>
        {filterPills.map((pill) => {
          if (pill.key === "category") {
            return <CategoryPill key={pill.key} filters={filters} onChange={onChange} options={categoryOptions} />;
          }
          const value = filters[pill.key];
          const active = value !== pill.options[0] && value !== "All";
          return <FilterChip key={pill.key} active={active} label={pill.label} value={String(value)} onPress={() => onChange(pill.key, value === pill.options[0] ? value : pill.options[0])} />;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Open all filters" onPress={onOpenMore} style={({ pressed }) => [styles.chip, pressed && styles.pressed, activeCount > 0 ? styles.chipActive : null]}>
          <IconSymbol name="slider.horizontal.3" size={13} color={activeCount > 0 ? "#16803C" : "#17201A"} />
          <Text style={activeCount > 0 ? styles.chipTextActive : styles.chipText}>More filters{activeCount ? ` · ${activeCount}` : ""}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FilterChip({ active, label, value, onPress }: { active: boolean; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}{value !== "Any" && value !== "All" ? ` · ${value}` : ""}</Text>
      <IconSymbol name="chevron.down" size={12} color={active ? "#16803C" : "#17201A"} />
    </Pressable>
  );
}

function CategoryPill({ filters, onChange, options }: { filters: SearchFilters; onChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void; options: string[] }) {
  const value = filters.category;
  const active = value !== "All";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Category: ${value}`} onPress={() => onChange("category", active ? "All" : value)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{active ? `Category · ${value}` : "Category"}</Text>
      <IconSymbol name="chevron.down" size={12} color={active ? "#16803C" : "#17201A"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  chip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8E5",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#EAF6EC", borderColor: "#16803C" },
  chipText: { color: "#17201A", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#16803C", fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});