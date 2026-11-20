// Full-screen jobs map (/jobs-map). Ride-hailing layout: the map fills the
// screen; a floating search pill sits on top (fixed NEARBY_RADIUS_KM radius); a locate button
// rides above a draggable bottom sheet listing the nearest jobs. Tapping a pin
// (or a row) selects that job, centres it, and opens its card in the sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CameraRef } from "../native-support";

import { MAX_NEARBY_PINS, COLORS } from "../config";
import { MAP_THEME } from "../theme/mapTheme";
import { useLocation } from "../context/LocationContext";
import { MapLibre } from "../native-support";
import type { Coordinate, JobPin, JobWithDistance } from "../types";
import { circlePolygon, formatDistanceKm, haversineKm, normalizeJobPin } from "../utils/geo";
import { AppMap } from "./AppMap";
import { MapUnavailable } from "./MapUnavailable";
import { JobPinMarkers } from "./map/JobPinMarkers";
import {
  MapJobRow,
  MapLocateButton,
  MapSelectedJob,
  MapSheet,
  MapSheetHeader,
  MapTopBar,
  NEARBY_RADIUS_KM,
  travelNote,
  useSheetSnaps,
} from "./map/MapChrome";
import { palette } from "../design/tokens";
import { TextNew } from "../new/components/TextNew";

export type NearbyJobsMapProps = {
  jobs: JobPin[];
  onViewJob: (job: JobPin) => void;
  onBack?: () => void;
  /** Search radius; defaults to the shared NEARBY_RADIUS_KM (10 km). */
  radiusKm?: number;
  maxPins?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const TOP_BAR_H = 52;


export function NearbyJobsMap({
  jobs,
  onViewJob,
  onBack,
  radiusKm = NEARBY_RADIUS_KM,
  maxPins = MAX_NEARBY_PINS,
  height,
  style,
}: NearbyJobsMapProps) {
  const insets = useSafeAreaInsets();
  const { location, accuracy, permissionDenied, error: locationError, loading, requestPermission } = useLocation();

  const cameraRef = useRef<CameraRef | null>(null);
  const listRef = useRef<ScrollView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialFit, setInitialFit] = useState<Coordinate[] | null>(null);
  const [zoom, setZoom] = useState(12);
  const snaps = useSheetSnaps(212 + insets.bottom, insets.top + 8 + TOP_BAR_H + 12);
  const [sheetIndex, setSheetIndex] = useState(0);
  const fittedKeyRef = useRef("");

  const effectiveRadiusKm = Math.max(radiusKm, 0.1);
  const effectiveMaxPins = Math.min(Math.max(maxPins, 1), MAX_NEARBY_PINS);

  const normalizedJobs = useMemo(
    () => jobs.map((job) => normalizeJobPin(job)).filter((job): job is JobPin => job !== null),
    [jobs],
  );

  const nearbyJobs = useMemo<JobWithDistance[]>(() => {
    if (!location) return [];
    return normalizedJobs
      .map((job) => ({ ...job, distanceKm: haversineKm(location, job) }))
      .filter((job) => job.distanceKm <= effectiveRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, effectiveMaxPins);
  }, [effectiveMaxPins, effectiveRadiusKm, location, normalizedJobs]);

  const radiusShape = useMemo(
    () => (location ? circlePolygon(location, effectiveRadiusKm * 1000) : null),
    [effectiveRadiusKm, location],
  );

  // Fit the user + jobs once per result set (not on every location tick).
  useEffect(() => {
    if (!location) return;
    const jobsKey = nearbyJobs.map((job) => job.id).join("|");
    const fitKey = `${effectiveRadiusKm}:${jobsKey || `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`}`;
    if (fittedKeyRef.current === fitKey) return;
    fittedKeyRef.current = fitKey;
    setInitialFit([location, ...nearbyJobs.map((job) => ({ latitude: job.latitude, longitude: job.longitude }))]);
  }, [effectiveRadiusKm, location, nearbyJobs]);

  // The selection only counts while that job is still listed.
  const selected = useMemo(() => nearbyJobs.find((job) => job.id === selectedId) ?? null, [nearbyJobs, selectedId]);
  const others = useMemo(() => nearbyJobs.filter((job) => job.id !== selected?.id), [nearbyJobs, selected]);

  const focus = useCallback((job: JobWithDistance) => {
    setSelectedId(job.id);
    setSheetIndex(1);
    listRef.current?.scrollTo({ y: 0, animated: true });
    cameraRef.current?.setCamera({
      centerCoordinate: [job.longitude, job.latitude],
      zoomLevel: Math.max(zoom, 14),
      // Keep the pin in the visible band above the half-open sheet.
      padding: { paddingTop: 0, paddingRight: 0, paddingLeft: 0, paddingBottom: snaps[1] - 40 },
      animationDuration: 320,
    });
  }, [snaps, zoom]);

  const handleLocate = useCallback(() => {
    if (!location) {
      void requestPermission();
      return;
    }
    cameraRef.current?.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 14,
      padding: { paddingTop: 0, paddingRight: 0, paddingLeft: 0, paddingBottom: snaps[sheetIndex] - 40 },
      animationDuration: 320,
    });
  }, [location, requestPermission, sheetIndex, snaps]);

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
  const barBottom = insets.top + 8 + TOP_BAR_H;
  const count = nearbyJobs.length;

  let sheetTitle = `${count} ${count === 1 ? "job" : "jobs"} nearby`;
  let sheetSubtitle = `Within ${effectiveRadiusKm} km · nearest first`;
  if (!location) {
    sheetTitle = permissionDenied ? "Location is off" : "Finding jobs near you";
    sheetSubtitle = permissionDenied ? "Turn on location to see jobs around you" : "Getting your position…";
  }

  return (
    <View style={[styles.wrapper, height !== undefined ? { height } : null, style]}>
      <AppMap
        style={StyleSheet.absoluteFill}
        initialCenter={location ?? undefined}
        initialZoom={12}
        cameraRef={cameraRef}
        fitCoordinates={initialFit ?? undefined}
        fitInsets={{ top: barBottom, bottom: snaps[0] }}
        bannerTop={barBottom + 12}
        attributionPosition={{ bottom: snaps[0] + 8, left: 8 }}
        userLocation={location}
        userAccuracy={accuracy}
        permissionDenied={permissionDenied}
        locationError={locationError}
        onRequestPermission={requestPermission}
        onZoomChange={setZoom}
      >
        {radiusShape ? (
          <ShapeSource id="nearby-radius" shape={radiusShape}>
            <FillLayer id="nearby-radius-fill" style={{ fillColor: `${MAP_THEME.primarySoft}99` }} />
            <LineLayer id="nearby-radius-line" style={{ lineColor: `${MAP_THEME.primary}80`, lineWidth: 1.5, lineDasharray: [2, 2] }} />
          </ShapeSource>
        ) : null}

        <JobPinMarkers
          jobs={nearbyJobs}
          selectedId={selected?.id ?? null}
          onPinPress={focus}
          compact={zoom < 13}
        />
      </AppMap>

      <MapTopBar
        top={insets.top + 8}
        title="Jobs near you"
        subtitle={location ? `Within ${effectiveRadiusKm} km of your location` : loading ? "Locating…" : "Location unavailable"}
        onBack={onBack}
      />
      <MapSheet
        snaps={snaps}
        index={sheetIndex}
        onIndexChange={setSheetIndex}
        bottomInset={insets.bottom}
        scrollRef={listRef}
        fab={<MapLocateButton onPress={handleLocate} active={Boolean(location)} />}
        header={<MapSheetHeader title={sheetTitle} subtitle={sheetSubtitle} />}
      >
        {selected ? (
          <MapSelectedJob
            category={selected.category}
            title={selected.title}
            subtitle={selected.subtitle ?? undefined}
            pay={selected.label}
            distance={formatDistanceKm(selected.distanceKm)}
            note={travelNote(selected.distanceKm)}
            onView={() => onViewJob(selected)}
            onClose={() => {
              setSelectedId(null);
              setSheetIndex(0);
            }}
          />
        ) : null}
        {selected && others.length ? (
          <TextNew variant="meta" weight="semibold" color={palette.muted} style={styles.groupLabel}>Other jobs nearby</TextNew>
        ) : null}
        {others.map((job) => (
          <MapJobRow
            key={job.id}
            category={job.category}
            title={job.title}
            subtitle={job.subtitle ?? undefined}
            pay={job.label}
            distance={formatDistanceKm(job.distanceKm)}
            onPress={() => focus(job)}
          />
        ))}
        {location && count === 0 ? (
          <View style={styles.empty}>
            <TextNew variant="body" color={palette.muted} align="center">
              {`No jobs within ${effectiveRadiusKm} km yet. Check back soon.`}
            </TextNew>
          </View>
        ) : null}
      </MapSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, overflow: "hidden", backgroundColor: COLORS.surface },
  groupLabel: { marginTop: 6, marginLeft: 4 },
  empty: { paddingVertical: 24, paddingHorizontal: 16 },
});
