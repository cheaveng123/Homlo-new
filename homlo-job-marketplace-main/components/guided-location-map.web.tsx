import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { useUserLocation } from "@/lib/use-user-location";

export type GuidedLocationMapProps = {
  coordinate: { latitude: number; longitude: number } | null;
  radiusKm: number;
  onSelect: (value: { latitude: number; longitude: number }) => void;
};

const cities = [
  { city: "Phnom Penh", latitude: 11.5564, longitude: 104.9282, left: "52%", top: "52%" },
  { city: "Siem Reap", latitude: 13.3633, longitude: 103.8564, left: "29%", top: "22%" },
  { city: "Battambang", latitude: 13.0957, longitude: 103.2022, left: "14%", top: "43%" },
  { city: "Sihanoukville", latitude: 10.6253, longitude: 103.523, left: "26%", top: "77%" },
  { city: "Kampong Cham", latitude: 12.046, longitude: 105.444, left: "73%", top: "42%" },
] as const;

function projectToPercent(coordinate: { latitude: number; longitude: number }) {
  const left = Math.max(0, Math.min(100, ((coordinate.longitude - 102.3) / 5.3) * 100));
  const top = Math.max(0, Math.min(100, ((14.7 - coordinate.latitude) / 4.3) * 100));
  return { left: `${left}%` as `${number}%`, top: `${top}%` as `${number}%` };
}

export function GuidedLocationMap({ coordinate, onSelect, radiusKm }: GuidedLocationMapProps) {
  const { location, requestPermission } = useUserLocation({ requestOnMount: true });
  const nearest = coordinate ? cities.reduce((closest, city) => ((city.latitude - coordinate.latitude) ** 2 + (city.longitude - coordinate.longitude) ** 2) < ((closest.latitude - coordinate.latitude) ** 2 + (closest.longitude - coordinate.longitude) ** 2) ? city : closest) : null;
  return <View style={styles.map}><View style={styles.routeOne} /><View style={styles.routeTwo} /><View style={styles.lake} />{nearest ? <View style={[styles.radius, { left: nearest.left, top: nearest.top, width: Math.min(126, 40 + radiusKm * 2), height: Math.min(126, 40 + radiusKm * 2), borderRadius: Math.min(63, 20 + radiusKm) }]} /> : null}{cities.map((city) => <Pressable key={city.city} onPress={() => onSelect(city)} style={[styles.pin, { left: city.left, top: city.top }, nearest?.city === city.city && styles.pinSelected]}><View style={[styles.pinDot, nearest?.city === city.city && styles.pinDotSelected]} /><Text style={[styles.pinText, nearest?.city === city.city && styles.pinTextSelected]}>{city.city}</Text></Pressable>)}{location ? <View pointerEvents="none" style={[styles.userHalo, projectToPercent(location)]}><View style={styles.userDot} /></View> : null}<Pressable accessibilityLabel="Show my current location" onPress={() => void requestPermission()} style={styles.locate}><AppIcon name="locate" size={16} color="#14324A" /></Pressable></View>;
}

const styles = StyleSheet.create({ map: { flex: 1, position: "relative" }, routeOne: { backgroundColor: "#DCE6EA", height: 3, left: -10, position: "absolute", top: "52%", transform: [{ rotate: "-17deg" }], width: "125%" }, routeTwo: { backgroundColor: "#DCE6EA", height: 3, left: "28%", position: "absolute", top: -20, transform: [{ rotate: "28deg" }], width: 3 }, lake: { backgroundColor: "#DCF1F6", borderRadius: 90, bottom: -45, height: 170, position: "absolute", right: -25, width: 160 }, radius: { backgroundColor: "rgba(11,111,138,0.12)", borderColor: "rgba(11,111,138,0.55)", borderWidth: 2, position: "absolute", transform: [{ translateX: -50 }, { translateY: -50 }] }, pin: { alignItems: "center", flexDirection: "row", gap: 4, position: "absolute" }, pinSelected: { backgroundColor: "#FFFFFF", borderRadius: 13, paddingHorizontal: 6, paddingVertical: 4, shadowColor: "#14324A", shadowOpacity: 0.12, shadowRadius: 5 }, pinDot: { backgroundColor: "#6A7C84", borderColor: "#FFFFFF", borderRadius: 7, borderWidth: 2, height: 14, width: 14 }, pinDotSelected: { backgroundColor: "#14324A" }, pinText: { color: "#5D7480", fontSize: 10.5, fontWeight: "600" }, pinTextSelected: { color: "#14324A" }, userHalo: { alignItems: "center", backgroundColor: "rgba(8,145,178,0.18)", borderColor: "rgba(8,145,178,0.4)", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", position: "absolute", transform: [{ translateX: -16 }, { translateY: -16 }], width: 32 }, userDot: { backgroundColor: "#0891B2", borderColor: "#FFFFFF", borderRadius: 7, borderWidth: 2, height: 14, width: 14 }, locate: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE6EA", borderRadius: 10, borderWidth: 1, height: 36, justifyContent: "center", left: 12, position: "absolute", top: 12, width: 36 } });
