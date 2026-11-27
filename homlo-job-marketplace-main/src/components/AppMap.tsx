import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { CameraRef } from "../native-support";

import {
  FALLBACK_MAP_CENTER,
  HAS_MAPTILER_KEY,
  MAP_STYLE_URL,
 COLORS } from "../config";
import { MapLibre } from "../native-support";
import type { Coordinate } from "../types";
import { boundsForCoordinates } from "../utils/geo";
import { MapUnavailable } from "./MapUnavailable";
import { UserLocationLayer } from "./UserLocationLayer";

export type AppMapProps = {
  style?: StyleProp<ViewStyle>;
  initialCenter?: Coordinate;
  initialZoom?: number;
  cameraRef?: RefObject<CameraRef | null>;
  fitCoordinates?: Coordinate[];
  fitPadding?: number;
  /** Extra room on fits for floating chrome (top bar, bottom sheet). */
  fitInsets?: { top?: number; bottom?: number };
  bannerTop?: number;
  userLocation?: Coordinate | null;
  userAccuracy?: number | null;
  showUserLocation?: boolean;
  permissionDenied?: boolean;
  locationError?: string | null;
  onRequestPermission?: () => void | Promise<void>;
  onMapReady?: () => void;
  /** Camera zoom after each pan/zoom settles (drives JS pin clustering). */
  onZoomChange?: (zoom: number) => void;
  /** Where the OpenStreetMap attribution button sits (default: MapLibre's bottom-right). */
  attributionPosition?: { top?: number; bottom?: number; left?: number; right?: number };
  /** The camera starts moving (pan, zoom or an animated setCamera). */
  onCameraMoveStart?: (byUser: boolean) => void;
  /** The camera settled: its centre, zoom and whether a gesture moved it. */
  onCameraIdle?: (center: Coordinate, zoom: number, byUser: boolean) => void;
  children?: ReactNode;
};

export function AppMap({
  style,
  initialCenter,
  initialZoom = 12,
  cameraRef,
  fitCoordinates,
  fitPadding = 56,
  fitInsets,
  bannerTop = 12,
  userLocation = null,
  userAccuracy = null,
  showUserLocation = true,
  permissionDenied = false,
  locationError = null,
  onRequestPermission,
  onMapReady,
  onZoomChange,
  attributionPosition,
  onCameraMoveStart,
  onCameraIdle,
  children,
}: AppMapProps) {
  const internalCameraRef = useRef<CameraRef | null>(null);
  const activeCameraRef = cameraRef ?? internalCameraRef;
  const [mapReady, setMapReady] = useState(false);

  const center = initialCenter ?? FALLBACK_MAP_CENTER;

  const defaultSettings = useMemo(
    () => ({
      centerCoordinate: [center.longitude, center.latitude] as [number, number],
      zoomLevel: initialZoom,
    }),
    [center.latitude, center.longitude, initialZoom],
  );

  const fitKey = useMemo(
    () =>
      (fitCoordinates ?? [])
        .map(
          (coordinate) =>
            `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`,
        )
        .join("|"),
    [fitCoordinates],
  );

  useEffect(() => {
    if (!mapReady) return;

    const camera = activeCameraRef.current;
    if (!camera || !fitCoordinates || fitCoordinates.length === 0) return;

    const bounds = boundsForCoordinates(fitCoordinates);
    if (!bounds) return;

    const isSinglePoint =
      Math.abs(bounds.ne[0] - bounds.sw[0]) < 1e-9 &&
      Math.abs(bounds.ne[1] - bounds.sw[1]) < 1e-9;

    if (isSinglePoint) {
      camera.setCamera({
        centerCoordinate: bounds.ne,
        zoomLevel: 13,
        animationDuration: 600,
      });
      return;
    }

    camera.setCamera({
      bounds,
      padding: {
        paddingTop: fitPadding + (fitInsets?.top ?? 0),
        paddingRight: fitPadding,
        paddingBottom: fitPadding + 36 + (fitInsets?.bottom ?? 0),
        paddingLeft: fitPadding,
      },
      animationDuration: 600,
    });
  }, [activeCameraRef, fitCoordinates, fitKey, fitPadding, fitInsets?.top, fitInsets?.bottom, mapReady]);

  const handleMapReady = () => {
    setMapReady(true);
    onMapReady?.();
  };

  if (!MapLibre) {
    return (
      <MapUnavailable
        style={style}
        title="Map needs a development build"
        message="MapLibre cannot run inside Expo Go. Run npx expo run:ios or npx expo run:android, then open the Homlo development build."
      />
    );
  }

  const { Camera, MapView } = MapLibre;

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled
        attributionPosition={attributionPosition as never}
        compassEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
        onDidFinishLoadingStyle={handleMapReady}
        onRegionWillChange={
          onCameraMoveStart
            ? (feature) => onCameraMoveStart(Boolean(feature?.properties?.isUserInteraction))
            : undefined
        }
        onRegionDidChange={
          onZoomChange || onCameraIdle
            ? (feature) => {
                const zoom = feature?.properties?.zoomLevel;
                if (typeof zoom !== "number" || !Number.isFinite(zoom)) return;
                onZoomChange?.(zoom);
                const [longitude, latitude] = (feature?.geometry?.coordinates ?? []) as number[];
                if (onCameraIdle && Number.isFinite(latitude) && Number.isFinite(longitude)) {
                  onCameraIdle({ latitude, longitude }, zoom, Boolean(feature?.properties?.isUserInteraction));
                }
              }
            : undefined
        }
      >
        <Camera ref={activeCameraRef} defaultSettings={defaultSettings} />

        {showUserLocation ? (
          <UserLocationLayer location={userLocation} accuracy={userAccuracy} />
        ) : null}

        {children}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[styles.bannerStack, { top: bannerTop }]}
      >
        {!HAS_MAPTILER_KEY ? (
          <View style={styles.banner}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Map key missing</Text>
              <Text style={styles.bannerBody}>
                Add PUBLIC_MAPTILER_KEY to .env, then restart Metro.
              </Text>
            </View>
          </View>
        ) : null}

        {permissionDenied ? (
          <View style={styles.banner}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Location permission denied</Text>
              <Text style={styles.bannerBody}>
                Enable location to show the blue dot, nearby jobs, and routes.
              </Text>
            </View>
            {onRequestPermission ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void onRequestPermission();
                }}
                style={styles.bannerButton}
              >
                <Text style={styles.bannerButtonText}>Enable</Text>
              </Pressable>
            ) : null}
          </View>
        ) : locationError && !userLocation ? (
          <View style={styles.banner}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Location unavailable</Text>
              <Text style={styles.bannerBody}>{locationError}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  bannerStack: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    gap: 8,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  bannerBody: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  bannerButton: {
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.onPrimary,
  },
});
