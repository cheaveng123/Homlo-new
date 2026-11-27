/**
 * app/login.tsx
 *
 * Sign in / sign up screen. Layout follows the clean form-first auth pattern
 * (soft tinted header wash, centred title, segmented mode switch, outlined
 * fields with leading line icons, full-width primary button, divider + secondary
 * action, footer switch link) in Homlo's own palette.
 *
 * The logic (handlers, API calls, validation, loading, error/notice branches,
 * mode switching and navigation) is unchanged from the previous version.
 */
import { ConsentCheckbox, LegalFooter } from "@/components/legal/LegalUI";
import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "@/lib/router";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";
import { fonts, familyForWeight } from "@/lib/typography";
import AuthWash from "@/components/auth/AuthWash";
import WelcomeScene from "@/components/auth/WelcomeScene";
import { PressableScale, Reveal, SMOOTH, smooth, useShake } from "@/src/design/motion";

// Homlo palette (theme/tokens.ts)
const C = {
  primary: "#0891B2", // mint500
  primaryDeep: "#0B6F8A", // mint700
  wash: "#DCF1F6", // mint100
  amber: "#F5A524",
  amberWash: "#FDF0D9",
  ink: "#14324A", // forest900
  muted: "#6A7C84",
  placeholder: "#9AAAB1",
  line: "#E6EDEF",
  field: "#FFFFFF",
  bg: "#FFFFFF",
  segment: "#F3F6F5",
  error: "#B42318",
  errorBg: "#FEF3F2",
  success: "#0B6F8A",
  successBg: "#EEF7FA",
};

const FIELD_H = 52;
const SEG_W = 120;
const RADIUS = 12;

type Mode = "signIn" | "signUp";
type FocusKey = "name" | "email" | "password" | null;

function Field({
  icon,
  focused,
  trailing,
  ...input
}: TextInputProps & { icon: IconName; focused: boolean; trailing?: React.ReactNode }) {
  return (
    <View style={[styles.field, focused && styles.fieldFocus]}>
      <AppIcon name={icon} size={19} strokeWidth={1.6} color={focused ? C.primary : C.muted} />
      <TextInput style={styles.input} placeholderTextColor={C.placeholder} {...input} />
      {trailing}
    </View>
  );
}

/** The cyan pill behind the active Log In / Sign Up tab; slides between them. */
function SegmentPill({ index, reduce }: { index: number; reduce: boolean }) {
  const x = useSharedValue(index * SEG_W);
  useEffect(() => {
    x.value = reduce ? index * SEG_W : smooth(index * SEG_W, 280);
  }, [index, reduce, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.segmentPill, st]} />;
}

export default function LoginScreen() {
  const router = useRouter();
  const { completeSignIn } = useAuth({ autoFetch: false });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Legal consent: both start unticked. The 18+/Terms box is required (also
  // enforced by the server); marketing is optional.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focus, setFocus] = useState<FocusKey>(null);
  const [showPw, setShowPw] = useState(false);
  const [stage, setStage] = useState<"welcome" | "form">("welcome");
  const isSignUp = mode === "signUp";
  const reduce = useReducedMotion();
  const { style: shakeStyle, shake } = useShake();
  // Shake the form whenever a new error appears.
  useEffect(() => {
    if (error) shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  const fieldLayout = reduce ? undefined : LinearTransition.duration(260).easing(SMOOTH);

  const openForm = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setStage("form");
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
  };

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
    if (mode === "signUp" && !acceptTerms) {
      setError("Confirm that you are 18 or older and agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      let result =
        mode === "signIn"
          ? await Api.signInWithEmailPassword({ email: normalizedEmail, password })
          : await Api.signUpWithEmailPassword({
              email: normalizedEmail,
              password,
              fullName: fullName.trim() || undefined,
              acceptTerms: true,
              marketingOptIn,
            });
      if ("confirmationRequired" in result) {
        // Auto-login on account creation: the server normally returns a live
        // session. If it could only create the account, sign in with the same
        // credentials here before falling back to asking the person to log in.
        const fallbackMessage = result.message;
        try {
          result = await Api.signInWithEmailPassword({ email: normalizedEmail, password });
        } catch {
          setNotice(fallbackMessage);
          setMode("signIn");
          return;
        }
      }
      const user = await completeSignIn(result);
      // A brand-new account starts with the age step; an existing account
      // with an unfinished profile resumes at complete-profile (which sends it
      // to /age first if no age was recorded).
      const next = user.profileComplete ? "/" : mode === "signUp" ? "/age" : "/complete-profile";
      router.replace(next as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete your secure sign-in.");
    } finally {
      setSubmitting(false);
    }
  };

  const washH = 300 + insets.top;
  const focusProps = (key: Exclude<FocusKey, null>) => ({
    onFocus: () => setFocus(key),
    onBlur: () => setFocus(null),
  });

  const wash = <AuthWash width={width} height={washH} />;

  if (stage === "welcome") {
    return (
      <View style={styles.root}>
        {wash}
        <ScrollView
          contentContainerStyle={[styles.welcomeScroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Reveal index={0}>
            <Text style={styles.brand}>Homlo</Text>
          </Reveal>

          <View style={styles.welcomeHero}>
            <WelcomeScene width={Math.min(width - 24, 420)} />
          </View>

          <View style={styles.container}>
            <Reveal index={1}>
              <Text style={styles.welcomeTitle}>Find Work Near You</Text>
            </Reveal>
            <Reveal index={2}>
              <Text style={styles.welcomeSub}>
                Discover jobs around you, apply in a tap,{"\n"}or hire people for your business.
              </Text>
            </Reveal>

            <Reveal index={3}>
              <View style={styles.dots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
              </View>
            </Reveal>

            <Reveal index={4}>
              <PressableScale accessibilityRole="button" onPress={() => openForm("signIn")} style={[styles.cta, { marginTop: 0 }]}>
                <Text style={styles.ctaText}>Log In</Text>
              </PressableScale>
            </Reveal>
            <Reveal index={5}>
              <PressableScale accessibilityRole="button" onPress={() => openForm("signUp")} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>Sign Up</Text>
              </PressableScale>
            </Reveal>

            <Reveal index={6}>
              <PressableScale scale={0.95} onPress={() => router.replace("/" as never)} hitSlop={8} style={styles.guestLink} accessibilityRole="link">
                <Text style={styles.guestLinkText}>Explore jobs as a guest</Text>
              </PressableScale>
            </Reveal>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {wash}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduce ? undefined : FadeIn.duration(320).easing(SMOOTH)} style={styles.container}>
          {/* Header */}
          <View style={[styles.backWrap, { top: -32 }]}>
            <PressableScale
              onPress={() => setStage("welcome")}
              hitSlop={10}
              scale={0.9}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <AppIcon name="back" size={20} strokeWidth={1.8} color={C.ink} />
            </PressableScale>
          </View>
          <Text style={styles.brand}>Homlo</Text>
          <Animated.View key={mode} entering={reduce ? undefined : FadeIn.duration(240).easing(SMOOTH)}>
            <Text style={styles.title}>{isSignUp ? "Sign Up" : "Log In"}</Text>
            <Text style={styles.sub}>
              {isSignUp
                ? "Please provide the details below to\ncreate your account"
                : "Please provide the details below to log in"}
            </Text>
          </Animated.View>

          {/* Segmented mode switch */}
          <View style={styles.segment} accessibilityRole="tablist">
            <SegmentPill index={isSignUp ? 1 : 0} reduce={!!reduce} />
            {(["signIn", "signUp"] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => switchMode(m)}
                  style={styles.segmentItem}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {m === "signIn" ? "Log In" : "Sign Up"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Fields */}
          <Animated.View style={[styles.form, shakeStyle]}>
            {isSignUp && (
              <Animated.View
                entering={reduce ? undefined : FadeIn.duration(240).easing(SMOOTH)}
                exiting={reduce ? undefined : FadeOut.duration(140)}
              >
              <Field
                icon="user"
                focused={focus === "name"}
                placeholder="Full Name (optional)"
                autoCapitalize="words"
                textContentType="name"
                value={fullName}
                onChangeText={setFullName}
                {...focusProps("name")}
              />
              </Animated.View>
            )}

            <Animated.View layout={fieldLayout}>
            <Field
              icon="mail"
              focused={focus === "email"}
              placeholder="Enter Your Email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              {...focusProps("email")}
            />
            </Animated.View>

            <Animated.View layout={fieldLayout}>
            <Field
              icon="lock"
              focused={focus === "password"}
              placeholder={isSignUp ? "New Password (8+ characters)" : "Enter Your Password"}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isSignUp ? "newPassword" : "password"}
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
              {...focusProps("password")}
              trailing={
                <Pressable
                  onPress={() => setShowPw((s) => !s)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPw ? "Hide password" : "Show password"}
                >
                  <Animated.View key={showPw ? "on" : "off"} entering={reduce ? undefined : ZoomIn.duration(180).easing(SMOOTH)}>
                    <AppIcon name={showPw ? "eye" : "eye-off"} size={19} strokeWidth={1.6} color={C.muted} />
                  </Animated.View>
                </Pressable>
              }
            />
            </Animated.View>
          </Animated.View>

          {isSignUp && (
            <Animated.View layout={fieldLayout} entering={reduce ? undefined : FadeIn.duration(220).easing(SMOOTH)}>
              <ConsentCheckbox label={CONSENT_WORDING.signup} checked={acceptTerms} onChange={setAcceptTerms} testID="signup-terms" />
              <ConsentCheckbox label={CONSENT_WORDING.marketing} checked={marketingOptIn} onChange={setMarketingOptIn} required={false} testID="signup-marketing" />
            </Animated.View>
          )}

          {error && (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(220).easing(SMOOTH)} layout={fieldLayout} style={[styles.alert, styles.alertError]} accessibilityRole="alert">
              <AppIcon name="alert" size={16} strokeWidth={1.8} color={C.error} />
              <Text style={[styles.alertText, { color: C.error }]}>{error}</Text>
            </Animated.View>
          )}
          {notice && (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(220).easing(SMOOTH)} layout={fieldLayout} style={[styles.alert, styles.alertNotice]} accessibilityRole="alert">
              <AppIcon name="circle-check" size={16} strokeWidth={1.8} color={C.success} />
              <Text style={[styles.alertText, { color: C.success }]}>{notice}</Text>
            </Animated.View>
          )}

          {/* Primary action */}
          <Animated.View layout={fieldLayout}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? "Create Homlo account" : "Log in to Homlo"}
            accessibilityState={{ busy: submitting }}
            disabled={submitting}
            onPress={submit}
            style={[styles.cta, submitting && styles.disabled]}
          >
            {submitting ? (
              <View style={styles.ctaBusy}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.ctaText}>Securing your account…</Text>
              </View>
            ) : (
              <Animated.Text key={mode} entering={reduce ? undefined : FadeIn.duration(200)} style={styles.ctaText}>
                {isSignUp ? "Create Account" : "Log In"}
              </Animated.Text>
            )}
          </PressableScale>
          </Animated.View>

          {/* Divider */}
          <Animated.View layout={fieldLayout} style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or Continue With</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Secondary action */}
          <Animated.View layout={fieldLayout}>
            <PressableScale accessibilityRole="button" onPress={() => router.replace("/" as never)} style={styles.secondary}>
              <AppIcon name="search" size={19} strokeWidth={1.8} color={C.ink} />
              <Text style={styles.secondaryText}>Explore jobs as a guest</Text>
            </PressableScale>
          </Animated.View>

          {/* Footer switch */}
          <Animated.View layout={fieldLayout} style={styles.altRow}>
            <Text style={styles.altText}>{isSignUp ? "Have an account? " : "Don’t have an account? "}</Text>
            <PressableScale scale={0.92} onPress={() => switchMode(isSignUp ? "signIn" : "signUp")} hitSlop={8} accessibilityRole="link">
              <Text style={styles.link}>{isSignUp ? "Log in" : "Sign up"}</Text>
            </PressableScale>
          </Animated.View>

          <Animated.View layout={fieldLayout} style={styles.secureRow}>
            <AppIcon name="pw" size={14} strokeWidth={1.6} color={C.placeholder} />
            <Text style={styles.footerText}>Secured by Homlo’s account service</Text>
          </Animated.View>
          <LegalFooter />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  container: { width: "100%", maxWidth: 420, alignSelf: "center" },

  brand: {
    fontFamily: fonts.heading.extrabold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: C.primaryDeep,
    textAlign: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.heading.bold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: C.ink,
    textAlign: "center",
  },
  sub: {
    fontFamily: familyForWeight("400"),
    fontSize: 13.5,
    lineHeight: 20,
    color: C.muted,
    textAlign: "center",
    marginTop: 8,
  },

  segment: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 4,
    marginTop: 22,
    marginBottom: 26,
  },
  segmentPill: {
    position: "absolute",
    left: 4,
    top: 4,
    width: SEG_W,
    height: 38,
    borderRadius: 9,
    backgroundColor: C.primary,
  },
  segmentItem: {
    width: SEG_W,
    height: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontFamily: familyForWeight("600"), fontSize: 14, color: C.muted },
  segmentTextActive: { color: "#fff" },

  form: { gap: 12 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: FIELD_H,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    gap: 10,
  },
  fieldFocus: { borderColor: C.primary, borderWidth: 1.5 },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: familyForWeight("500"),
    fontSize: 14.5,
    color: C.ink,
    paddingVertical: 0,
  },

  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  alertError: { backgroundColor: C.errorBg },
  alertNotice: { backgroundColor: C.successBg },
  alertText: { flex: 1, fontFamily: familyForWeight("500"), fontSize: 13, lineHeight: 18 },

  cta: {
    height: FIELD_H,
    borderRadius: RADIUS,
    backgroundColor: C.primary,
    borderWidth: 1,
    borderColor: C.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  ctaBusy: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctaText: { fontFamily: familyForWeight("600"), color: "#fff", fontSize: 15.5 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26, marginBottom: 18 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#D5DEE1" },
  dividerText: { fontFamily: familyForWeight("400"), fontSize: 12.5, color: C.muted },

  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: FIELD_H,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.field,
  },
  secondaryText: { fontFamily: familyForWeight("600"), fontSize: 14.5, color: C.ink },

  altRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28 },
  altText: { fontFamily: familyForWeight("400"), fontSize: 13.5, color: C.muted },
  link: {
    fontFamily: familyForWeight("600"),
    fontSize: 13.5,
    color: C.amber,
    textDecorationLine: "underline",
    textDecorationColor: C.amber,
  },

  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  footerText: { fontFamily: familyForWeight("400"), color: C.placeholder, fontSize: 11.5 },

  // Welcome step
  welcomeScroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  welcomeHero: { flexGrow: 1, justifyContent: "center", alignItems: "center", marginVertical: 12, marginHorizontal: -24 },
  welcomeTitle: {
    fontFamily: fonts.heading.bold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: C.ink,
    textAlign: "center",
  },
  welcomeSub: {
    fontFamily: familyForWeight("400"),
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
    marginTop: 10,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 22, marginBottom: 28 },
  dot: { width: 14, height: 4, borderRadius: 2, backgroundColor: C.line },
  dotActive: { width: 22, backgroundColor: C.amber },
  outlineBtn: {
    height: FIELD_H,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  outlineBtnText: { fontFamily: familyForWeight("600"), color: C.primary, fontSize: 15.5 },
  guestLink: { alignSelf: "center", marginTop: 18, minHeight: 28, justifyContent: "center" },
  guestLinkText: { fontFamily: familyForWeight("600"), color: C.muted, fontSize: 13.5, textDecorationLine: "underline" },
  backWrap: { position: "absolute", left: 0, zIndex: 5 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
