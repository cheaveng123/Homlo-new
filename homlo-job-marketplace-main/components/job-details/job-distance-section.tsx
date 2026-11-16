import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { haversineDistance } from "@/lib/job-geography";
import { locationService } from "@/lib/location-service";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { formatRouteDuration, roadRoutingService, type RoadRoute } from "@/lib/routing-service";
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { colors } from "./colors";
import { JobDistanceMap } from "./job-distance-map";
import { fonts, type } from "./typography";

const LAST_KNOWN_MAX_AGE = 5 * 60 * 1000;

type LocationState =
  | { status: "loading" }
  | { status: "ready"; coordinate: MapCoordinate }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "error" };

type JobDistanceSectionProps = {
  jobCoordinate: MapCoordinate;
};

export async function resolveForegroundLocation(
  requestDeniedPermission = false,
): Promise<LocationState> {
  try {
    let permission = await locationService.getPermissionDetails();

    if (permission.status === "undetermined" || requestDeniedPermission) {
      permission = await locationService.requestPermissionDetails();
    }

    if (permission.status !== "granted") {
      return { status: "denied", canAskAgain: permission.canAskAgain };
    }

    const position = await locationService.getBestAvailablePosition(LAST_KNOWN_MAX_AGE);
    if (!position) {
      return { status: "error" };
    }
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
      return { status: "error" };
    }

    return { status: "ready", coordinate: { latitude: position.latitude, longitude: position.longitude } };
  } catch {
    return { status: "error" };
  }
}

export function formatDistance(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "—";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function JobDistanceSection({ jobCoordinate }: JobDistanceSectionProps) {
  const { latitude: jobLatitude, longitude: jobLongitude } = jobCoordinate;
  const [locationState, setLocationState] = useState<LocationState>({
    status: "loading",
  });
  const attemptRef = useRef(0);

  const loadLocation = useCallback((requestDeniedPermission = false) => {
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setLocationState({ status: "loading" });

    void resolveForegroundLocation(requestDeniedPermission).then(
      (nextState) => {
        if (attemptRef.current === attempt) {
          setLocationState(nextState);
        }
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLocation();
      let leftForeground = false;

      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState !== "active") {
          leftForeground = true;
          attemptRef.current += 1;
          return;
        }
        if (leftForeground) {
          leftForeground = false;
          loadLocation();
        }
      });

      return () => {
        attemptRef.current += 1;
        subscription.remove();
      };
    }, [loadLocation]),
  );

  const openSettings = useCallback(async () => {
    const attempt = attemptRef.current;
    try {
      await Linking.openSettings();
    } catch {
      if (attemptRef.current === attempt) {
        setLocationState({ status: "error" });
      }
    }
  }, []);

  const distanceKm =
    locationState.status === "ready"
      ? haversineDistance(locationState.coordinate, jobCoordinate)
      : null;

  const originLatitude = locationState.status === "ready" ? locationState.coordinate.latitude : null;
  const originLongitude = locationState.status === "ready" ? locationState.coordinate.longitude : null;
  const routeKey =
    originLatitude !== null && originLongitude !== null
      ? `${originLatitude},${originLongitude}|${jobLatitude},${jobLongitude}`
      : null;

  const [routeState, setRouteState] = useState<
    | { key: string; status: "unavailable" }
    | { key: string; status: "ready"; route: RoadRoute }
    | null
  >(null);

  useEffect(() => {
    if (originLatitude === null || originLongitude === null || routeKey === null) return;

    let active = true;
    const controller = new AbortController();
    const origin = { latitude: originLatitude, longitude: originLongitude };
    const destination = { latitude: jobLatitude, longitude: jobLongitude };

    void roadRoutingService
      .getRoute(origin, destination, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setRouteState(
          result.ok
            ? { key: routeKey, status: "ready", route: result.route }
            : { key: routeKey, status: "unavailable" },
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [originLatitude, originLongitude, jobLatitude, jobLongitude, routeKey]);

  const roadRoute =
    routeState?.key === routeKey && routeState.status === "ready" ? routeState.route : null;
  const distanceLabel =
    roadRoute !== null
      ? formatDistance(roadRoute.distanceKm)
      : distanceKm !== null
        ? formatDistance(distanceKm)
        : null;
  const distanceKind = roadRoute !== null ? "Road distance" : "Straight-line distance";
  const durationLabel =
    roadRoute !== null ? formatRouteDuration(roadRoute.durationMinutes) : null;

  const useSettings =
    locationState.status === "denied" && !locationState.canAskAgain;
  const actionLabel = useSettings ? "Open settings" : "Try again";
  const actionIcon: IconName = useSettings ? "gear" : "refresh";

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name="locate" size={18} color={colors.mintDeep} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={type.h2}>Distance to job</Text>
          <Text style={styles.subtitle}>From your current location</Text>
        </View>
      </View>

      {locationState.status === "loading" ? (
        <View
          accessibilityLabel="Finding your location"
          style={styles.loadingPanel}
        >
          <ActivityIndicator color={colors.mintDark} />
          <Text style={styles.loadingText}>Finding your location…</Text>
        </View>
      ) : null}

      {locationState.status === "ready" && distanceKm !== null ? (
        <>
          <JobDistanceMap
            userCoordinate={locationState.coordinate}
            jobCoordinate={jobCoordinate}
            routeGeometry={roadRoute?.geometry}
          />
          <View style={styles.summaryRow}>
            <View style={styles.legendGroup}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.mint }]}
                />
                <Text style={styles.legendText}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.mintDeep },
                  ]}
                />
                <Text style={styles.legendText}>Job</Text>
              </View>
            </View>
            <View style={styles.distanceColumn}>
              <View style={styles.distancePill}>
                <Text style={styles.distanceText}>{distanceLabel}</Text>
              </View>
              <Text style={styles.distanceMeta}>
                {distanceKind}
                {durationLabel ? ` · ${durationLabel}` : ""}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {locationState.status === "denied" || locationState.status === "error" ? (
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}>
            {locationState.status === "denied" ? (
              <AppIcon name="pin" size={22} color={colors.mintDeep} />
            ) : (
              <AppIcon name="alert" size={22} color={colors.danger} />
            )}
          </View>
          <Text style={styles.stateTitle}>
            {locationState.status === "denied"
              ? useSettings
                ? "Location access is off"
                : "Location access needed"
              : "Location unavailable"}
          </Text>
          <Text style={styles.stateBody}>
            {locationState.status === "denied"
              ? useSettings
                ? "Enable location access in system settings to see your distance."
                : "Allow location access to see how far this job is from you."
              : "We couldn't get a location fix. Check location services and try again."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={
              useSettings
                ? () => void openSettings()
                : () => loadLocation(locationState.status === "denied")
            }
            style={({ pressed }) => [
              styles.action,
              pressed && styles.actionPressed,
            ]}
          >
            <AppIcon name={actionIcon} size={15} color={colors.background} />
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 22 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mintTint,
    marginRight: 10,
  },
  headerCopy: { flex: 1 },
  subtitle: { ...type.caption, color: colors.muted, marginTop: 1 },
  loadingPanel: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { ...type.caption, color: colors.mintDeep, marginTop: 10 },
  summaryRow: {
    minHeight: 38,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendGroup: { flexDirection: "row", alignItems: "center", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { ...type.caption, color: colors.muted },
  distanceColumn: { alignItems: "flex-end", gap: 3 },
  distancePill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.mintTint,
  },
  distanceText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.mintDeep,
  },
  distanceMeta: {
    ...type.caption,
    color: colors.muted,
    fontSize: 11,
  },
  stateCard: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mintTint,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  stateTitle: { ...type.label, color: colors.ink, textAlign: "center" },
  stateBody: {
    ...type.caption,
    color: colors.muted,
    textAlign: "center",
    marginTop: 5,
  },
  action: {
    minHeight: 38,
    marginTop: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.mint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  actionPressed: { backgroundColor: colors.mintDark },
  actionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.background,
  },
});
