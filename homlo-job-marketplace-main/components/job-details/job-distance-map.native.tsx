import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import { MAP_TILE_URL } from "@/lib/map-config";
import { colors } from "./colors";
import type { JobDistanceMapProps } from "./job-distance-map";
import { fonts } from "./typography";

const openStreetMapTiles = MAP_TILE_URL;
const mapPadding = { top: 40, right: 40, bottom: 40, left: 40 };

export function JobDistanceMap({
  userCoordinate,
  jobCoordinate,
  routeGeometry,
}: JobDistanceMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const userLatitude = userCoordinate.latitude;
  const userLongitude = userCoordinate.longitude;
  const jobLatitude = jobCoordinate.latitude;
  const jobLongitude = jobCoordinate.longitude;
  const coordinates =
    routeGeometry && routeGeometry.length > 1
      ? routeGeometry
      : [userCoordinate, jobCoordinate];
  const middleLatitude = (userLatitude + jobLatitude) / 2;
  const middleLongitude = (userLongitude + jobLongitude) / 2;
  const longitudeScale = Math.max(
    Math.cos((middleLatitude * Math.PI) / 180),
    0.01,
  );

  const fitPoints = useCallback(() => {
    mapRef.current?.fitToCoordinates(
      [
        { latitude: userLatitude, longitude: userLongitude },
        { latitude: jobLatitude, longitude: jobLongitude },
      ],
      {
        animated: false,
        edgePadding: mapPadding,
      },
    );
  }, [jobLatitude, jobLongitude, userLatitude, userLongitude]);
  useEffect(() => {
    fitPoints();
  }, [fitPoints]);

  return (
    <View style={styles.container}>
      <MapView showsUserLocation
        ref={mapRef}
        mapType="none"
        initialRegion={{
          latitude: middleLatitude,
          longitude: middleLongitude,
          latitudeDelta: Math.max(
            Math.abs(userLatitude - jobLatitude) * 1.6,
            0.01,
          ),
          longitudeDelta: Math.max(
            (Math.abs(userLongitude - jobLongitude) * 1.6) / longitudeScale,
            0.01,
          ),
        }}
        onLayout={fitPoints}
        onMapReady={fitPoints}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={true}
        toolbarEnabled={false}
        style={StyleSheet.absoluteFill}
      >
        <UrlTile
          maximumZ={19}
          minimumZ={2}
          shouldReplaceMapContent
          urlTemplate={openStreetMapTiles}
        />
        <Polyline
          coordinates={coordinates}
          strokeColor={colors.mintDark}
          strokeWidth={3}
        />
        <Marker
          coordinate={userCoordinate}
          title="Your location"
          description="Your current location"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={[styles.marker, { backgroundColor: colors.mint }]} />
        </Marker>
        <Marker
          coordinate={jobCoordinate}
          title="Job location"
          description="This job's location"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={[styles.marker, { backgroundColor: colors.mintDeep }]} />
        </Marker>
      </MapView>
      <Text pointerEvents="none" style={styles.attribution}>
        © OpenStreetMap
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.mintTint,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.background,
    shadowColor: colors.mintDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 3,
  },
  attribution: {
    position: "absolute",
    right: 5,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.82)",
    fontFamily: fonts.bodyRegular,
    fontSize: 9,
    color: colors.muted,
  },
});
