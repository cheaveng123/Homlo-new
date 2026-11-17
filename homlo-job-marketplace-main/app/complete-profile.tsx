import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Role = "worker" | "employer" | "both";

const ROLE_OPTIONS: { value: Role; title: string; copy: string }[] = [
  { value: "worker", title: "Find work", copy: "Apply for flexible opportunities." },
  { value: "employer", title: "Hire people", copy: "Publish and manage job listings." },
  { value: "both", title: "Do both", copy: "Keep both sides of Homlo available." },
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>("worker");
  const [locationText, setLocationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saveProfile = trpc.homlo.profile.upsert.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login" as never);
    if (!loading && user?.profileComplete) router.replace("/" as never);
  }, [isAuthenticated, loading, router, user?.profileComplete]);

  const complete = async () => {
    if (fullName.trim().length < 2) {
      setError("Add the name you would like to use on Homlo.");
      return;
    }
    setError(null);
    try {
      await saveProfile.mutateAsync({ role, fullName: fullName.trim(), locationText: locationText.trim() || null });
      await refresh();
      router.replace("/" as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your Homlo profile.");
    }
  };

  if (loading) {
    return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.loading}><ActivityIndicator color="#0891B2" /><Text style={styles.loadingText}>Restoring your account…</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.screen}>
        <View><Text style={styles.eyebrow}>ONE MORE STEP</Text><Text style={styles.title}>Set up your Homlo profile.</Text><Text style={styles.copy}>Choose how you plan to use the marketplace. You can change this later.</Text></View>
        <View style={styles.form}>
          <Text style={styles.label}>Your name</Text>
          <TextInput value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Full name" placeholderTextColor="#859087" style={styles.input} />
          <Text style={[styles.label, styles.roleLabel]}>How will you use Homlo?</Text>
          <View style={styles.roles}>{ROLE_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: role === option.value }} onPress={() => setRole(option.value)} style={({ pressed }) => [styles.roleCard, role === option.value && styles.roleCardSelected, pressed && styles.pressed]}><View style={[styles.radio, role === option.value && styles.radioSelected]}>{role === option.value && <View style={styles.radioDot} />}</View><View style={styles.roleText}><Text style={styles.roleTitle}>{option.title}</Text><Text style={styles.roleCopy}>{option.copy}</Text></View></Pressable>)}</View>
          <Text style={[styles.label, styles.locationLabel]}>Where are you based? <Text style={styles.optional}>Optional</Text></Text>
          <TextInput value={locationText} onChangeText={setLocationText} placeholder="City or area" placeholderTextColor="#859087" autoCapitalize="words" style={styles.input} />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
        <Pressable accessibilityRole="button" disabled={saveProfile.isPending} onPress={complete} style={({ pressed }) => [styles.primary, (pressed || saveProfile.isPending) && styles.pressed, saveProfile.isPending && styles.disabled]}><Text style={styles.primaryText}>{saveProfile.isPending ? "Saving profile…" : "Finish setup"}</Text></Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  eyebrow: { color: "#0891B2", fontSize: 11, fontWeight: "800", letterSpacing: 1.15 },
  title: { color: "#17201A", fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 36, marginTop: 10 },
  copy: { color: "#66736A", fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 330 },
  form: { marginTop: 27 },
  label: { color: "#38443C", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#D7DFDA", borderRadius: 13, borderWidth: 1, color: "#17201A", fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  roleLabel: { marginTop: 23 },
  roles: { gap: 9 },
  roleCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D7DFDA", borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 67, paddingHorizontal: 14 },
  roleCardSelected: { backgroundColor: "#EEF7FA", borderColor: "#0891B2" },
  radio: { alignItems: "center", borderColor: "#AAB6AE", borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: "center", width: 20 },
  radioSelected: { borderColor: "#0891B2" }, radioDot: { backgroundColor: "#0891B2", borderRadius: 5, height: 10, width: 10 },
  roleText: { flex: 1, marginLeft: 12 }, roleTitle: { color: "#17201A", fontSize: 15, fontWeight: "800" }, roleCopy: { color: "#66736A", fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  locationLabel: { marginTop: 21 }, optional: { color: "#859087", fontWeight: "600" },
  error: { color: "#B42318", fontSize: 13, lineHeight: 18, marginTop: 9 },
  primary: { alignItems: "center", backgroundColor: "#0891B2", borderRadius: 14, justifyContent: "center", minHeight: 56 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  loading: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center" }, loadingText: { color: "#66736A", fontSize: 14, fontWeight: "600" }, pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.65 },
});
