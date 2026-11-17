import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, UrlTile, type MapPressEvent } from "react-native-maps";

import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from "@/lib/map-config";
import { MapAttribution } from "@/components/maps/map-attribution";
import { useUserLocation } from "@/lib/use-user-location";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type JobLocationMapProps = {
  coordinate: MapCoordinate | null;
  defaultCoordinate: MapCoordinate;
  onChange: (coordinate: MapCoordinate) => void;
};

const openStreetMapTiles = MAP_TILE_URL;

export function JobLocationMap({ coordinate, defaultCoordinate, onChange }: JobLocationMapProps) {
  const { location, permissionStatus, requestPermission } = useUserLocation({ requestOnMount: true });
  const mapRef = useRef<MapView | null>(null);
  const center = location ?? coordinate ?? defaultCoordinate;

  const jobLat = coordinate?.latitude;
  const jobLng = coordinate?.longitude;
  const userLat = location?.latitude;
  const userLng = location?.longitude;

  const fitUserAndJob = useCallback(() => {
    if (jobLat == null || jobLng == null || userLat == null || userLng == null) return;
    mapRef.current?.fitToCoordinates(
      [{ latitude: jobLat, longitude: jobLng }, { latitude: userLat, longitude: userLng }],
      { animated: true, edgePadding: { top: 72, right: 56, bottom: 72, left: 56 } },
    );
  }, [jobLat, jobLng, userLat, userLng]);

  const centerOnUser = useCallback(() => {
    if (!location) {
      void requestPermission();
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      350,
    );
  }, [location, requestPermission]);

  useEffect(() => {
    fitUserAndJob();
  }, [fitUserAndJob]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        showsUserLocation
        onMapReady={fitUserAndJob}
        mapType="none"
        onPress={(event: MapPressEvent) => onChange(event.nativeEvent.coordinate)}
        region={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        rotateEnabled={false}
        scrollEnabled
        showsCompass
        style={styles.map}
        showsMyLocationButton
        zoomEnabled
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
        {coordinate ? (
          <Marker anchor={{ x: 0.5, y: 1 }} coordinate={coordinate} pinColor="#C0392B" />
        ) : null}
      </MapView>
      <MapAttribution />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={location ? "Center map on your location" : "Show my current location"}
        onPress={centerOnUser}
        style={styles.locationBadge}
      >
        <View style={[styles.badgeDot, !location && styles.badgeDotPending]} />
        <Text style={styles.badgeText}>
          {location ? "Center on me" : permissionStatus === "denied" ? "Turn on location" : "Locating you…"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  locationBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    top: 10,
  },
  badgeDot: { backgroundColor: "#007AFF", borderRadius: 4, height: 8, width: 8 },
  badgeDotPending: { backgroundColor: "#C0392B" },
  badgeText: { color: "#12303C", fontSize: 11, fontWeight: "700" },
  userHalo: {
    alignItems: "center",
    backgroundColor: "rgba(0,122,255,0.22)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  userDot: {
    backgroundColor: "#007AFF",
    borderColor: "#FFFFFF",
    borderRadius: 7,
    borderWidth: 3,
    height: 14,
    width: 14,
  },
});
