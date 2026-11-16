import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRoute } from "../hooks/useRoute";
import { useSignificantMove } from "../hooks/useSignificantMove";
import { useLocation } from "../context/LocationContext";
import { MapLibre } from "../native-support";
import type { JobPin } from "../types";
import { MAP_THEME } from "../theme/mapTheme";
import { COLORS } from "../config";
import {
  formatDistanceKm,
  formatDurationMinutes,
  haversineKm,
  lineFeature,
  toCoordinate,
} from "../utils/geo";
import { AppMap } from "./AppMap";
import { MapUnavailable } from "./MapUnavailable";
import { JobMarker } from "./map/JobMarker";
import { RouteLayer } from "./map/RouteLayer";

export type JobDetailMapProps = {
  job: JobPin;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function JobDetailMap({ job, height, style }: JobDetailMapProps) {
  const {
    location,
    accuracy,
    permissionDenied,
    error: locationError,
    requestPermission,
  } = useLocation();

  const destination = useMemo(
    () => toCoordinate(job.latitude, job.longitude),
    [job.latitude, job.longitude],
  );

  const significantLocation = useSignificantMove(location, 25);
  const routeOrigin = significantLocation ?? location;

  const {
    route,
    loading: routeLoading,
    error: routeError,
    retry,
  } = useRoute(routeOrigin, destination);

  const fallbackDistance =
    routeOrigin && destination ? haversineKm(routeOrigin, destination) : null;

  const fitCoordinates = useMemo(() => {
    const points = route?.geometry ? [...route.geometry] : [];

    if (routeOrigin) points.push(routeOrigin);
    if (destination) points.push(destination);

    if (points.length > 0) return points;

    return destination ? [destination] : [];
  }, [destination, route?.geometry, routeOrigin]);

  const fallbackCoordinates = useMemo(
    () => (routeOrigin && destination ? [routeOrigin, destination] : null),
    [destination, routeOrigin],
  );

  if (!MapLibre) {
    return (
      <MapUnavailable
        height={height}
        style={style}
        title="Route map needs a development build"
        message="MapLibre route maps cannot run inside Expo Go. Use the Homlo development build to see the blue dot and driving route."
      />
    );
  }

  const routeShape = route
    ? lineFeature(route.geometry, { kind: "driving-route" })
    : null;

  return (
    <View
      style={[styles.wrapper, height !== undefined ? { height } : null, style]}
    >
      <AppMap
        style={StyleSheet.absoluteFill}
        initialCenter={destination ?? undefined}
        initialZoom={13}
        fitCoordinates={fitCoordinates}
        userLocation={location}
        userAccuracy={accuracy}
        permissionDenied={permissionDenied}
        locationError={locationError}
        onRequestPermission={requestPermission}
      >
        {destination ? (
          <JobMarker coordinate={destination} />
        ) : null}

        <RouteLayer shape={routeShape} fallback={fallbackCoordinates} />
      </AppMap>

      <JobDetailMapInfo
        route={route}
        loading={routeLoading}
        error={routeError}
        fallbackDistance={fallbackDistance}
        hasOrigin={Boolean(routeOrigin)}
        onRetry={retry}
        jobTitle={job.title}
      />
    </View>
  );
}

export function JobDetailMapInfo({
  route,
  loading,
  error,
  fallbackDistance,
  hasOrigin,
  onRetry,
  jobTitle,
}: {
  route: ReturnType<typeof useRoute>["route"];
  loading: boolean;
  error: ReturnType<typeof useRoute>["error"];
  fallbackDistance: number | null;
  hasOrigin: boolean;
  onRetry: () => void;
  jobTitle: string;
}) {
  if (loading) {
    return (
      <View style={styles.infoCard}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.infoText}>Finding the driving route…</Text>
      </View>
    );
  }

  if (route) {
    return (
      <View style={styles.infoCard}>
        <View style={styles.infoMetric}>
          <Text style={styles.infoMetricValue}>
            {formatDurationMinutes(route.durationMinutes)}
          </Text>
          <Text style={styles.infoMetricLabel}>drive time</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoMetric}>
          <Text style={styles.infoMetricValue}>
            {formatDistanceKm(route.distanceKm)}
          </Text>
          <Text style={styles.infoMetricLabel}>driving distance</Text>
        </View>
      </View>
    );
  }

  if (!hasOrigin) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Turn on location to see the route to this job.
        </Text>
      </View>
    );
  }

  if (fallbackDistance !== null) {
    return (
      <View style={styles.infoCard}>
        <View style={styles.infoTextBlock}>
          <Text style={styles.infoTitle}>Routing unavailable</Text>
          <Text style={styles.infoText}>
            {formatDistanceKm(fallbackDistance)} straight line
            {error === "missing-key" ? " · add ORS_API_KEY to .env" : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoText}>This job has no map location.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  infoCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: MAP_THEME.radii.card,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  infoTextBlock: {
    flex: 1,
    gap: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  infoMetric: {
    flex: 1,
    gap: 1,
  },
  infoMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  infoMetricLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  infoDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: COLORS.border,
  },
  retryButton: {
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.onPrimary,
  },
});
