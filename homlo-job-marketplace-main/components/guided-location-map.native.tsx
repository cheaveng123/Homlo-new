import { StyleSheet } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";

export type GuidedLocationMapProps = {
  coordinate: { latitude: number; longitude: number } | null;
  radiusKm: number;
  onSelect: (value: { latitude: number; longitude: number }) => void;
};

const cities = [
  { city: "Phnom Penh", latitude: 11.5564, longitude: 104.9282 },
  { city: "Siem Reap", latitude: 13.3633, longitude: 103.8564 },
  { city: "Battambang", latitude: 13.0957, longitude: 103.2022 },
  { city: "Sihanoukville", latitude: 10.6253, longitude: 103.523 },
  { city: "Kampong Cham", latitude: 12.046, longitude: 105.444 },
];

export function GuidedLocationMap({ coordinate, onSelect, radiusKm }: GuidedLocationMapProps) {
  return <MapView initialRegion={{ latitude: 12.1, longitude: 104.45, latitudeDelta: 4.5, longitudeDelta: 3.8 }} onPress={(event) => onSelect(event.nativeEvent.coordinate)} style={styles.map}>{cities.map((city) => <Marker coordinate={{ latitude: city.latitude, longitude: city.longitude }} key={city.city} onPress={() => onSelect(city)} title={city.city} />)}{coordinate ? <Circle center={coordinate} fillColor="rgba(8,103,95,0.14)" radius={radiusKm * 1000} strokeColor="rgba(8,103,95,0.72)" strokeWidth={2} /> : null}</MapView>;
}

const styles = StyleSheet.create({ map: { height: "100%", width: "100%" } });
