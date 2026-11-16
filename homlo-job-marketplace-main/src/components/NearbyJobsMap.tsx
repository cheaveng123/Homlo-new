import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type {
  CameraRef,
  OnPressEvent,
  ShapeSourceRef,
} from "../native-support";

import {
  DEFAULT_NEARBY_RADIUS_KM,
  MAX_NEARBY_PINS,
  MAX_NEARBY_RADIUS_KM,
} from "../config";
import { MAP_THEME } from "../theme/mapTheme";
import { COLORS } from "../config";
import { useLocation } from "../context/LocationContext";
import { MapLibre } from "../native-support";
import type { Coordinate, JobPin, JobWithDistance } from "../types";
import {
  circlePolygon,
  formatDistanceKm,
  haversineKm,
  jobsFeatureCollection,
  normalizeJobPin,
} from "../utils/geo";
import { AppMap } from "./AppMap";
import { MapUnavailable } from "./MapUnavailable";
import { JobPinLayers } from "./map/JobPinLayers";

export type NearbyJobsMapProps = {
  jobs: JobPin[];
  onViewJob: (job: JobPin) => void;
  onBack?: () => void;
  radiusKm?: number;
  maxPins?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function NearbyJobsMap({
  jobs,
  onViewJob,
  onBack,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
  maxPins = MAX_NEARBY_PINS,
  height,
  style,
}: NearbyJobsMapProps) {
  const {
    location,
    accuracy,
    permissionDenied,
    error: locationError,
    loading,
    requestPermission,
  } = useLocation();

  const cameraRef = useRef<CameraRef | null>(null);
  const sourceRef = useRef<ShapeSourceRef | null>(null);
  const [selected, setSelected] = useState<JobWithDistance | null>(null);
  const [initialFit, setInitialFit] = useState<Coordinate[] | null>(null);
  const fittedKeyRef = useRef("");

  const effectiveRadiusKm = Math.min(
    Math.max(radiusKm, 0.1),
    MAX_NEARBY_RADIUS_KM,
  );
  const effectiveMaxPins = Math.min(Math.max(maxPins, 1), MAX_NEARBY_PINS);

  const normalizedJobs = useMemo(
    () =>
      jobs
        .map((job) => normalizeJobPin(job))
        .filter((job): job is JobPin => job !== null),
    [jobs],
  );

  const nearbyJobs = useMemo<JobWithDistance[]>(() => {
    if (!location) return [];

    return normalizedJobs
      .map((job) => {
        const coordinate: Coordinate = {
          latitude: job.latitude,
          longitude: job.longitude,
        };

        return {
          ...job,
          distanceKm: haversineKm(location, coordinate),
        };
      })
      .filter((job) => job.distanceKm <= effectiveRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, effectiveMaxPins);
  }, [effectiveMaxPins, effectiveRadiusKm, location, normalizedJobs]);

  const jobsShape = useMemo(
    () => jobsFeatureCollection(nearbyJobs),
    [nearbyJobs],
  );

  const radiusShape = useMemo(
    () => (location ? circlePolygon(location, effectiveRadiusKm * 1000) : null),
    [effectiveRadiusKm, location],
  );

  useEffect(() => {
    if (!location) return;

    const jobsKey = nearbyJobs.map((job) => job.id).join("|");
    const fitKey =
      jobsKey.length > 0
        ? jobsKey
        : `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;

    if (fittedKeyRef.current === fitKey) return;
    fittedKeyRef.current = fitKey;

    setInitialFit([
      location,
      ...nearbyJobs.map((job) => ({
        latitude: job.latitude,
        longitude: job.longitude,
      })),
    ]);
  }, [location, nearbyJobs]);

  useEffect(() => {
    if (!selected) return;

    const stillVisible = nearbyJobs.some((job) => job.id === selected.id);
    if (!stillVisible) setSelected(null);
  }, [nearbyJobs, selected]);

  const handleSourcePress = useCallback(
    async (event: OnPressEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const geometry = feature.geometry;
      if (!geometry || geometry.type !== "Point") return;

      const [longitude, latitude] = geometry.coordinates as [number, number];

      const properties = feature.properties ?? {};

      if (properties.cluster) {
        let zoomLevel = 14;

        try {
          zoomLevel =
            (await sourceRef.current?.getClusterExpansionZoom(feature)) ?? 14;
        } catch {
          zoomLevel = 14;
        }

        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel,
          animationDuration: 400,
        });
        return;
      }

      const id = typeof properties.id === "string" ? properties.id : "";
      const job = nearbyJobs.find((candidate) => candidate.id === id);

      if (!job) return;

      setSelected(job);
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 14,
        animationDuration: 350,
      });
    },
    [nearbyJobs],
  );

  if (!MapLibre) {
    return (
      <MapUnavailable
        height={height}
        style={style}
        title="Nearby jobs map needs a development build"
        message="MapLibre cannot run inside Expo Go. Use the Homlo development build to see nearby job clusters and your position."
      />
    );
  }

  const { FillLayer, LineLayer, ShapeSource } = MapLibre;

  return (
    <View
      style={[styles.wrapper, height !== undefined ? { height } : null, style]}
    >
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      ) : null}

      <AppMap
        style={StyleSheet.absoluteFill}
        initialCenter={location ?? undefined}
        initialZoom={12}
        cameraRef={cameraRef}
        fitCoordinates={initialFit ?? undefined}
        bannerTop={56}
        userLocation={location}
        userAccuracy={accuracy}
        permissionDenied={permissionDenied}
        locationError={locationError}
        onRequestPermission={requestPermission}
      >
        {radiusShape ? (
          <ShapeSource id="nearby-radius" shape={radiusShape}>
            <FillLayer
              id="nearby-radius-fill"
              style={{ fillColor: `${MAP_THEME.primarySoft}CC` }}
            />
            <LineLayer
              id="nearby-radius-line"
              style={{
                lineColor: `${MAP_THEME.primary}80`,
                lineWidth: 1.5,
                lineDasharray: [2, 2],
              }}
            />
          </ShapeSource>
        ) : null}

        <ShapeSource
          id="nearby-jobs"
          ref={sourceRef}
          shape={jobsShape}
          cluster
          clusterRadius={48}
          clusterMaxZoomLevel={14}
          onPress={handleSourcePress}
        />

        <JobPinLayers
          jobs={nearbyJobs}
          selectedId={selected?.id ?? null}
          onPinPress={(jobId) => {
            const job = nearbyJobs.find((j) => j.id === jobId);
            if (job) setSelected(job);
          }}
        />
      </AppMap>

      {!location && loading && !permissionDenied ? (
        <View style={styles.loadingPill}>
          <Text style={styles.loadingText}>Locating nearby jobs…</Text>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.card}>
          <View style={styles.cardText}>
            <Text numberOfLines={1} style={styles.cardTitle}>
              {selected.title}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDistanceKm(selected.distanceKm)} away
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewJob(selected)}
            style={styles.viewButton}
          >
            <Text style={styles.viewButtonText}>View job</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Close job card"
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 100,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: MAP_THEME.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  loadingPill: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: MAP_THEME.radii.card,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  viewButton: {
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.onPrimary,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: `${MAP_THEME.primarySoft}CC`,
  },
  closeButtonText: {
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "700",
    color: COLORS.primary,
  },
});
