/**
 * app/complete-profile.tsx
 *
 * Step 2 of 2 after sign-up: one optional question — "Add a profile photo".
 * The person can take or choose a photo, or skip.
 *
 * Either way, finishing this step creates their Homlo profile (the app treats
 * an account without a profile as unfinished), using:
 *   - role      "worker" (every account can still post jobs — see
 *               migration 051_allow_all_accounts_to_post_jobs)
 *   - name      the name given at sign-up, else one made from their email
 *   - location  what they picked in first-run onboarding, if anything
 *   - photo     the uploaded photo's storage key, or none
 *
 * Anyone without a recorded age is sent back to /age first.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AuthWash from "@/components/auth/AuthWash";
import { AppIcon } from "@/components/ui/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import { defaultDisplayName } from "@/lib/display-name";
import { getLocalValue } from "@/lib/local-persistence";
import { ONBOARDING_PREFERENCES_KEY, parseCoordinateLocation, parseOnboardingAnswers } from "@/lib/onboarding";
import { pickerImageToJpegDataUrl, uploadProfilePhotoBytes } from "@/lib/profile-photo";
import { trpc } from "@/lib/trpc";
import { fonts, familyForWeight } from "@/lib/typography";
import { PressableScale, Reveal, SMOOTH } from "@/src/design/motion";

const C = {
  primary: "#0891B2",
  primaryDeep: "#0B6F8A",
  wash: "#DCF1F6",
  amber: "#F5A524",
  ink: "#14324A",
  muted: "#6A7C84",
  faint: "#9AAAB1",
  line: "#E6EDEF",
  error: "#B42318",
  errorBg: "#FEF3F2",
};

const STEPS = ["Your age", "Your photo"];
const AVATAR = 168;

type PickedPhoto = { uri: string; asset: ImagePicker.ImagePickerAsset };
type Busy = null | "saving" | "skipping";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const saveProfile = trpc.homlo.profile.upsert.useMutation();
  const needsAgeCheck = !loading && isAuthenticated && !user?.profileComplete;
  const ageQuery = trpc.homlo.account.age.useQuery(undefined, { enabled: needsAgeCheck });

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login" as never);
    if (!loading && user?.profileComplete) router.replace("/" as never);
  }, [isAuthenticated, loading, router, user?.profileComplete]);

  // Step 1 of sign-up is the age screen; send anyone who skipped it back there.
  useEffect(() => {
    if (needsAgeCheck && ageQuery.isSuccess && ageQuery.data?.age == null) router.replace("/age" as never);
  }, [ageQuery.data?.age, ageQuery.isSuccess, needsAgeCheck, router]);

  const choose = async (source: "camera" | "library") => {
    setError(null);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          source === "camera"
            ? "Camera access is off. You can allow it in Settings, or choose a photo instead."
            : "Photo access is off. You can allow it in Settings, or take a photo instead.",
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets?.[0];
      if (asset?.uri) setPhoto({ uri: asset.uri, asset });
    } catch {
      setError("We couldn’t open your photos. Please try again.");
    }
  };

  /** Creates the profile, with the photo if one was chosen. */
  const finish = async (withPhoto: boolean) => {
    if (busy) return;
    setError(null);
    setBusy(withPhoto ? "saving" : "skipping");
    try {
      let profilePhotoKey: string | null = null;
      if (withPhoto && photo) {
        const dataUrl = await pickerImageToJpegDataUrl(photo.asset, { maxWidth: 1080, aspect: { width: 1, height: 1 } });
        profilePhotoKey = (await uploadProfilePhotoBytes(dataUrl)).key;
      }

      const answers = parseOnboardingAnswers(await getLocalValue(ONBOARDING_PREFERENCES_KEY).catch(() => null));
      const point = answers ? parseCoordinateLocation(answers.location) : null;
      const locationText = point ? "Current location" : answers?.location || null;

      await saveProfile.mutateAsync({
        role: "worker",
        fullName: defaultDisplayName(user?.name, user?.email),
        locationText,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        profilePhotoKey,
      });
      await refresh();
      router.replace("/" as never);
    } catch (cause) {
      setError(
        withPhoto
          ? "We couldn’t upload your photo. Try again, or skip for now."
          : cause instanceof Error
            ? cause.message
            : "We couldn’t finish setting up your account. Please try again.",
      );
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const name = defaultDisplayName(user?.name, user?.email);
  const initials = name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.root}>
      <AuthWash width={width} height={320 + insets.top} />

      <View style={[styles.body, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.container}>
          {/* straight-line progress: step 2 of 2 */}
          <View style={styles.progress} accessibilityLabel="Step 2 of 2: Your photo">
            {STEPS.map((label, i) => (
              <View key={label} style={styles.progressStep}>
                <View style={[styles.progressBar, styles.progressBarActive]} />
                <View style={styles.progressLabelRow}>
                  {i === 0 && <AppIcon name="check" size={12} strokeWidth={2.6} color={C.primaryDeep} />}
                  <Text style={[styles.progressLabel, i === 1 && styles.progressLabelActive]}>{label}</Text>
                </View>
              </View>
            ))}
          </View>

          <Reveal index={0}>
            <Text style={styles.eyebrow}>STEP 2 OF 2 · OPTIONAL</Text>
            <Text style={styles.title}>Add a profile photo</Text>
            <Text style={styles.sub}>A friendly photo helps employers recognise you.{"\n"}You can add or change it any time.</Text>
          </Reveal>
        </View>

        {/* avatar */}
        <View style={styles.avatarBlock}>
          <Reveal index={1}>
            <Pressable
              onPress={() => void choose("library")}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={photo ? "Change your photo" : "Choose a photo"}
            >
              <View style={styles.avatarWrap}>
                {!photo && <PulseRing reduce={!!reduce} />}
                <View style={[styles.avatar, photo && styles.avatarFilled]}>
                  {photo ? (
                    <Animated.View entering={reduce ? undefined : FadeIn.duration(260).easing(SMOOTH)} style={StyleSheet.absoluteFill}>
                      <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
                    </Animated.View>
                  ) : (
                    <Text style={styles.initials}>{initials || "?"}</Text>
                  )}
                </View>
                <View style={styles.camBadge}>
                  <AppIcon name={photo ? "edit" : "cam"} size={18} strokeWidth={2} color="#fff" />
                </View>
              </View>
            </Pressable>
          </Reveal>

          <Reveal index={2}>
            <Text style={styles.nameLabel} numberOfLines={1}>{name}</Text>
          </Reveal>

          <Reveal index={3} style={styles.sourceRow}>
            <PressableScale
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => void choose("camera")}
              style={styles.sourceBtn}
            >
              <AppIcon name="cam" size={18} strokeWidth={1.8} color={C.primaryDeep} />
              <Text style={styles.sourceText}>Take a photo</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => void choose("library")}
              style={styles.sourceBtn}
            >
              <AppIcon name="image" size={18} strokeWidth={1.8} color={C.primaryDeep} />
              <Text style={styles.sourceText}>{photo ? "Choose another" : "Choose photo"}</Text>
            </PressableScale>
          </Reveal>
        </View>

        <View style={styles.container}>
          {error && (
            <View style={styles.alert} accessibilityRole="alert">
              <AppIcon name="alert" size={16} strokeWidth={1.8} color={C.error} />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: !photo || !!busy }}
            disabled={!photo || !!busy}
            onPress={() => void finish(true)}
            style={[styles.cta, (!photo || !!busy) && styles.ctaDisabled]}
          >
            {busy === "saving" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.ctaText, !photo && styles.ctaTextDisabled]}>Continue</Text>
            )}
          </PressableScale>
          <Pressable
            onPress={() => void finish(false)}
            disabled={!!busy}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.skipBtn}
          >
            {busy === "skipping" ? (
              <ActivityIndicator color={C.muted} />
            ) : (
              <Text style={styles.skipText}>Skip for now</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Soft expanding ring that invites a tap on the empty avatar (no bounce). */
function PulseRing({ reduce }: { reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: SMOOTH }), withTiming(0, { duration: 0 })), -1);
  }, [reduce, t]);
  const st = useAnimatedStyle(() => ({
    opacity: reduce ? 0.35 : 0.5 * (1 - t.value),
    transform: [{ scale: 1 + 0.14 * t.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, st]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "space-between" },
  container: { width: "100%", maxWidth: 420, alignSelf: "center", paddingHorizontal: 24 },

  progress: { flexDirection: "row", gap: 8, marginBottom: 28 },
  progressStep: { flex: 1 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: C.line },
  progressBarActive: { backgroundColor: C.amber },
  progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  progressLabel: { fontFamily: familyForWeight("500"), fontSize: 12, color: C.muted },
  progressLabelActive: { fontFamily: familyForWeight("600"), color: C.ink },

  eyebrow: { fontFamily: familyForWeight("700"), fontSize: 11.5, letterSpacing: 1.1, color: C.primaryDeep, textAlign: "center" },
  title: { fontFamily: fonts.heading.bold, fontSize: 30, letterSpacing: -0.5, color: C.ink, textAlign: "center", marginTop: 10 },
  sub: { fontFamily: familyForWeight("400"), fontSize: 14, lineHeight: 21, color: C.muted, textAlign: "center", marginTop: 10 },

  avatarBlock: { alignItems: "center" },
  avatarWrap: { width: AVATAR, height: AVATAR, alignItems: "center", justifyContent: "center" },
  pulse: { position: "absolute", width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2, borderColor: C.primary },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: C.wash,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#8BD3E3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFilled: { borderStyle: "solid", borderColor: "#FFFFFF", borderWidth: 4, backgroundColor: "#FFFFFF" },
  initials: { fontFamily: fonts.heading.bold, fontSize: 52, letterSpacing: -1, color: C.primaryDeep },
  camBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: C.ink, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  nameLabel: { fontFamily: familyForWeight("700"), fontSize: 17, color: C.ink, marginTop: 16, maxWidth: 300, textAlign: "center" },
  sourceRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  sourceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
  },
  sourceText: { fontFamily: familyForWeight("600"), fontSize: 14, color: C.primaryDeep },

  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: C.errorBg,
  },
  alertText: { flex: 1, fontFamily: familyForWeight("500"), fontSize: 13, lineHeight: 18, color: C.error },
  cta: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    borderWidth: 1,
    borderColor: C.primaryDeep,
    borderBottomWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: "#EEF3F4", borderColor: C.line },
  ctaText: { fontFamily: familyForWeight("700"), color: "#fff", fontSize: 15.5, letterSpacing: 0.2 },
  ctaTextDisabled: { color: C.faint },
  skipBtn: { alignSelf: "center", marginTop: 14, minHeight: 32, minWidth: 120, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: familyForWeight("700"), fontSize: 14.5, color: C.muted },
});
