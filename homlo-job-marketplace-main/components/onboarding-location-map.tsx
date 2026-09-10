import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";

const PHNOM_PENH = { latitude: 11.5564, longitude: 104.9282 };
const iframeStyle = { border: 0, height: "100%", width: "100%" } as never;

export function OnboardingLocationMap({ location, onSelect }: { location: string; onSelect: (label: string) => void }) {
  const [zoom, setZoom] = useState(13);
  const label = location.trim() || "Phnom Penh";
  const delta = zoom >= 14 ? 0.06 : 0.12;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${PHNOM_PENH.longitude - delta}%2C${PHNOM_PENH.latitude - delta}%2C${PHNOM_PENH.longitude + delta}%2C${PHNOM_PENH.latitude + delta}&layer=mapnik&marker=${PHNOM_PENH.latitude}%2C${PHNOM_PENH.longitude}`;

  if (Platform.OS !== "web") return null;
  return <View style={styles.card}><iframe title="Choose your job search area" src={mapUrl} style={iframeStyle} /><View pointerEvents="none" style={styles.mapLabel}><Text style={styles.mapTitle}>{label}</Text><Text style={styles.mapCaption}>Pan or zoom, then confirm this area</Text></View><View style={styles.controls}><Pressable accessibilityLabel="Zoom out" onPress={() => setZoom((value) => Math.max(11, value - 1))} style={styles.control}><Text style={styles.controlText}>−</Text></Pressable><Pressable accessibilityLabel="Zoom in" onPress={() => setZoom((value) => Math.min(16, value + 1))} style={styles.control}><Text style={styles.controlText}>+</Text></Pressable></View><Pressable accessibilityRole="button" onPress={() => onSelect(label)} style={styles.confirm}><IconSymbol name="location" size={16} color="#FFFFFF" /><Text style={styles.confirmText}>Use this area</Text></Pressable></View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#E4F0E7", borderRadius: 16, height: 300, marginTop: 16, overflow: "hidden", position: "relative" }, mapLabel: { backgroundColor: "#FFFFFF", borderRadius: 10, bottom: 56, left: 12, paddingHorizontal: 12, paddingVertical: 8, position: "absolute" }, mapTitle: { color: "#17201A", fontSize: 12, fontWeight: "800" }, mapCaption: { color: "#66736A", fontSize: 10, marginTop: 2 }, controls: { backgroundColor: "#FFFFFF", borderRadius: 10, overflow: "hidden", position: "absolute", right: 12, top: 12 }, control: { alignItems: "center", borderBottomColor: "#E2E8E5", borderBottomWidth: 1, height: 36, justifyContent: "center", width: 36 }, controlText: { color: "#17201A", fontSize: 22, lineHeight: 24 }, confirm: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#16803C", borderRadius: 10, bottom: 12, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 9, position: "absolute", right: 12 }, confirmText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" } });
