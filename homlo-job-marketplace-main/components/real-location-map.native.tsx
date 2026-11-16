import { StyleSheet, View, Pressable } from "react-native";
import MapView, { Marker, Circle, UrlTile, type MapPressEvent } from "react-native-maps";

import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from "@/lib/map-config";
import { MapAttribution } from "@/components/maps/map-attribution";
import { useUserLocation } from "@/lib/use-user-location";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { AppIcon } from "@/components/ui/AppIcon";
import { useState } from "react";

type RealLocationMapProps = {
  coordinate: MapCoordinate;
  radiusKm: number;
  onSelect: (coordinate: MapCoordinate) => void;
};

const openStreetMapTiles = MAP_TILE_URL;

// GPS component edit verification
export function RealLocationMap({ coordinate, radiusKm, onSelect }: RealLocationMapProps) {
  const { location } = useUserLocation({ requestOnMount: true });
  const latitudeDelta = Math.max(0.12, radiusKm / 55);
  const longitudeDelta = Math.max(0.12, radiusKm / 48);
  const center = location ?? coordinate;
  return (
    <View style={styles.container}>
      <MapView
        mapType="none"
        onPress={(event: MapPressEvent) => onSelect(event.nativeEvent.coordinate)}
        region={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta, longitudeDelta }}
        rotateEnabled={false}
        scrollEnabled
        showsCompass
        style={styles.map}
        showsMyLocationButton
        zoomEnabled
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
        <Circle center={coordinate} fillColor="rgba(8,103,95,0.16)" radius={radiusKm * 1000} strokeColor="rgba(8,103,95,0.78)" strokeWidth={2} />
        {location && (
          <Marker coordinate={location}>
            <View style={styles.gpsDot} />
          </Marker>
        )}
      </MapView>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, map: { flex: 1 }, gpsDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#007AFF" } });
