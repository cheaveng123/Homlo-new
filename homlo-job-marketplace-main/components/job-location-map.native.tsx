import { StyleSheet } from "react-native";
import MapView, { Marker, UrlTile, type MapPressEvent } from "react-native-maps";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type JobLocationMapProps = {
  coordinate: MapCoordinate | null;
  defaultCoordinate: MapCoordinate;
  onChange: (coordinate: MapCoordinate) => void;
};

const openStreetMapTiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function JobLocationMap({ coordinate, defaultCoordinate, onChange }: JobLocationMapProps) {
  const center = coordinate ?? defaultCoordinate;
  return (
    <MapView
      mapType="none"
      onPress={(event: MapPressEvent) => onChange(event.nativeEvent.coordinate)}
      region={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      rotateEnabled={false}
      scrollEnabled
      showsCompass
      style={styles.map}
      zoomEnabled
    >
      <UrlTile maximumZ={19} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
      {coordinate ? (
        <Marker anchor={{ x: 0.5, y: 1 }} coordinate={coordinate} pinColor="#C0392B" />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });