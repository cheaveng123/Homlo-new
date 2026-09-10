import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { haptic } from "@/lib/haptics";
import { isValidPolygon } from "@/lib/polygon";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { PolygonDrawMap } from "@/components/search/polygon-draw-map";
import {
  arrangementFilters,
  defaultSearchFilters,
  employmentFilters,
  experienceFilters,
  postedFilters,
  type SearchFilters,
} from "@/lib/search-filters";

type SectionDefinition = { title: string; key: keyof SearchFilters; options: readonly string[] };

const sections: SectionDefinition[] = [
  { title: "Job type", key: "employmentType", options: employmentFilters },
  { title: "Category", key: "category", options: [] },
  { title: "Workplace", key: "arrangement", options: arrangementFilters },
  { title: "Experience", key: "experience", options: experienceFilters },
  { title: "Date posted", key: "posted", options: postedFilters },
];

type FilterDrawerProps = {
  visible: boolean;
  draft: SearchFilters;
  categoryOptions: string[];
  onChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
};

export function FilterDrawer({ visible, draft, categoryOptions, onChange, onClose, onClear, onApply }: FilterDrawerProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const renderedRef = useRef(visible);
  const [sheetY] = useState(() => new Animated.Value(560));
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [drawVisible, setDrawVisible] = useState(false);
  const [drawPolygon, setDrawPolygon] = useState<MapCoordinate[]>([]);

  const openDraw = () => {
    haptic.light();
    setDrawPolygon(draft.polygon ?? []);
    setDrawVisible(true);
  };
  const confirmDraw = () => {
    haptic.light();
    if (isValidPolygon(drawPolygon)) {
      onChange("polygon", drawPolygon);
      onChange("polygonLabel", `Drawn area (${drawPolygon.length} points)`);
    } else {
      onChange("polygon", undefined);
      onChange("polygonLabel", undefined);
    }
    setDrawVisible(false);
  };

  useEffect(() => {
    if (visible) {
      renderedRef.current = true;
      sheetY.setValue(560);
      overlayOpacity.setValue(0);
      requestAnimationFrame(() => {
        setRendered(true);
        Animated.parallel([
          Animated.timing(sheetY, { duration: 280, easing: Easing.out(Easing.cubic), toValue: 0, useNativeDriver: true }),
          Animated.timing(overlayOpacity, { duration: 220, easing: Easing.out(Easing.quad), toValue: 1, useNativeDriver: true }),
        ]).start();
      });
    } else if (renderedRef.current) {
      Animated.parallel([
        Animated.timing(sheetY, { duration: 220, easing: Easing.in(Easing.cubic), toValue: 560, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { duration: 180, easing: Easing.in(Easing.quad), toValue: 0, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          renderedRef.current = false;
          setRendered(false);
        }
      });
    }
  }, [overlayOpacity, sheetY, visible]);

  if (!rendered) return null;

  const handleClear = () => { haptic.selection(); onClear(); };
  const handleApply = () => { haptic.light(); onApply(); };

  return (
    <>
    <Modal animationType="none" onRequestClose={onClose} transparent visible={rendered}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.dismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8, transform: [{ translateY: sheetY }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={18} color="#17201A" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title="Location">
            <TextInput accessibilityLabel="Filter by location" onChangeText={(value) => onChange("location", value)} placeholder="City or area" placeholderTextColor="#94A098" style={styles.input} value={draft.location} />
            <Pressable accessibilityRole="button" accessibilityState={{ selected: isValidPolygon(draft.polygon) }} accessibilityLabel="Draw area on map" onPress={openDraw} style={({ pressed }) => [styles.drawButton, isValidPolygon(draft.polygon) && styles.drawButtonActive, pressed && styles.pressed]}>
              <IconSymbol name="mappin.and.ellipse" size={15} color={isValidPolygon(draft.polygon) ? "#16803C" : "#17201A"} />
              <Text style={isValidPolygon(draft.polygon) ? styles.drawButtonTextActive : styles.drawButtonText}>{isValidPolygon(draft.polygon) ? `Drawn area (${draft.polygon!.length} points)` : "Draw area on map"}</Text>
            </Pressable>
          </Section>
          <Section title="Salary range">
            <View style={styles.salaryRow}>
              <TextInput accessibilityLabel="Minimum salary" keyboardType="numeric" onChangeText={(value) => onChange("salaryMin", value)} placeholder="Minimum" placeholderTextColor="#94A098" style={[styles.input, styles.halfField]} value={draft.salaryMin} />
              <TextInput accessibilityLabel="Maximum salary" keyboardType="numeric" onChangeText={(value) => onChange("salaryMax", value)} placeholder="Maximum" placeholderTextColor="#94A098" style={[styles.input, styles.halfField]} value={draft.salaryMax} />
            </View>
          </Section>
          {sections.map((section) => (
            <Section key={section.key} title={section.title}>
              <OptionRow options={section.key === "category" ? ["All", ...categoryOptions.filter((c) => c !== "All")] : section.options} value={String(draft[section.key])} onSelect={(value) => onChange(section.key, value as never)} />
            </Section>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <ScalePressable accessibilityLabel="Clear all filters" hapticFeedback onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear all</Text>
          </ScalePressable>
          <ScalePressable accessibilityLabel="Show matching jobs" hapticFeedback onPress={handleApply} style={styles.applyButton}>
            <Text style={styles.applyText}>Show jobs</Text>
          </ScalePressable>
        </View>
      </Animated.View>
    </Modal>
    <Modal animationType="slide" onRequestClose={() => setDrawVisible(false)} transparent={false} visible={drawVisible}>
      <View style={styles.drawScreen}>
        <View style={[styles.drawHeader, { paddingTop: Math.max(insets.top, 8) }]}>
          <Text style={styles.drawTitle}>Draw area</Text>
          <Pressable accessibilityLabel="Close drawing" onPress={() => setDrawVisible(false)} style={styles.closeButton}>
            <IconSymbol name="xmark" size={18} color="#17201A" />
          </Pressable>
        </View>
        <Text style={styles.drawHint}>Tap the map to drop points, then choose Done to filter jobs inside this area.</Text>
        <View style={styles.drawMap}>
          <PolygonDrawMap
            polygon={drawPolygon}
            onAddPoint={(point) => setDrawPolygon((current) => [...current, point])}
            onRemoveLastPoint={() => setDrawPolygon((current) => current.slice(0, -1))}
            onClear={() => setDrawPolygon([])}
          />
        </View>
        <View style={[styles.drawFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ScalePressable accessibilityLabel="Cancel drawing" hapticFeedback onPress={() => setDrawVisible(false)} style={styles.clearButton}>
            <Text style={styles.clearText}>Cancel</Text>
          </ScalePressable>
          <ScalePressable accessibilityLabel="Use this area" hapticFeedback onPress={confirmDraw} style={styles.applyButton}>
            <Text style={styles.applyText}>Done</Text>
          </ScalePressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function OptionRow({ options, value, onSelect }: { options: readonly string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${option}${active ? " (selected)" : ""}`} onPress={() => { haptic.selection(); onSelect(option); }} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
            <Text style={active ? styles.optionTextActive : styles.optionText}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { defaultSearchFilters };

const styles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(15, 23, 17, 0.45)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  dismiss: { flex: 1 },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, bottom: 0, left: 0, maxHeight: "92%", position: "absolute", right: 0 },
  handle: { alignSelf: "center", backgroundColor: "#E2E8E5", borderRadius: 2.5, height: 5, marginTop: 8, width: 38 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  title: { color: "#17201A", fontSize: 17, fontWeight: "700" },
  closeButton: { alignItems: "center", backgroundColor: "#F1F4F1", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  content: { paddingBottom: 16, paddingHorizontal: 20 },
  section: { borderTopColor: "#EEF2EF", borderTopWidth: 1, paddingVertical: 14 },
  sectionTitle: { color: "#17201A", fontSize: 13, fontWeight: "700", marginBottom: 10 },
  input: { backgroundColor: "#F4F7F4", borderColor: "#E2E8E5", borderRadius: 12, borderWidth: 1, color: "#17201A", fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  salaryRow: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  optionActive: { backgroundColor: "#EAF6EC", borderColor: "#16803C" },
  optionText: { color: "#17201A", fontSize: 12, fontWeight: "500" },
  optionTextActive: { color: "#16803C", fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  footer: { alignItems: "center", borderTopColor: "#EEF2EF", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  clearButton: { alignItems: "center", borderColor: "#E2E8E5", borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  clearText: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  applyButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, flex: 1, paddingVertical: 13 },
  applyText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  drawButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 10, paddingHorizontal: 14, paddingVertical: 11 },
  drawButtonActive: { backgroundColor: "#EAF6EC", borderColor: "#16803C" },
  drawButtonText: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  drawButtonTextActive: { color: "#16803C", fontSize: 13, fontWeight: "700" },
  drawScreen: { backgroundColor: "#FFFFFF", flex: 1 },
  drawHeader: { alignItems: "center", borderBottomColor: "#EEF2EF", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 12, paddingHorizontal: 20 },
  drawTitle: { color: "#17201A", fontSize: 17, fontWeight: "700" },
  drawHint: { color: "#66736A", fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingTop: 10 },
  drawMap: { flex: 1, marginTop: 10 },
  drawFooter: { alignItems: "center", borderTopColor: "#EEF2EF", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
});