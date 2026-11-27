import MapView, { Marker, UrlTile, type MapPressEvent } from "react-native-maps";
import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";

import { MAP_TILE_URL, MAP_MAX_TILE_ZOOM } from "@/lib/map-config";
import { useUserLocation } from "@/lib/use-user-location";
import { AppIcon } from "@/components/ui/AppIcon";

const STYLES = {
  card: {
    backgroundColor: "#E6EDEF",
    borderRadius: 16,
    height: 270,
    marginTop: 16,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  map: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  pin: {
    alignItems: "center" as const,
    backgroundColor: "#0891B2",
    borderColor: "#FFFFFF",
    borderRadius: 23,
    borderWidth: 3,
    height: 46,
    justifyContent: "center" as const,
    width: 46,
  },
  mapLabel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute" as const,
  },
  mapTitle: {
    color: "#12303C",
    fontSize: 12,
    fontWeight: "800" as const,
  },
  mapCaption: {
    color: "#5D7480",
    fontSize: 10,
    marginTop: 2,
  },
  permissionCard: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    backgroundColor: "#E6EDEF",
    borderRadius: 16,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#14324A",
    textAlign: "center" as const,
    marginBottom: 12,
  },
  permissionBody: {
    fontSize: 15,
    color: "#5D7480",
    textAlign: "center" as const,
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#0B6F8A",
    borderRadius: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600" as const,
  },
};

export function OnboardingLocationMap({ location, onSelect }: { location: string; onSelect: (label: string) => void }) {
  const { location: userLocation, permissionStatus, requestPermission } = useUserLocation({ requestOnMount: true });
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const handlePermissionGranted = async () => {
    setShowPermissionDialog(false);
    await requestPermission();
  };

  const selectPoint = (_event: MapPressEvent) => {
    onSelect(location.trim() || "Phnom Penh");
  };

  const center = userLocation || { latitude: 11.5564, longitude: 104.9282 };
  const showMap = permissionStatus === "granted" && userLocation !== null;

  if (!showMap && permissionStatus !== "denied") {
    return (
      <View style={STYLES.permissionCard}>
        <Text style={STYLES.permissionTitle}>Allow location access</Text>
        <Text style={STYLES.permissionBody}>
          {permissionStatus === "undetermined"
            ? "To help you find nearby jobs, we need access to your current location."
            : permissionStatus === "granted" && userLocation === null
            ? "Unable to determine your location. Please check location services."
            : "Location permission required to continue."}
        </Text>
        <Pressable
          style={STYLES.permissionButton}
          onPress={handlePermissionGranted}
          accessibilityLabel="Allow location access"
        >
          <AppIcon name="locate" size={16} color="#FFFFFF" />
          <Text style={STYLES.permissionButtonText}>Allow location access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={STYLES.card}>
      <MapView
        mapType="none"
        style={STYLES.map}
        initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        onPress={selectPoint}
        showsCompass
        showsScale
        showsMyLocationButton
        showsUserLocation
      >
        <UrlTile
          maximumZ={MAP_MAX_TILE_ZOOM}
          minimumZ={2}
          shouldReplaceMapContent
          urlTemplate={MAP_TILE_URL}
        />
        {userLocation && (
          <Marker coordinate={userLocation} title="Your location" description="You are here" pinColor="#007AFF" />
        )}
        <Marker coordinate={{ latitude: 11.5564, longitude: 104.9282 }} title={location || "Phnom Penh"} description="Tap the map to choose this area">
          <View style={STYLES.pin}>
            <AppIcon name="locate" size={20} color="#FFFFFF" />
          </View>
        </Marker>
      </MapView>
      <View pointerEvents="none" style={STYLES.mapLabel}>
        <Text style={STYLES.mapTitle}>{location || "Phnom Penh"}</Text>
        <Text style={STYLES.mapCaption}>Tap the map to select this area</Text>
      </View>
      <Modal transparent visible={showPermissionDialog} animationType="fade">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", width: "80%" }}>
            <AppIcon name="pin" size={48} color="#0B6F8A" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" }}>Location Access Required</Text>
            <Text style={{ fontSize: 15, color: "#5D7480", textAlign: "center", marginBottom: 20 }}>
              We need your location to provide you with the best job recommendations. This helps us show you jobs near your actual location.
            </Text>
            <Pressable
              style={{ backgroundColor: "#0B6F8A", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center" }}
              onPress={handlePermissionGranted}
              accessibilityLabel="Allow location access"
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Allow Location Access</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
