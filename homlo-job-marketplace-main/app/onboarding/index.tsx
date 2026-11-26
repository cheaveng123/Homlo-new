/**
 * app/onboarding/index.tsx
 *
 * First-run onboarding: the first screens a person sees the very first time
 * they open Homlo.
 *
 *   0  Welcome      illustration + "Get started" / "I already have an account"
 *   1  Work types   multi-select list
 *   2  Location     permission card, then search + map
 *   3  Availability day chips + time-of-day list
 *   4  Experience   single-select list (tapping a row moves on)
 *   5  All set      full-cyan summary + create account / explore as guest
 *
 * Question steps share one header: a back arrow and a rounded progress bar
 * that fills smoothly. Steps slide in from the side you are travelling to.
 * All motion uses the house no-bounce curve (src/design/motion.tsx) and is
 * switched off when the OS "Reduce motion" setting is on.
 *
 * What gets saved (keys, preference shape) and where the flow ends is
 * unchanged from the previous onboarding.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "@/lib/router";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import AuthWash from "@/components/auth/AuthWash";
import WelcomeScene from "@/components/auth/WelcomeScene";
import AllSetArt from "@/components/onboarding/AllSetArt";
import { ListGroup, OptionRow, type Tint } from "@/components/onboarding/OptionRow";
import { LocationQuestion } from "@/components/onboarding/LocationQuestion";
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import { multiSetLocalValue } from "@/lib/local-persistence";
import { ONBOARDING_COMPLETE_KEY, ONBOARDING_PREFERENCES_KEY, defaultOnboardingPreferences, type OnboardingPreferences } from "@/lib/onboarding";
import { fonts, familyForWeight } from "@/lib/typography";
import { HOME_JOB_TYPES, type HomeJobTypeKey } from "@/lib/job-types";
import { PressableScale, Reveal, SMOOTH, smooth } from "@/src/design/motion";

const C = {
  primary: "#0891B2",
  primaryDeep: "#0B6F8A",
  wash: "#DCF1F6",
  amber: "#F5A524",
  amberWash: "#FDF0D9",
  navy: "#14324A",
  navyWash: "#E3E9EE",
  ink: "#14324A",
  muted: "#6A7C84",
  faint: "#9AAAB1",
  line: "#E6EDEF",
  track: "#EEF3F4",
  bg: "#FFFFFF",
};

// The four job types used on Home (lib/job-types.ts), so onboarding matches them.
const JOB_TYPE_LOOK: Record<HomeJobTypeKey, { icon: IconName; tint: Tint; copy: string }> = {
  "part-time": { icon: "clock", tint: "cyan", copy: "A few hours around your day" },
  "full-time": { icon: "brief", tint: "navy", copy: "A steady, full-week role" },
  volunteer: { icon: "heart", tint: "amber", copy: "Give your time to a good cause" },
  weekends: { icon: "calendar", tint: "amber", copy: "Saturdays and Sundays only" },
};
const workOptions = HOME_JOB_TYPES.map((t) => ({ label: t.label, ...JOB_TYPE_LOOK[t.key] }));
const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeOptions: { label: string; icon: IconName; tint: Tint }[] = [
  { label: "Morning", icon: "sun", tint: "amber" },
  { label: "Afternoon", icon: "cup", tint: "cyan" },
  { label: "Evening", icon: "clock", tint: "navy" },
  { label: "Night", icon: "star", tint: "navy" },
];
const experienceOptions: { label: string; copy: string; icon: IconName; tint: Tint }[] = [
  { label: "No Experience", copy: "I’m just getting started", icon: "zap", tint: "amber" },
  { label: "Some Experience", copy: "I’ve done similar work before", icon: "brief", tint: "cyan" },
  { label: "Experienced", copy: "I have a lot of experience", icon: "star", tint: "navy" },
];

const QUESTION_STEPS = 4; // steps 1–4
const LAST = 5;

const QUESTIONS: Record<number, { title: string; sub: string }> = {
  1: { title: "I’m looking for…", sub: "Pick every kind of work you’re open to." },
  2: { title: "Where do you want to work?", sub: "Use your location or type the area you want to work in." },
  3: { title: "When can you work?", sub: "Choose your days and the time that suits you." },
  4: { title: "How much experience do you have?", sub: "This helps us recommend the right jobs." },
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Location starts empty so the location step is a real question.
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ ...defaultOnboardingPreferences, location: "", experience: "" });
  const [time, setTime] = useState("Morning");

  // ----- persistence + exits (unchanged behaviour) -----
  const persist = async () => {
    await multiSetLocalValue([
      [ONBOARDING_COMPLETE_KEY, "true"],
      [ONBOARDING_PREFERENCES_KEY, JSON.stringify({ ...preferences, time })],
    ]);
  };
  const afterAuthRoute = user ? (user.profileComplete ? "/" : "/complete-profile") : null;
  const finish = async () => {
    await persist();
    router.replace((afterAuthRoute ?? "/login") as never);
  };
  const goHome = async () => {
    await persist();
    router.replace((afterAuthRoute ?? "/") as never);
  };

  // ----- navigation -----
  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(LAST, next)));
  };
  const next = () => go(step + 1);
  const back = () => go(step - 1);

  const toggleWork = (value: string) =>
    setPreferences((current) => ({
      ...current,
      workTypes: current.workTypes.includes(value) ? current.workTypes.filter((item) => item !== value) : [...current.workTypes, value],
    }));
  const toggleDay = (value: string) =>
    setPreferences((current) => ({
      ...current,
      availability: current.availability.includes(value) ? current.availability.filter((item) => item !== value) : [...current.availability, value],
    }));

  const canContinue =
    step === 1 ? preferences.workTypes.length > 0 : step === 2 ? preferences.location.trim().length > 0 : step === 3 ? preferences.availability.length > 0 : step === 4 ? preferences.experience.length > 0 : true;


  // Step transitions: slide in from the side you're heading to, fade the old one out.
  const entering = reduce
    ? undefined
    : (dir > 0 ? SlideInRight : SlideInLeft).duration(360).easing(SMOOTH);
  const exiting = reduce ? undefined : FadeOut.duration(140);

  // ----- Welcome -----
  if (step === 0) {
    return (
      <View style={styles.root}>
        <AuthWash width={width} height={320 + insets.top} />
        <View style={[styles.welcome, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20 }]}>
          <Reveal index={0}>
            <Text style={styles.brand}>Homlo</Text>
          </Reveal>
          <View style={styles.welcomeArt}>
            <FloatingArt reduce={!!reduce}>
              <WelcomeScene width={Math.min(width - 24, 420)} />
            </FloatingArt>
          </View>
          <View style={styles.container}>
            <Reveal index={1}>
              <Text style={styles.welcomeTitle}>Time to find your next job!</Text>
            </Reveal>
            <Reveal index={2}>
              <Text style={styles.welcomeSub}>
                Answer four quick questions and we’ll show{"\n"}flexible jobs that fit your life.
              </Text>
            </Reveal>
            <Reveal index={3} style={{ marginTop: 28 }}>
              <PressableScale accessibilityRole="button" onPress={next} style={styles.cta}>
                <Text style={styles.ctaText}>Get started</Text>
              </PressableScale>
            </Reveal>
            <Reveal index={4} style={{ marginTop: 12 }}>
              <PressableScale
                accessibilityRole="button"
                disabled={authLoading}
                onPress={() => void finish()}
                style={styles.outlineBtn}
              >
                <Text style={styles.outlineBtnText}>I already have an account</Text>
              </PressableScale>
            </Reveal>
          </View>
        </View>
      </View>
    );
  }

  // ----- All set -----
  if (step === LAST) {
    return (
      <AllSet
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        reduce={!!reduce}
        preferences={preferences}
        time={time}
        signedIn={!!user}
        onCreate={() => void finish()}
        onExplore={() => void goHome()}
        onBack={back}
      />
    );
  }

  // ----- Question steps -----
  const q = QUESTIONS[step];
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
          <AppIcon name="back" size={22} strokeWidth={1.9} color={C.faint} />
        </Pressable>
        <ProgressBar value={step / (QUESTION_STEPS + 1)} reduce={!!reduce} />
        <Pressable
          onPress={() => go(LAST)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip the questions"
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View key={step} entering={entering} exiting={exiting} style={styles.stepBody}>
        <ScrollView contentContainerStyle={styles.questionScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.question} accessibilityRole="header">{q.title}</Text>
          <Text style={styles.questionSub}>{q.sub}</Text>

          {step === 1 && (
            <ListGroup>
              {workOptions.map((o, i) => (
                <OptionRow
                  key={o.label}
                  index={i}
                  last={i === workOptions.length - 1}
                  label={o.label}
                  copy={o.copy}
                  icon={o.icon}
                  tint={o.tint}
                  mode="check"
                  selected={preferences.workTypes.includes(o.label)}
                  onPress={() => toggleWork(o.label)}
                />
              ))}
            </ListGroup>
          )}

          {step === 2 && (
            <LocationQuestion
              value={preferences.location}
              onChange={(location) => setPreferences((current) => ({ ...current, location }))}
            />
          )}

          {step === 3 && (
            <>
              <Reveal index={0}>
                <Text style={styles.groupLabel}>DAYS</Text>
                <View style={styles.dayRow}>
                  {dayOptions.map((d) => (
                    <DayChip key={d} label={d} selected={preferences.availability.includes(d)} onPress={() => toggleDay(d)} />
                  ))}
                </View>
              </Reveal>
              <Reveal index={1}>
                <Text style={[styles.groupLabel, { marginTop: 26 }]}>TIME OF DAY</Text>
              </Reveal>
              <ListGroup compact>
                {timeOptions.map((o, i) => (
                  <OptionRow
                    key={o.label}
                    index={i + 2}
                    last={i === timeOptions.length - 1}
                    label={o.label}
                    icon={o.icon}
                    tint={o.tint}
                    mode="radio"
                    selected={time === o.label}
                    onPress={() => setTime(o.label)}
                  />
                ))}
              </ListGroup>
            </>
          )}

          {step === 4 && (
            <ListGroup>
              {experienceOptions.map((o, i) => (
                <OptionRow
                  key={o.label}
                  index={i}
                  last={i === experienceOptions.length - 1}
                  label={o.label}
                  copy={o.copy}
                  icon={o.icon}
                  tint={o.tint}
                  mode="radio"
                  selected={preferences.experience === o.label}
                  onPress={() => setPreferences((current) => ({ ...current, experience: o.label }))}
                />
              ))}
            </ListGroup>
          )}
        </ScrollView>
      </Animated.View>

      {(
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            disabled={!canContinue}
            onPress={next}
            style={[styles.cta, !canContinue && styles.ctaDisabled]}
          >
            <Text style={[styles.ctaText, !canContinue && styles.ctaTextDisabled]}>Continue</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */

function ProgressBar({ value, reduce }: { value: number; reduce: boolean }) {
  const [w, setW] = useState(0);
  const fill = useSharedValue(value);
  useEffect(() => {
    fill.value = reduce ? value : smooth(value, 420);
  }, [value, reduce, fill]);
  const st = useAnimatedStyle(() => ({ width: Math.max(18, fill.value * w) }));
  return (
    <View
      style={styles.progressTrack}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[styles.progressFill, st]}>
        <View style={styles.progressShine} />
      </Animated.View>
    </View>
  );
}

function DayChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scale={0.94}
      style={[styles.dayChip, selected && styles.dayChipOn]}
    >
      <Text style={[styles.dayText, selected && styles.dayTextOn]}>{label.slice(0, 2)}</Text>
    </PressableScale>
  );
}

/** Gentle 6pt up-and-down drift for the welcome illustration (no bounce). */
function FloatingArt({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  const y = useSharedValue(0);
  const o = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    o.value = withTiming(1, { duration: 600, easing: SMOOTH });
    y.value = withDelay(
      600,
      withRepeat(withSequence(withTiming(-6, { duration: 2200, easing: SMOOTH }), withTiming(0, { duration: 2200, easing: SMOOTH })), -1),
    );
  }, [reduce, o, y]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value + (1 - o.value) * 24 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** Soft twinkling sparkle for the "All set" screen. */
function Sparkle({ x, y, size, delay, reduce }: { x: number; y: number; size: number; delay: number; reduce: boolean }) {
  const o = useSharedValue(reduce ? 0.7 : 0.25);
  useEffect(() => {
    if (reduce) return;
    o.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 900, easing: SMOOTH }), withTiming(0.25, { duration: 900, easing: SMOOTH })), -1),
    );
  }, [delay, reduce, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: x, top: y, width: size, height: size, transform: [{ rotate: "45deg" }] }, st]}
    >
      <View style={{ flex: 1, borderRadius: size * 0.22, backgroundColor: "rgba(255,255,255,0.85)" }} />
    </Animated.View>
  );
}

function AllSet({
  insetsTop,
  insetsBottom,
  reduce,
  preferences,
  time,
  signedIn,
  onCreate,
  onExplore,
  onBack,
}: {
  insetsTop: number;
  insetsBottom: number;
  reduce: boolean;
  preferences: OnboardingPreferences;
  time: string;
  signedIn: boolean;
  onCreate: () => void;
  onExplore: () => void;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  const days = preferences.availability.length;
  const chips = [
    preferences.workTypes.length ? preferences.workTypes.slice(0, 2).join(" · ") + (preferences.workTypes.length > 2 ? ` +${preferences.workTypes.length - 2}` : "") : null,
    preferences.location.trim() || null,
    days ? `${days} day${days === 1 ? "" : "s"} · ${time}` : null,
    preferences.experience || null,
  ].filter(Boolean) as string[];
  const chipIcons: IconName[] = ["brief", "pin", "calendar", "star"];

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(320).easing(SMOOTH)} style={[styles.allSet, { paddingTop: insetsTop + 12, paddingBottom: insetsBottom + 20 }]}>
      <Sparkle x={width * 0.16} y={insetsTop + 110} size={10} delay={0} reduce={reduce} />
      <Sparkle x={width * 0.8} y={insetsTop + 90} size={8} delay={500} reduce={reduce} />
      <Sparkle x={width * 0.86} y={insetsTop + 300} size={11} delay={250} reduce={reduce} />
      <Sparkle x={width * 0.1} y={insetsTop + 330} size={8} delay={750} reduce={reduce} />

      <View style={styles.allSetTop}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
          <AppIcon name="back" size={22} strokeWidth={1.9} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <View style={styles.allSetBrandRow}>
          <Text style={styles.allSetBrand}>Homlo</Text>
          <View style={styles.allSetBadge}>
            <Text style={styles.allSetBadgeText}>READY</Text>
          </View>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.allSetArt}>
        <Animated.View entering={reduce ? undefined : ZoomIn.duration(520).delay(120).easing(SMOOTH)}>
          <AllSetArt size={Math.min(width * 0.62, 260)} />
        </Animated.View>
      </View>

      <View style={styles.container}>
        <Reveal index={1}>
          <Text style={styles.allSetTitle}>
            You’re all set! Let’s find your <Text style={{ color: "#FFD27A" }}>next job</Text>.
          </Text>
        </Reveal>
        <Reveal index={2}>
          <View style={styles.chipWrap}>
            {chips.map((c, i) => (
              <View key={c + i} style={styles.summaryChip}>
                <AppIcon name={chipIcons[i] ?? "check"} size={13} strokeWidth={2} color="#fff" />
                <Text style={styles.summaryChipText} numberOfLines={1}>{c}</Text>
              </View>
            ))}
          </View>
        </Reveal>
        <Reveal index={3} style={{ marginTop: 26 }}>
          <PressableScale accessibilityRole="button" onPress={signedIn ? onExplore : onCreate} style={styles.whiteBtn}>
            <Text style={styles.whiteBtnText}>{signedIn ? "Show my jobs" : "Create my account"}</Text>
          </PressableScale>
        </Reveal>
        {!signedIn && (
          <Reveal index={4}>
            <Pressable onPress={onExplore} hitSlop={8} style={styles.textBtn} accessibilityRole="button">
              <Text style={[styles.textBtnText, { color: "rgba(255,255,255,0.9)" }]}>Explore jobs first</Text>
            </Pressable>
          </Reveal>
        )}
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */

const shadow = {
  shadowColor: "#14324A",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { width: "100%", maxWidth: 420, alignSelf: "center", paddingHorizontal: 24 },

  // welcome
  welcome: { flex: 1, justifyContent: "space-between" },
  brand: { fontFamily: fonts.heading.extrabold, fontSize: 15, letterSpacing: 0.2, color: C.primaryDeep, textAlign: "center" },
  welcomeArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontFamily: fonts.heading.bold, fontSize: 28, letterSpacing: -0.5, color: C.ink, textAlign: "center" },
  welcomeSub: { fontFamily: familyForWeight("400"), fontSize: 14, lineHeight: 21, color: C.muted, textAlign: "center", marginTop: 10 },

  // buttons
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
  ctaText: { fontFamily: familyForWeight("700"), color: "#fff", fontSize: 15.5, letterSpacing: 0.2 },
  ctaDisabled: { backgroundColor: C.track, borderColor: C.line },
  ctaTextDisabled: { color: C.faint },
  outlineBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: C.line,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { fontFamily: familyForWeight("700"), color: C.primary, fontSize: 15, letterSpacing: 0.2 },
  textBtn: { alignSelf: "center", marginTop: 16, minHeight: 28, justifyContent: "center" },
  textBtnText: { fontFamily: familyForWeight("600"), color: C.muted, fontSize: 14 },

  // header
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 48 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  skipBtn: { minWidth: 36, alignItems: "flex-end" },
  skipText: { fontFamily: familyForWeight("600"), fontSize: 13, color: C.faint },
  progressTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: C.track, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 7, backgroundColor: C.primary },
  progressShine: { position: "absolute", left: 8, right: 8, top: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.35)" },

  // question body
  stepBody: { flex: 1 },
  questionScroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  question: { fontFamily: fonts.heading.bold, fontSize: 24, letterSpacing: -0.4, color: C.ink },
  questionSub: { fontFamily: familyForWeight("400"), fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 6 },


  groupLabel: { fontFamily: familyForWeight("700"), fontSize: 11.5, letterSpacing: 1, color: C.muted, marginTop: 22 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  dayChip: {
    width: 42,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: C.line,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipOn: { backgroundColor: C.primary, borderColor: C.primaryDeep },
  dayText: { fontFamily: familyForWeight("700"), fontSize: 14, color: C.ink },
  dayTextOn: { color: "#fff" },


  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: C.line, backgroundColor: C.bg },

  // all set
  allSet: { flex: 1, backgroundColor: C.primary, justifyContent: "space-between" },
  allSetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  allSetBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  allSetBrand: { fontFamily: fonts.heading.extrabold, fontSize: 24, letterSpacing: -0.3, color: "#fff" },
  allSetBadge: { backgroundColor: C.primaryDeep, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  allSetBadgeText: { fontFamily: familyForWeight("800"), fontSize: 11, letterSpacing: 1, color: "#fff" },
  allSetArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  allSetTitle: { fontFamily: fonts.heading.bold, fontSize: 24, lineHeight: 31, letterSpacing: -0.3, color: "#fff", textAlign: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 18 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  summaryChipText: { fontFamily: familyForWeight("600"), fontSize: 12.5, color: "#fff", flexShrink: 1 },
  whiteBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 3,
    borderColor: "#BFE6F0",
    alignItems: "center",
    justifyContent: "center",
  },
  whiteBtnText: { fontFamily: familyForWeight("700"), color: C.primaryDeep, fontSize: 15.5, letterSpacing: 0.2 },
});
