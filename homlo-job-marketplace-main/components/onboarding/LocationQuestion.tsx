// components/onboarding/LocationQuestion.tsx
// Onboarding step "Where do you want to work?".
//
//   1. "Use my current location": asks for permission only when tapped, reads
//      the position and turns it into a place name ("Toul Kork, Phnom Penh").
//      If no name can be found it keeps the coordinates (saved as "lat, lng",
//      which profile setup turns back into coordinates).
//   2. Or type a city / area, with quick picks for common cities.
//
// The parent owns the value; this component only reports it via onChange.
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import Animated, { FadeIn } from "react-native-reanimated";

import { IconTile } from "@/components/onboarding/OptionRow";
import { AppIcon } from "@/components/ui/AppIcon";
import { locationService } from "@/lib/location-service";
import { parseCoordinateLocation } from "@/lib/onboarding";
import { familyForWeight } from "@/lib/typography";
import { PressableScale, Reveal, SMOOTH } from "@/src/design/motion";

const C = {
  primary: "#0891B2",
  primaryDeep: "#0B6F8A",
  ink: "#14324A",
  muted: "#6A7C84",
  faint: "#9AAAB1",
  line: "#E6EDEF",
  selected: "#F2FAFC",
  error: "#B42318",
};

const QUICK_PICKS = ["Phnom Penh", "Siem Reap", "Battambang", "Sihanoukville"];

type GpsState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "found"; label: string }
  | { kind: "blocked" }
  | { kind: "failed" };

/** Builds "Area, City" from a reverse-geocode result, or null if it has nothing useful. */
function placeLabel(place: Location.LocationGeocodedAddress | undefined): string | null {
  if (!place) return null;
  const area = place.district || place.subregion || place.name;
  const city = place.city || place.region;
  const parts = [area, city].filter((p, i, all): p is string => !!p && all.indexOf(p) === i);
  return parts.length ? parts.join(", ") : null;
}

export function LocationQuestion({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [gps, setGps] = useState<GpsState>(() => {
    if (!value) return { kind: "idle" };
    return parseCoordinateLocation(value) ? { kind: "found", label: "Your current location" } : { kind: "idle" };
  });
  const [focused, setFocused] = useState(false);
  const usingGps = gps.kind === "found";
  const typed = usingGps ? "" : value;

  const locateCurrent = async () => {
    if (gps.kind === "locating") return;
    setGps({ kind: "locating" });
    try {
      const details = await locationService.getPermissionDetails();
      const status =
        details.status === "granted"
          ? "granted"
          : details.status === "denied" && !details.canAskAgain
            ? "denied"
            : await locationService.requestPermission();
      if (status !== "granted") {
        setGps({ kind: "blocked" });
        return;
      }
      const pos = await locationService.getCurrentPosition({ accuracy: Location.Accuracy.Balanced });
      if (!pos) {
        setGps({ kind: "failed" });
        return;
      }
      let label: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: pos.latitude, longitude: pos.longitude });
        label = placeLabel(place);
      } catch {
        label = null;
      }
      onChange(label ?? `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`);
      setGps({ kind: "found", label: label ?? "Your current location" });
    } catch {
      setGps({ kind: "failed" });
    }
  };

  const typeInstead = (text: string) => {
    if (gps.kind !== "idle") setGps({ kind: "idle" });
    onChange(text);
  };

  return (
    <View style={{ marginTop: 22 }}>
      {/* option 1: device location */}
      <Reveal index={0}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={usingGps ? `Using your location: ${gps.label}` : "Use my current location"}
          onPress={() => void locateCurrent()}
          scale={0.98}
          style={[styles.gpsCard, usingGps && styles.gpsCardOn]}
        >
          <IconTile icon="locate" tint="cyan" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.gpsTitle, usingGps && { color: C.primaryDeep }]}>
              {usingGps ? gps.label : "Use my current location"}
            </Text>
            <Text style={styles.gpsCopy}>
              {gps.kind === "locating"
                ? "Finding where you are…"
                : usingGps
                  ? "Tap to refresh"
                  : "Find the jobs closest to you"}
            </Text>
          </View>
          {gps.kind === "locating" ? (
            <ActivityIndicator color={C.primary} />
          ) : usingGps ? (
            <Animated.View entering={FadeIn.duration(200).easing(SMOOTH)} style={styles.check}>
              <AppIcon name="check" size={14} strokeWidth={2.6} color="#fff" />
            </Animated.View>
          ) : (
            <AppIcon name="chevron" size={20} strokeWidth={1.8} color={C.faint} />
          )}
        </PressableScale>
      </Reveal>

      {gps.kind === "blocked" && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.noteRow}>
          <Text style={styles.noteText}>Location access is off. Type your area below, or </Text>
          <Pressable onPress={() => void Linking.openSettings()} hitSlop={6} accessibilityRole="link">
            <Text style={styles.noteLink}>open Settings</Text>
          </Pressable>
        </Animated.View>
      )}
      {gps.kind === "failed" && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.noteRow}>
          <Text style={styles.noteText}>We couldn’t find your location. Type your area below instead.</Text>
        </Animated.View>
      )}

      {/* divider */}
      <Reveal index={1}>
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or type it in</Text>
          <View style={styles.orLine} />
        </View>
      </Reveal>

      {/* option 2: type a place */}
      <Reveal index={2}>
        <View style={[styles.field, focused && styles.fieldFocus]}>
          <AppIcon name="pin" size={19} strokeWidth={1.6} color={focused ? C.primary : C.muted} />
          <TextInput
            accessibilityLabel="City or area"
            value={typed}
            onChangeText={typeInstead}
            placeholder="City or area, e.g. Toul Kork"
            placeholderTextColor={C.faint}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="addressCity"
            returnKeyType="done"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
          />
          {typed ? (
            <Pressable onPress={() => typeInstead("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear">
              <AppIcon name="close" size={16} strokeWidth={2} color={C.faint} />
            </Pressable>
          ) : null}
        </View>
      </Reveal>

      <Reveal index={3}>
        <View style={styles.chips}>
          {QUICK_PICKS.map((city) => {
            const on = !usingGps && value.trim().toLowerCase() === city.toLowerCase();
            return (
              <PressableScale
                key={city}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => typeInstead(city)}
                scale={0.95}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{city}</Text>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      <Reveal index={4}>
        <View style={styles.privacy}>
          <AppIcon name="pw" size={14} strokeWidth={1.6} color={C.faint} />
          <Text style={styles.privacyText}>We only use this to show jobs near you.</Text>
        </View>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  gpsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
  },
  gpsCardOn: { borderColor: C.primary, backgroundColor: C.selected },
  gpsTitle: { fontFamily: familyForWeight("700"), fontSize: 15.5, color: C.ink },
  gpsCopy: { fontFamily: familyForWeight("400"), fontSize: 12.5, color: C.muted, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },

  noteRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, paddingHorizontal: 4 },
  noteText: { fontFamily: familyForWeight("500"), fontSize: 13, color: C.error },
  noteLink: { fontFamily: familyForWeight("700"), fontSize: 13, color: C.primary, textDecorationLine: "underline" },

  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  orLine: { flex: 1, height: 1.5, backgroundColor: C.line },
  orText: { fontFamily: familyForWeight("600"), fontSize: 12.5, color: C.faint },

  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  fieldFocus: { borderColor: C.primary },
  input: { flex: 1, height: "100%", fontFamily: familyForWeight("500"), fontSize: 15, color: C.ink, paddingVertical: 0 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primaryDeep },
  chipText: { fontFamily: familyForWeight("600"), fontSize: 13.5, color: C.ink },
  chipTextOn: { color: "#FFFFFF" },

  privacy: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, paddingHorizontal: 2 },
  privacyText: { fontFamily: familyForWeight("500"), fontSize: 12.5, color: C.faint },
});
