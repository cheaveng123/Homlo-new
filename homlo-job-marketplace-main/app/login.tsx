/**
 * app/login.tsx
 *
 * This is a VISUAL restyle of the existing login screen ONLY. The logic here
 * (handlers, hooks, API calls, validation, loading, error/notice branches,
 * mode toggles and navigation) is preserved exactly as it was.
 */
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";
import { fonts, familyForWeight } from "@/lib/typography";
import Floating from "@/components/auth/Floating";
import {
  BriefcaseArt,
  PinArt,
  Character1Art,
  Character2Art,
  JobCardArt,
  SearchArt,
  LaptopArt,
  CalendarArt,
  SparkArt,
} from "@/components/auth/art";

const C = {
  green: "#0B6F8A",
  deep: "#0A4A3A",
  cream: "#F6F2E9",
  amber: "#F0B04A",
  mist: "#CFE0D8",
  ink: "#17302A",
  muted: "#6B7D76",
  sheet: "#FCFBF7",
  line: "#E4E8E2",
};

const FIELD_H = 54;
const RADIUS_FIELD = FIELD_H / 2;
const BUTTON_H = 54;
const RADIUS_BUTTON = BUTTON_H / 2;

export default function LoginScreen() {
  const router = useRouter();
  const { completeSignIn } = useAuth({ autoFetch: false });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width, 430) / 390;
  const small = width < 375;

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focus, setFocus] = useState<"name" | "email" | "password" | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter your email address and password to continue.");
      return;
    }
    if (mode === "signUp" && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result =
        mode === "signIn"
          ? await Api.signInWithEmailPassword({ email: normalizedEmail, password })
          : await Api.signUpWithEmailPassword({
              email: normalizedEmail,
              password,
              fullName: fullName.trim() || undefined,
            });
      if ("confirmationRequired" in result) {
        setNotice(result.message);
        setMode("signIn");
        return;
      }
      const user = await completeSignIn(result);
      router.replace((user.profileComplete ? "/" : "/complete-profile") as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete your secure sign-in.");
    } finally {
      setSubmitting(false);
    }
  };

  const at = (left: number, top: number): ViewStyle => ({ left: left * k, top: top * k });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.blob, { width: 260 * k, height: 260 * k, left: -110 * k, top: 90 * k, backgroundColor: "#EDE5D0" }]} />
        <View style={[styles.blob, { width: 200 * k, height: 200 * k, right: -80 * k, top: -40 * k, backgroundColor: "#E3EBDD" }]} />

        <View style={{ height: 342 * k }}>
          <Text style={[styles.logo, { top: Math.max(insets.top + 10, 50 * k) }]}>Homlo</Text>

          {!small && (
            <Floating style={at(26, 116)} rotate={-8} amp={5} duration={7000} reduceMotion={reduceMotion}>
              <BriefcaseArt size={50 * k} />
            </Floating>
          )}
          <Floating style={at(292, 96)} mode="bounce" amp={9} reduceMotion={reduceMotion}>
            <PinArt size={68 * k} />
          </Floating>

          <Floating style={{ ...at(34, 140), zIndex: 2 }} mode="sway" amp={3} duration={5000} reduceMotion={reduceMotion}>
            <Character1Art size={112 * k} />
          </Floating>
          <Floating style={at(small ? 128 : 134, 186)} rotate={-7} amp={6} duration={6000} delay={800} reduceMotion={reduceMotion}>
            <JobCardArt size={(small ? 80 : 96) * k} />
          </Floating>
          <Floating style={at(236, 148)} amp={6} duration={4500} delay={400} reduceMotion={reduceMotion}>
            <SearchArt size={34 * k} />
          </Floating>
          <Floating style={{ ...at(262, 150), zIndex: 2 }} mode="sway" amp={3} duration={5500} delay={1200} reduceMotion={reduceMotion}>
            <Character2Art size={108 * k} />
          </Floating>
          <Floating style={at(208, 276)} rotate={4} amp={5} duration={6000} delay={1500} reduceMotion={reduceMotion}>
            <LaptopArt size={70 * k} />
          </Floating>

          <Floating style={at(92, 96)} mode="shine" duration={4000} reduceMotion={reduceMotion}>
            <SparkArt size={22 * k} />
          </Floating>
          {!small && (
            <Floating style={at(180, 126)} mode="shine" duration={4000} delay={2000} reduceMotion={reduceMotion}>
              <SparkArt size={22 * k} flip />
            </Floating>
          )}
        </View>

        <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
          <Text style={styles.title}>{mode === "signUp" ? "Create your account" : "Sign in to your account"}</Text>
          <Text style={styles.sub}>{mode === "signUp" ? "Join Homlo in a minute." : "Find work or hire people near you."}</Text>

          {mode === "signUp" && (
            <View style={[styles.field, focus === "name" && styles.fieldFocus]}>
              <AppIcon name="user" size={20} color={C.green} />
              <TextInput
                style={styles.input}
                placeholder="Full name (optional)"
                placeholderTextColor="#9AA8A2"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocus("name")}
                onBlur={() => setFocus(null)}
              />
            </View>
          )}

          <View style={[styles.field, focus === "email" && styles.fieldFocus]}>
            <AppIcon name="mail" size={20} color={C.green} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9AA8A2"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus("email")}
              onBlur={() => setFocus(null)}
            />
          </View>

          <View style={[styles.field, focus === "password" && styles.fieldFocus]}>
            <AppIcon name="lock" size={20} color={C.green} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9AA8A2"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={mode === "signUp" ? "newPassword" : "password"}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocus("password")}
              onBlur={() => setFocus(null)}
            />
            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} accessibilityLabel={showPw ? "Hide password" : "Show password"}>
              {showPw ? <AppIcon name="eye-off" size={20} color={C.muted} /> : <AppIcon name="eye" size={20} color={C.muted} />}
            </Pressable>
          </View>

          {error && (
            <Text accessibilityRole="alert" style={styles.alertError}>
              {error}
            </Text>
          )}
          {notice && (
            <Text accessibilityRole="alert" style={styles.alertNotice}>
              {notice}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "signIn" ? "Sign in to Homlo" : "Create Homlo account"}
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [styles.cta, (pressed || submitting) && styles.pressed, submitting && styles.disabled]}
          >
            <Text style={styles.ctaText}>{submitting ? "Securing your account…" : mode === "signIn" ? "Sign in" : "Sign up"}</Text>
          </Pressable>

          <View style={styles.altRow}>
            <Text style={styles.altText}>{mode === "signIn" ? "Don’t have an account? " : "Already have an account? "}</Text>
            <Pressable
              onPress={() => {
                setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
                setError(null);
                setNotice(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.link}>{mode === "signIn" ? "Sign up" : "Sign in"}</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace("/" as never)} style={styles.guestLink} hitSlop={8}>
            <Text style={styles.guestLinkText}>Explore jobs as a guest</Text>
          </Pressable>

          <Text style={styles.footerText}>Your password and authentication tokens are handled only through Homlo’s secure account service.</Text>

          <Floating style={{ left: 14 * k, bottom: 16 * k + insets.bottom }} rotate={-8} amp={5} duration={7000} delay={500} reduceMotion={reduceMotion}>
            <CalendarArt size={50 * k} />
          </Floating>
          {!small && (
            <Floating style={{ right: 24 * k, bottom: 30 * k + insets.bottom }} mode="shine" duration={4000} delay={1000} reduceMotion={reduceMotion}>
              <SparkArt size={20 * k} />
            </Floating>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  scroll: { flexGrow: 1, backgroundColor: C.cream },
  blob: { position: "absolute", borderRadius: 999, opacity: 0.7 },
  logo: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: fonts.heading.extrabold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: C.deep,
    zIndex: 3,
  },
  sheet: {
    flex: 1,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 26,
    zIndex: 3,
    ...Platform.select({
      ios: { shadowColor: C.ink, shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
      android: { elevation: 8 },
    }),
  },
  title: {
    fontFamily: fonts.heading.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: C.ink,
    textAlign: "center",
  },
  sub: {
    fontFamily: familyForWeight("500"),
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: FIELD_H,
    borderRadius: RADIUS_FIELD,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 10,
  },
  fieldFocus: { borderColor: C.green },
  input: {
    flex: 1,
    fontFamily: familyForWeight("500"),
    fontSize: 15,
    color: C.ink,
    paddingVertical: 0,
  },
  alertError: {
    fontFamily: familyForWeight("400"),
    color: "#B42318",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },
  alertNotice: {
    fontFamily: familyForWeight("400"),
    color: "#236B3A",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },
  cta: {
    height: BUTTON_H,
    borderRadius: RADIUS_BUTTON,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 4 },
    }),
  },
  ctaText: {
    fontFamily: familyForWeight("600"),
    color: "#fff",
    fontSize: 16,
  },
  altRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  altText: {
    fontFamily: familyForWeight("400"),
    fontSize: 14,
    color: C.muted,
  },
  link: {
    fontFamily: familyForWeight("600"),
    color: C.green,
    fontSize: 13.5,
  },
  guestLink: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    minHeight: 32,
  },
  guestLinkText: {
    fontFamily: familyForWeight("600"),
    color: C.green,
    fontSize: 14,
  },
  footerText: {
    fontFamily: familyForWeight("400"),
    color: "#859087",
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 12,
  },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.65 },
});
