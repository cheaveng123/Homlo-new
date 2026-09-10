import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from "react-native-maps";
import { StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";

const PHNOM_PENH = { latitude: 11.5564, longitude: 104.9282 };

export function OnboardingLocationMap({ location, onSelect }: { location: string; onSelect: (label: string) => void }) {
  const selectPoint = (_event: MapPressEvent) => onSelect(location.trim() || "Phnom Penh");
  const selectRegion = (_region: Region) => undefined;

  return <View style={styles.card}><MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ ...PHNOM_PENH, latitudeDelta: 0.12, longitudeDelta: 0.12 }} onPress={selectPoint} onRegionChangeComplete={selectRegion} showsCompass showsScale><Marker coordinate={PHNOM_PENH} title={location || "Phnom Penh"} description="Tap the map to choose this area"><View style={styles.pin}><IconSymbol name="location" size={20} color="#FFFFFF" /></View></Marker></MapView><View pointerEvents="none" style={styles.mapLabel}><Text style={styles.mapTitle}>{location || "Phnom Penh"}</Text><Text style={styles.mapCaption}>Tap the map to select this area</Text></View></View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#E4F0E7", borderRadius: 16, height: 270, marginTop: 16, overflow: "hidden", position: "relative" }, map: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, pin: { alignItems: "center", backgroundColor: "#22A447", borderColor: "#FFFFFF", borderRadius: 23, borderWidth: 3, height: 46, justifyContent: "center", width: 46 }, mapLabel: { backgroundColor: "#FFFFFF", borderRadius: 10, bottom: 12, left: 12, paddingHorizontal: 12, paddingVertical: 8, position: "absolute" }, mapTitle: { color: "#17201A", fontSize: 12, fontWeight: "800" }, mapCaption: { color: "#66736A", fontSize: 10, marginTop: 2 } });
