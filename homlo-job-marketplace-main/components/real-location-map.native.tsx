import { StyleSheet } from "react-native";
import MapView, { Circle, UrlTile, type MapPressEvent } from "react-native-maps";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type RealLocationMapProps = {
  coordinate: MapCoordinate;
  radiusKm: number;
  onSelect: (coordinate: MapCoordinate) => void;
};

const openStreetMapTiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function RealLocationMap({ coordinate, radiusKm, onSelect }: RealLocationMapProps) {
  const latitudeDelta = Math.max(0.12, radiusKm / 55);
  const longitudeDelta = Math.max(0.12, radiusKm / 48);
  return (
    <MapView
      mapType="none"
      onPress={(event: MapPressEvent) => onSelect(event.nativeEvent.coordinate)}
      region={{ latitude: coordinate.latitude, longitude: coordinate.longitude, latitudeDelta, longitudeDelta }}
      rotateEnabled={false}
      scrollEnabled
      showsCompass
      style={styles.map}
      zoomEnabled
    >
      <UrlTile maximumZ={19} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
      <Circle center={coordinate} fillColor="rgba(8,103,95,0.16)" radius={radiusKm * 1000} strokeColor="rgba(8,103,95,0.78)" strokeWidth={2} />
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
