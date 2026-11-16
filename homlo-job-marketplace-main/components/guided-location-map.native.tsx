import { StyleSheet } from "react-native";
import MapView, { Circle, Marker, UrlTile } from "react-native-maps";

import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from "@/lib/map-config";
import { MapAttribution } from "@/components/maps/map-attribution";
import { defaultSearchCenter } from "@/lib/job-geography";
import { useUserLocation } from "@/lib/use-user-location";

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
  const { location } = useUserLocation({ requestOnMount: true });
  const center = location ?? defaultSearchCenter;
  return (
    <MapView showsUserLocation
      mapType="none"
      initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
      onPress={(event) => onSelect(event.nativeEvent.coordinate)}
      showsMyLocationButton
      style={styles.map}
    >
      <UrlTile
        maximumZ={MAP_MAX_TILE_ZOOM}
        minimumZ={2}
        shouldReplaceMapContent
        urlTemplate={MAP_TILE_URL}
      />
      {cities.map((city) => (
        <Marker coordinate={{ latitude: city.latitude, longitude: city.longitude }} key={city.city} onPress={() => onSelect(city)} title={city.city} />
      ))}
      {location && <Marker coordinate={location} title="Your location" description="You are here" pinColor="#007AFF" />}
      {coordinate ? <Circle center={coordinate} fillColor="rgba(8,103,95,0.14)" radius={radiusKm * 1000} strokeColor="rgba(8,103,95,0.72)" strokeWidth={2} /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { height: "100%", width: "100%" } });
