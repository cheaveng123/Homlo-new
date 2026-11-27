import { useState } from "react";
import { Platform, Pressable, View, Modal } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Text } from "@/components/ui/text";
import { useUserLocation } from "@/lib/use-user-location";

const STYLES = {
  card: {
    backgroundColor: "#E6EDEF",
    borderRadius: 16,
    height: 300,
    marginTop: 16,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  locate: {
    alignItems: "center" as const,
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE6EA",
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center" as const,
    left: 12,
    position: "absolute" as const,
    top: 12,
    width: 36,
  },
  mapLabel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    bottom: 56,
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
  controls: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden" as const,
    position: "absolute" as const,
    right: 12,
    top: 12,
  },
  control: {
    alignItems: "center" as const,
    borderBottomColor: "#DCE6EA",
    borderBottomWidth: 1,
    height: 36,
    justifyContent: "center" as const,
    width: 36,
  },
  controlText: {
    color: "#12303C",
    fontSize: 22,
    lineHeight: 24,
  },
  confirm: {
    alignItems: "center" as const,
    alignSelf: "flex-end" as const,
    backgroundColor: "#0891B2",
    borderRadius: 10,
    bottom: 12,
    flexDirection: "row" as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: "absolute" as const,
    right: 12,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800" as const,
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

const PHNOM_PENH = { latitude: 11.5564, longitude: 104.9282 };
const iframeStyle = { border: 0, height: "100%", width: "100%" } as never;

export function OnboardingLocationMap({ location, onSelect }: { location: string; onSelect: (label: string) => void }) {
  const [zoom, setZoom] = useState(13);
  const { location: userLocation, requestPermission } = useUserLocation({ requestOnMount: true });
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const handlePermissionGranted = async () => {
    setShowPermissionDialog(false);
    await requestPermission();
  };

  const label = location.trim() || "Phnom Penh";
  const delta = zoom >= 14 ? 0.06 : 0.12;
  const center = userLocation ?? PHNOM_PENH;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${center.longitude - delta}%2C${center.latitude - delta}%2C${center.longitude + delta}%2C${center.latitude + delta}&layer=mapnik&marker=${center.latitude}%2C${center.longitude}`;

  if (Platform.OS !== "web") return null;

  const showMap = userLocation !== null;

  return (
    <View style={STYLES.card}>
      {showMap ? (
        <>
          <iframe title="Choose your job search area" src={mapUrl} style={iframeStyle} />
          <View pointerEvents="none" style={STYLES.mapLabel}>
            <Text style={STYLES.mapTitle}>{label}</Text>
            <Text style={STYLES.mapCaption}>Pan or zoom, then confirm this area</Text>
          </View>
          <Pressable
            accessibilityLabel="Show my current location"
            onPress={() => void requestPermission()}
            style={STYLES.locate}
          >
            <AppIcon name="locate" size={16} color="#12303C" />
          </Pressable>
          <View style={STYLES.controls}>
            <Pressable
              accessibilityLabel="Zoom out"
              onPress={() => setZoom((value) => Math.max(11, value - 1))}
              style={STYLES.control}
            >
              <Text style={STYLES.controlText}>−</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Zoom in"
              onPress={() => setZoom((value) => Math.min(16, value + 1))}
              style={STYLES.control}
            >
              <Text style={STYLES.controlText}>+</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(label)}
            style={STYLES.confirm}
          >
            <AppIcon name="locate" size={16} color="#FFFFFF" />
            <Text style={STYLES.confirmText}>Use this area</Text>
          </Pressable>
        </>
      ) : (
        <View style={STYLES.permissionCard}>
          <Text style={STYLES.permissionTitle}>Allow location access</Text>
          <Text style={STYLES.permissionBody}>
            {userLocation === null
              ? "To help you find nearby jobs, we need access to your current location."
              : "Unable to determine your location. Please check location services."}
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
      )}
      <Modal
        transparent
        visible={showPermissionDialog}
        animationType="fade"
        onRequestClose={() => setShowPermissionDialog(false)}
      >
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
