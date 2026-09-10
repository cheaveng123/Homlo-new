import { Pressable, StyleSheet, Text, View } from "react-native";

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

export function GuidedLocationMap({ coordinate, onSelect, radiusKm }: GuidedLocationMapProps) {
  const nearest = coordinate ? cities.reduce((closest, city) => ((city.latitude - coordinate.latitude) ** 2 + (city.longitude - coordinate.longitude) ** 2) < ((closest.latitude - coordinate.latitude) ** 2 + (closest.longitude - coordinate.longitude) ** 2) ? city : closest) : null;
  return <View style={styles.map}><View style={styles.routeOne} /><View style={styles.routeTwo} /><View style={styles.lake} />{nearest ? <View style={[styles.radius, { left: nearest.left, top: nearest.top, width: Math.min(126, 40 + radiusKm * 2), height: Math.min(126, 40 + radiusKm * 2), borderRadius: Math.min(63, 20 + radiusKm) }]} /> : null}{cities.map((city) => <Pressable key={city.city} onPress={() => onSelect(city)} style={[styles.pin, { left: city.left, top: city.top }, nearest?.city === city.city && styles.pinSelected]}><View style={[styles.pinDot, nearest?.city === city.city && styles.pinDotSelected]} /><Text style={[styles.pinText, nearest?.city === city.city && styles.pinTextSelected]}>{city.city}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({ map: { flex: 1, position: "relative" }, routeOne: { backgroundColor: "#BFDAD3", height: 3, left: -10, position: "absolute", top: "52%", transform: [{ rotate: "-17deg" }], width: "125%" }, routeTwo: { backgroundColor: "#C7E0DA", height: 3, left: "28%", position: "absolute", top: -20, transform: [{ rotate: "28deg" }], width: 3 }, lake: { backgroundColor: "#D6EEE8", borderRadius: 90, bottom: -45, height: 170, position: "absolute", right: -25, width: 160 }, radius: { backgroundColor: "rgba(8,103,95,0.12)", borderColor: "rgba(8,103,95,0.55)", borderWidth: 2, position: "absolute", transform: [{ translateX: -50 }, { translateY: -50 }] }, pin: { alignItems: "center", flexDirection: "row", gap: 4, position: "absolute" }, pinSelected: { backgroundColor: "#FFFFFF", borderRadius: 13, paddingHorizontal: 6, paddingVertical: 4, shadowColor: "#143D36", shadowOpacity: 0.12, shadowRadius: 5 }, pinDot: { backgroundColor: "#6D8C84", borderColor: "#FFFFFF", borderRadius: 7, borderWidth: 2, height: 14, width: 14 }, pinDotSelected: { backgroundColor: "#08675F" }, pinText: { color: "#526861", fontSize: 10.5, fontWeight: "600" }, pinTextSelected: { color: "#08675F" } });
