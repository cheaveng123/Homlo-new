import { useMemo, useState } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import MapView, { Circle, UrlTile, type MapPressEvent } from "react-native-maps";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type Marker = { id: string; coordinate: MapCoordinate; label: string; selected?: boolean };

type SearchResultsMapProps = {
  center: MapCoordinate;
  zoom: number;
  radiusKm: number;
  markers: Marker[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  onMapClick?: (coordinate: MapCoordinate) => void;
};

const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const primaryColor = "#16803C";

export function SearchResultsMap({ center, zoom, radiusKm, markers, selectedId, onSelectMarker, onMapClick }: SearchResultsMapProps) {
  const [ready, setReady] = useState(false);
  const latitudeDelta = useMemo(() => Math.max(0.05, Math.min(0.6, radiusKm / 65)), [radiusKm]);
  const longitudeDelta = useMemo(() => Math.max(0.05, Math.min(0.6, radiusKm / 58)), [radiusKm]);

  return (
    <View style={styles.container}>
      <MapView
        mapType="none"
        onMapReady={() => setReady(true)}
        onPress={(event: MapPressEvent) => onMapClick?.(event.nativeEvent.coordinate)}
        region={{ latitude: center.latitude, latitudeDelta, longitude: center.longitude, longitudeDelta }}
        rotateEnabled={false}
        scrollEnabled
        showsCompass
        style={styles.map}
        zoomEnabled
      >
        <UrlTile maximumZ={19} minimumZ={2} shouldReplaceMapContent urlTemplate={tileUrl} />
        <Circle center={center} fillColor="rgba(22,128,60,0.10)" radius={radiusKm * 1000} strokeColor="rgba(22,128,60,0.45)" strokeWidth={1.5} />
      </MapView>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {ready ? markers.map((marker) => (
          <MarkerOverlay
            key={marker.id}
            label={marker.label}
            latitudeDelta={latitudeDelta}
            longitudeDelta={longitudeDelta}
            marker={marker}
            origin={center}
            selected={selectedId === marker.id}
            onPress={() => onSelectMarker?.(marker.id)}
          />
        )) : null}
      </View>
    </View>
  );
}

function MarkerOverlay({ marker, origin, latitudeDelta, longitudeDelta, label, selected, onPress }: { marker: Marker; origin: MapCoordinate; latitudeDelta: number; longitudeDelta: number; label: string; selected?: boolean; onPress?: () => void }) {
  const { x, y } = project(marker.coordinate, origin, latitudeDelta, longitudeDelta);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <View style={[styles.markerWrap, { left: `${x}%`, top: `${y}%` }]} onTouchEnd={(event) => { event.stopPropagation(); onPress?.(); }}>
      <View style={[styles.marker, selected ? styles.markerSelected : null]}>
        <RNText numberOfLines={1} style={selected ? styles.markerTextSelected : styles.markerText}>{label}</RNText>
      </View>
    </View>
  );
}

function project(coord: MapCoordinate, origin: MapCoordinate, latitudeDelta: number, longitudeDelta: number) {
  const dx = (coord.longitude - origin.longitude) / longitudeDelta;
  const dy = (origin.latitude - coord.latitude) / latitudeDelta;
  return { x: 50 + dx * 50, y: 50 + dy * 50 };
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  map: { flex: 1 },
  markerWrap: { alignItems: "center", position: "absolute", transform: [{ translateX: -50 }, { translateY: -14 }] },
  marker: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: primaryColor, borderRadius: 999, borderWidth: 1.5, maxWidth: 110, paddingHorizontal: 9, paddingVertical: 5, shadowColor: "#173C25", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  markerSelected: { backgroundColor: primaryColor, borderColor: primaryColor, transform: [{ scale: 1.08 }] },
  markerText: { color: primaryColor, fontSize: 11, fontWeight: "700" },
  markerTextSelected: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
});