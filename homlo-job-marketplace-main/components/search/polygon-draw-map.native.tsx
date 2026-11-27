import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon, UrlTile, type MapPressEvent } from "react-native-maps";

import { MAP_MAX_TILE_ZOOM, MAP_TILE_URL } from "@/lib/map-config";
import { MapAttribution } from "@/components/maps/map-attribution";
import { useUserLocation } from "@/lib/use-user-location";

import type { PolygonDrawMapProps } from "./polygon-draw-map";

const openStreetMapTiles = MAP_TILE_URL;

export function PolygonDrawMap({ center = { latitude: 11.5564, longitude: 104.9282 }, polygon, onAddPoint }: PolygonDrawMapProps) {
  const { location } = useUserLocation({ requestOnMount: true });
  const showShape = polygon.length >= 2;
  const closed = polygon.length >= 3;
  const mapCenter = location ?? center;
  const region = {
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
    latitudeDelta: 0.12,
    longitudeDelta: 0.1,
  };

  return (
    <View style={styles.container}>
      <MapView showsUserLocation
        mapType="none"
        onPress={(event: MapPressEvent) => onAddPoint(event.nativeEvent.coordinate)}
        region={region}
        rotateEnabled={false}
        scrollEnabled
        showsCompass={false}
        style={styles.map}
        zoomEnabled
        showsMyLocationButton
      >
        <UrlTile maximumZ={MAP_MAX_TILE_ZOOM} minimumZ={2} shouldReplaceMapContent urlTemplate={openStreetMapTiles} />
        {showShape ? (
          <Polygon coordinates={polygon} fillColor="rgba(22,128,60,0.18)" strokeColor="#0891B2" strokeWidth={2} />
        ) : null}
        {polygon.map((point, index) => (
          <Marker key={`${index}-${point.latitude}-${point.longitude}`} anchor={{ x: 0.5, y: 0.5 }} coordinate={point} tracksViewChanges={false}>
            <View style={[styles.vertexDot, index === 0 && styles.vertexDotStart]}>
              <View style={styles.vertexDotCore} />
            </View>
          </Marker>
        ))}
        {closed ? <Polygon coordinates={[polygon[0], polygon[polygon.length - 1]]} strokeColor="#0891B2" strokeWidth={2} /> : null}
      </MapView>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  vertexDot: { alignItems: "center", backgroundColor: "#0891B2", borderColor: "#FFFFFF", borderRadius: 9, borderWidth: 2.5, height: 18, justifyContent: "center", width: 18 },
  vertexDotStart: { backgroundColor: "#14324A" },
  vertexDotCore: { backgroundColor: "#FFFFFF", borderRadius: 3, height: 6, width: 6 },
});
