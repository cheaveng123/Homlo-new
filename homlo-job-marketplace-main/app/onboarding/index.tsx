import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { ONBOARDING_COMPLETE_KEY, defaultOnboardingPreferences, type OnboardingPreferences } from "@/lib/onboarding";
import { multiSetLocalValue } from "@/lib/local-persistence";
import { OnboardingLocationMap } from "@/components/onboarding-location-map";
import { useAuth } from "@/hooks/use-auth";
import { useUserLocation } from "@/lib/use-user-location";

const workOptions = [
  ["Part-time", "clock"], ["Full-time", "brief"], ["Internship", "grad"],
  ["Temporary", "arrow"], ["Weekend", "calendar"], ["Remote", "locate"],
] as const;
const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeOptions = ["Morning", "Afternoon", "Evening", "Night"];
const experienceOptions = [
  ["No Experience", "I’m just getting started", "circle-check"],
  ["Some Experience", "I’ve done similar work before", "brief"],
  ["Experienced", "I have a lot of experience", "user"],
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<OnboardingPreferences>(defaultOnboardingPreferences);
  const [time, setTime] = useState("Morning");
  const [locationPermissionPrompted, setLocationPermissionPrompted] = useState(false);
  const progress = (step + 1) / 6;
  const { permissionStatus, requestPermission, location: userLocation } = useUserLocation();

  const persist = async () => {
    await multiSetLocalValue([[ONBOARDING_COMPLETE_KEY, "true"], ["homlo.onboarding.preferences", JSON.stringify({ ...preferences, time })]]);
  };
  const finish = async () => { await persist(); router.replace(user ? (user.profileComplete ? "/" : "/complete-profile") : "/login" as never); };
  const goHome = async () => { await persist(); router.replace(user ? (user.profileComplete ? "/" : "/complete-profile") : "/" as never); };
  const toggleWork = (value: string) => setPreferences((current) => ({ ...current, workTypes: current.workTypes.includes(value) ? current.workTypes.filter((item) => item !== value) : [...current.workTypes, value] }));
  const toggleDay = (value: string) => setPreferences((current) => ({ ...current, availability: current.availability.includes(value) ? current.availability.filter((item) => item !== value) : [...current.availability, value] }));
  const canContinue = step === 1 ? preferences.workTypes.length > 0 : step === 2 ? preferences.location.trim().length > 0 : step === 3 ? preferences.availability.length > 0 : true;
  const title = useMemo(() => ["Find flexible jobs near you.", "What type of work are you looking for?", "Where are you looking for jobs?", "What’s your availability?", "What’s your experience level?", "Sign in to find your next job."][step], [step]);
  const subtitle = ["Discover part-time, temporary, or seasonal jobs that fit your time.", "You can choose more than one.", "We’ll show jobs near this location.", "Select the days and time you are available.", "This helps us recommend suitable jobs.", "Create a simple profile so we can personalize your experience."][step];

  const handleEnableLocation = useCallback(async () => {
    setLocationPermissionPrompted(true);
    const status = await requestPermission();
    if (status === "granted" && userLocation) {
      setPreferences((current) => ({ ...current, location: `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}` }));
    }
  }, [requestPermission, userLocation]);

  const handleMaybeLater = useCallback(() => {
    setLocationPermissionPrompted(true);
  }, []);

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-[#F7F8F6]" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable accessibilityLabel="Back" onPress={() => setStep((current) => Math.max(0, current - 1))} style={styles.iconButton}>
              <AppIcon name="back" size={21} color="#17201A" />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
          <View style={styles.progressTrack}>
            {[0, 1, 2, 3, 4].map((item) => (
              <View key={item} style={[styles.progressSegment, item < step ? styles.progressDone : item === step ? styles.progressCurrent : styles.progressIdle]} />
            ))}
          </View>
          <Pressable accessibilityLabel="Skip onboarding" disabled={authLoading} onPress={() => void finish()} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 0 ? <WelcomeArtwork /> : null}
          <Text style={[styles.title, step === 0 && styles.welcomeTitle]}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {step === 1 ? (
            <View style={styles.optionGrid}>
              {workOptions.map(([label, icon]) => (
                <OptionTile key={label} label={label} icon={icon} selected={preferences.workTypes.includes(label)} onPress={() => toggleWork(label)} />
              ))}
            </View>
          ) : null}
          {step === 2 ? (
            <View style={styles.locationBlock}>
              {permissionStatus === "undetermined" && !locationPermissionPrompted ? (
                <View style={styles.locationPermissionCard}>
                  <Text style={styles.locationPermissionTitle}>Find opportunities around you.</Text>
                  <Text style={styles.locationPermissionDescription}>
                    Allow Homlo to access your location to discover nearby jobs, explore opportunities around you, and get more relevant location-based results.
                  </Text>
                  <View style={styles.locationPermissionActions}>
                    <Pressable onPress={handleEnableLocation} style={styles.locationPermissionEnable}>
                      <Text style={styles.locationPermissionEnableText}>Enable Location</Text>
                    </Pressable>
                    <Pressable onPress={handleMaybeLater} style={styles.locationPermissionMaybeLater}>
                      <Text style={styles.locationPermissionMaybeLaterText}>Maybe Later</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.inputRow}>
                    <AppIcon name="search" size={18} color="#66736A" />
                    <TextInput
                      accessibilityLabel="Search your area"
                      onChangeText={(location) => setPreferences((current) => ({ ...current, location }))}
                      placeholder="Search your area"
                      placeholderTextColor="#94A098"
                      style={styles.locationInput}
                      value={preferences.location}
                    />
                  </View>
                  <OnboardingLocationMap location={preferences.location} onSelect={(location) => setPreferences((current) => ({ ...current, location }))} />
                </>
              )}
            </View>
          ) : null}
          {step === 3 ? (
            <AvailabilitySection availability={preferences.availability} time={time} onToggleDay={toggleDay} onSelectTime={setTime} />
          ) : null}
          {step === 4 ? (
            <View style={styles.sectionStack}>
              {experienceOptions.map(([label, copy, icon]) => (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: preferences.experience === label }}
                  onPress={() => setPreferences((current) => ({ ...current, experience: label }))}
                  style={[styles.experienceCard, preferences.experience === label && styles.experienceSelected]}
                >
                  <View style={styles.experienceIcon}>
                    <AppIcon name={icon} size={18} color="#16803C" />
                  </View>
                  <View style={styles.experienceCopy}>
                    <Text style={styles.experienceTitle}>{label}</Text>
                    <Text style={styles.experienceSubtitle}>{copy}</Text>
                  </View>
                  <AppIcon name={preferences.experience === label ? "circle-check" : "target"} size={20} color={preferences.experience === label ? "#16803C" : "#B7C2BB"} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {step === 5 ? <LoginHandoff onContinue={() => void finish()} onHome={() => void goHome()} /> : null}
        </ScrollView>
        <View style={styles.footer}>
          {step === 5 ? null : (
            <Pressable
              accessibilityRole="button"
              disabled={!canContinue || authLoading}
              onPress={() => setStep((current) => Math.min(5, current + 1))}
              style={({ pressed }) => [styles.primaryButton, (!canContinue || authLoading) && styles.disabledButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{step === 0 ? "Get Started" : "Continue"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

function WelcomeArtwork() {
  return (
    <View style={styles.welcomeArtwork}>
      <View style={styles.cityShape} />
      <View style={styles.personCircle}>
        <AppIcon name="user" size={58} color="#0F5C2B" />
      </View>
      <View style={styles.leafOne} />
      <View style={styles.leafTwo} />
    </View>
  );
}

function OptionTile({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.optionTile, selected && styles.optionSelected]}>
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <AppIcon name={icon} size={20} color={selected ? "#FFFFFF" : "#16803C"} />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

function ChoiceChip({ label, selected, onPress, wide = false }: { label: string; selected: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, wide && styles.choiceWide, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function AvailabilitySection({ availability, time, onToggleDay, onSelectTime }: { availability: string[]; time: string; onToggleDay: (day: string) => void; onSelectTime: (value: string) => void }) {
  return (
    <View style={styles.availabilityStack}>
      <View style={styles.availabilityCard}>
        <Text style={styles.cardEyebrow}>YOUR WEEK</Text>
        <Text style={styles.cardTitle}>Which days can you work?</Text>
        <Text style={styles.cardCaption}>Choose all that fit your schedule.</Text>
        <View style={styles.chipWrap}>
          {dayOptions.map((day) => (
            <ChoiceChip key={day} label={day} selected={availability.includes(day)} onPress={() => onToggleDay(day)} />
          ))}
        </View>
      </View>
      <View style={styles.availabilityCard}>
        <Text style={styles.cardEyebrow}>YOUR DAY</Text>
        <Text style={styles.cardTitle}>What time suits you?</Text>
        <Text style={styles.cardCaption}>You can update this later.</Text>
        <View style={styles.timeGrid}>
          {timeOptions.map((value) => (
            <ChoiceChip key={value} label={value} selected={time === value} onPress={() => onSelectTime(value)} wide />
          ))}
        </View>
      </View>
    </View>
  );
}

function LoginHandoff({ onContinue, onHome }: { onContinue: () => void; onHome: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.loginHandoff}>
      <View style={styles.completionArtwork}>
        <AppIcon name="user" size={48} color="#16803C" />
      </View>
      <Text style={styles.completionTitle}>Almost there.</Text>
      <Text style={styles.loginCopy}>Sign in to save jobs, apply faster, and keep your recommendations with you.</Text>
      <Pressable accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.primaryButton, styles.loginButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>Continue to Login</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onHome} style={styles.homeLink}>
        <Text style={styles.homeLinkText}>Skip for now and go to Home</Text>
      </Pressable>
    </Animated.View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22 },
  topRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingTop: 8 },
  iconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 30 },
  skipButton: { alignItems: "flex-end", justifyContent: "center", minWidth: 40 },
  skipText: { color: "#66736A", fontSize: 12, fontWeight: "700" },
  progressTrack: { flex: 1, flexDirection: "row", gap: 4 },
  progressSegment: { borderRadius: 3, flex: 1, height: 4 },
  progressDone: { backgroundColor: "#16803C" },
  progressCurrent: { backgroundColor: "#22A447" },
  progressIdle: { backgroundColor: "#DDE6DF" },
  content: { flexGrow: 1, paddingBottom: 34, paddingTop: 16 },
  welcomeArtwork: { alignItems: "center", backgroundColor: "#E7F5E9", borderRadius: 30, height: 238, justifyContent: "flex-end", marginBottom: 26, overflow: "hidden", position: "relative" },
  cityShape: { backgroundColor: "#CBEBCF", bottom: 0, height: 90, left: 0, position: "absolute", right: 0 },
  personCircle: { alignItems: "center", backgroundColor: "#D9F1DD", borderRadius: 64, height: 128, justifyContent: "center", marginBottom: 26, width: 128 },
  leafOne: { backgroundColor: "#A7DBAF", borderRadius: 30, height: 34, position: "absolute", right: 25, top: 45, transform: [{ rotate: "-20deg" }], width: 70 },
  leafTwo: { backgroundColor: "#BFE8C5", borderRadius: 24, height: 28, left: 22, position: "absolute", top: 85, transform: [{ rotate: "18deg" }], width: 60 },
  title: { color: "#17201A", fontSize: 27, fontWeight: "800", letterSpacing: -0.6, lineHeight: 33 },
  welcomeTitle: { fontSize: 28, textAlign: "center" },
  subtitle: { color: "#66736A", fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  optionTile: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 14, borderWidth: 1, height: 112, justifyContent: "center", width: "47%" },
  optionSelected: { backgroundColor: "#F0FAF1", borderColor: "#22A447" },
  optionIcon: { alignItems: "center", justifyContent: "center", height: 44, width: 44 },
  optionIconSelected: { backgroundColor: "#22A447", borderRadius: 12 },
  optionLabel: { color: "#17201A", fontSize: 12, fontWeight: "600", marginTop: 8 },
  locationBlock: { marginTop: 24 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  locationInput: { flex: 1, color: "#17201A", fontSize: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#DCE5E0", borderRadius: 10 },
  locationPermissionCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 16, alignItems: "center" },
  locationPermissionTitle: { color: "#17201A", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  locationPermissionDescription: { color: "#66736A", fontSize: 13.5, lineHeight: 19, textAlign: "center", marginBottom: 20 },
  locationPermissionActions: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  locationPermissionEnable: { flex: 1, backgroundColor: "#16803C", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  locationPermissionEnableText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  locationPermissionMaybeLater: { flex: 1, backgroundColor: "#F7F8F6", borderWidth: 1, borderColor: "#DCE5DF", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  locationPermissionMaybeLaterText: { color: "#66736A", fontSize: 14, fontWeight: "700" },
  sectionStack: { marginTop: 24 },
  experienceCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  experienceSelected: { backgroundColor: "#F0FAF1", borderColor: "#22A447" },
  experienceIcon: { alignItems: "center", justifyContent: "center", width: 36 },
  experienceCopy: { flex: 1 },
  experienceTitle: { color: "#17201A", fontSize: 14, fontWeight: "700" },
  experienceSubtitle: { color: "#66736A", fontSize: 11, lineHeight: 15 },
  availabilityStack: { marginTop: 24 },
  availabilityCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 12 },
  cardEyebrow: { color: "#66736A", fontSize: 10, fontWeight: "700", marginBottom: 4 },
  cardTitle: { color: "#17201A", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  cardCaption: { color: "#66736A", fontSize: 12, lineHeight: 16, marginBottom: 12 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeGrid: { flexDirection: "row", gap: 8 },
  choiceChip: { backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  choiceWide: { flex: 1 },
  choiceSelected: { backgroundColor: "#F0FAF1", borderColor: "#22A447" },
  choiceText: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  choiceTextSelected: { color: "#16803C" },
  loginHandoff: { alignItems: "center", paddingVertical: 24 },
  completionArtwork: { alignItems: "center", marginBottom: 16 },
  completionTitle: { color: "#17201A", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  loginCopy: { color: "#66736A", fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 20, paddingHorizontal: 20 },
  primaryButton: { backgroundColor: "#16803C", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  disabledButton: { backgroundColor: "#DDE6DF" },
  loginButton: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5DF", marginTop: 10 },
  pressed: { opacity: 0.8 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  homeLink: { marginTop: 12 },
  homeLinkText: { color: "#66736A", fontSize: 13, fontWeight: "600" },
  footer: { paddingHorizontal: 22, paddingBottom: 24, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  summaryLabel: { color: "#66736A", fontSize: 12 },
  summaryValue: { color: "#17201A", fontSize: 13, fontWeight: "600" },
});
