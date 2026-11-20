/**
 * app/age.tsx
 *
 * First step after sign-up: asks the new member for their age with a straight
 * compass-tape picker, saves it to their Homlo account, then continues to the
 * "complete profile" step. Shown only to accounts whose profile is not complete
 * yet and that have no age recorded (see app/complete-profile.tsx).
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import AgeTape from "@/components/auth/AgeTape";
import AuthWash from "@/components/auth/AuthWash";
import { AppIcon } from "@/components/ui/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import { AGE_DEFAULT, AGE_MAX, AGE_MIN, clampAge } from "@/lib/age";
import { trpc } from "@/lib/trpc";
import { fonts, familyForWeight } from "@/lib/typography";

const C = {
  primary: "#0891B2",
  primaryDeep: "#0B6F8A",
  amber: "#F5A524",
  ink: "#14324A",
  muted: "#6A7C84",
  line: "#E6EDEF",
  error: "#B42318",
  errorBg: "#FEF3F2",
};

const STEPS = ["Your age", "Your profile"];

export default function AgeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const saveAge = trpc.homlo.account.setAge.useMutation();

  const [age, setAge] = useState(AGE_DEFAULT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login" as never);
    if (!loading && user?.profileComplete) router.replace("/" as never);
  }, [isAuthenticated, loading, router, user?.profileComplete]);

  const save = async () => {
    setError(null);
    try {
      await saveAge.mutateAsync({ age: clampAge(age) });
      await utils.homlo.account.age.invalidate();
      router.replace("/complete-profile" as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your age. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const tapeWidth = Math.min(width, 520);

  return (
    <View style={styles.root}>
      <AuthWash width={width} height={300 + insets.top} />

      <View style={[styles.body, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* straight-line progress: step 1 of 2 */}
        <View style={styles.container}>
          <View style={styles.progress} accessibilityLabel="Step 1 of 2: Your age">
            {STEPS.map((label, i) => (
              <View key={label} style={styles.progressStep}>
                <View style={[styles.progressBar, i === 0 && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, i === 0 && styles.progressLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
          <Text style={styles.title}>How old are you?</Text>
          <Text style={styles.sub}>
            This helps us show jobs that suit you.{"\n"}It isn’t shown on your public profile.
          </Text>
        </View>

        <View style={styles.pickerBlock}>
          <View style={styles.readout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.readoutValue}>{age}</Text>
            <Text style={styles.readoutUnit}>years old</Text>
          </View>

          <AgeTape min={AGE_MIN} max={AGE_MAX} value={age} width={tapeWidth} onChange={setAge} />

          <View style={styles.hintRow}>
            <AppIcon name="back" size={14} strokeWidth={1.8} color={C.muted} />
            <Text style={styles.hint}>Slide the scale to set your age</Text>
            <AppIcon name="arrow" size={14} strokeWidth={1.8} color={C.muted} />
          </View>
        </View>

        <View style={styles.container}>
          {error && (
            <View style={styles.alert} accessibilityRole="alert">
              <AppIcon name="alert" size={16} strokeWidth={1.8} color={C.error} />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continue with age ${age}`}
            disabled={saveAge.isPending}
            onPress={save}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed, saveAge.isPending && styles.disabled]}
          >
            <Text style={styles.ctaText}>{saveAge.isPending ? "Saving…" : "Continue"}</Text>
          </Pressable>
          <Text style={styles.footnote}>You must be at least {AGE_MIN} to use Homlo.</Text>
        </View>
      </View>
    </View>
  );
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
  progressLabel: { fontFamily: familyForWeight("500"), fontSize: 12, color: C.muted, marginTop: 8 },
  progressLabelActive: { fontFamily: familyForWeight("600"), color: C.ink },

  eyebrow: { fontFamily: familyForWeight("700"), fontSize: 11.5, letterSpacing: 1.1, color: C.primaryDeep, textAlign: "center" },
  title: {
    fontFamily: fonts.heading.bold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: C.ink,
    textAlign: "center",
    marginTop: 10,
  },
  sub: {
    fontFamily: familyForWeight("400"),
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
    marginTop: 10,
  },

  pickerBlock: { alignItems: "center" },
  readout: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 22 },
  readoutValue: { fontFamily: fonts.heading.bold, fontSize: 64, letterSpacing: -2, color: C.ink, fontVariant: ["tabular-nums"] },
  readoutUnit: { fontFamily: familyForWeight("500"), fontSize: 16, color: C.muted },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  hint: { fontFamily: familyForWeight("500"), fontSize: 12.5, color: C.muted },

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
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: familyForWeight("600"), color: "#fff", fontSize: 15.5 },
  footnote: { fontFamily: familyForWeight("400"), fontSize: 12, color: "#9AAAB1", textAlign: "center", marginTop: 12 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
