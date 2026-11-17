import { useMemo, useState } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import MapView, { Circle, Marker, UrlTile, type MapPressEvent } from "react-native-maps";

import { MAP_ATTRIBUTION, MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from "@/lib/map-config";
import { useUserLocation } from "@/lib/use-user-location";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type MarkerData = { id: string; coordinate: MapCoordinate; label: string; selected?: boolean };

type SearchResultsMapProps = {
  center: MapCoordinate;
  zoom: number;
  radiusKm: number;
  markers: MarkerData[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  onMapClick?: (coordinate: MapCoordinate) => void;
};

const tileUrl = MAP_TILE_URL;
const primaryColor = "#0891B2";

function isValidCoordinate(coordinate: MapCoordinate | null | undefined): coordinate is MapCoordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function SearchResultsMap({ center, zoom, radiusKm, markers, selectedId, onSelectMarker, onMapClick }: SearchResultsMapProps) {
  const [ready, setReady] = useState(false);
  const { location } = useUserLocation({ requestOnMount: true });
  const mapCenter = location ?? center;
  const latitudeDelta = useMemo(() => Math.max(0.05, Math.min(0.6, radiusKm / 65)), [radiusKm]);
  const longitudeDelta = useMemo(() => Math.max(0.05, Math.min(0.6, radiusKm / 58)), [radiusKm]);
  const validMarkers = useMemo(() => markers.filter((marker) => isValidCoordinate(marker.coordinate)), [markers]);

  return (
    <View style={styles.container}>
      <MapView
        showsUserLocation
        mapType="none"
        onMapReady={() => setReady(true)}
        onPress={(event: MapPressEvent) => onMapClick?.(event.nativeEvent.coordinate)}
        region={{ latitude: mapCenter.latitude, latitudeDelta, longitude: mapCenter.longitude, longitudeDelta }}
        rotateEnabled={false}
        scrollEnabled
        showsCompass
        style={styles.map}
        showsMyLocationButton
        zoomEnabled
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={tileUrl} />
        <Circle center={center} fillColor="rgba(22,128,60,0.10)" radius={radiusKm * 1000} strokeColor="rgba(22,128,60,0.45)" strokeWidth={1.5} />
        {ready && validMarkers.map((marker) => {
          const selected = selectedId === marker.id;
          return (
            <Marker
              key={`${marker.id}-${selected ? "on" : "off"}`}
              coordinate={marker.coordinate}
              onPress={() => onSelectMarker?.(marker.id)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={selected ? 10 : 1}
            >
              <View style={[styles.marker, selected ? styles.markerSelected : null]}>
                <RNText numberOfLines={1} style={selected ? styles.markerTextSelected : styles.markerText}>
                  {marker.label}
                </RNText>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <RNText pointerEvents="none" style={styles.attribution}>
        {MAP_ATTRIBUTION}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  map: { flex: 1 },
  marker: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: primaryColor, borderRadius: 999, borderWidth: 1.5, maxWidth: 110, paddingHorizontal: 9, paddingVertical: 5, shadowColor: "#173C25", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  markerSelected: { backgroundColor: primaryColor, borderColor: primaryColor, transform: [{ scale: 1.08 }] },
  markerText: { color: primaryColor, fontSize: 11, fontWeight: "700" },
  markerTextSelected: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  attribution: { position: "absolute", right: 5, bottom: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.82)", fontSize: 9, color: "#5F7A6E" },
});
