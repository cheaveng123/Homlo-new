import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";

export default function LoginScreen() {
  const router = useRouter();
  const { completeSignIn } = useAuth({ autoFetch: false });
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const result = mode === "signIn"
        ? await Api.signInWithEmailPassword({ email: normalizedEmail, password })
        : await Api.signUpWithEmailPassword({ email: normalizedEmail, password, fullName: fullName.trim() || undefined });
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

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.wordmark}>
          <View style={styles.mark}><Text style={styles.markText}>H</Text></View>
          <Text style={styles.brand}>Homlo</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>{mode === "signIn" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}</Text>
          <Text style={styles.title}>{mode === "signIn" ? "Find work that fits your life." : "Start with a secure Homlo account."}</Text>
          <Text style={styles.copy}>{mode === "signIn" ? "Sign in to manage your applications, profile, and listings." : "We will ask for your marketplace role after you create your account."}</Text>

          <View style={styles.fields}>
            {mode === "signUp" && <TextInput value={fullName} onChangeText={setFullName} placeholder="Full name (optional for now)" placeholderTextColor="#859087" autoCapitalize="words" style={styles.input} />}
            <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#859087" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#859087" secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType={mode === "signIn" ? "password" : "newPassword"} onSubmitEditing={submit} returnKeyType="done" style={styles.input} />
          </View>

          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}

          <Pressable accessibilityRole="button" accessibilityLabel={mode === "signIn" ? "Sign in to Homlo" : "Create Homlo account"} disabled={submitting} onPress={submit} style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed, submitting && styles.disabled]}>
            <Text style={styles.primaryText}>{submitting ? "Securing your account…" : mode === "signIn" ? "Sign in" : "Create account"}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => { setMode((current) => current === "signIn" ? "signUp" : "signIn"); setError(null); setNotice(null); }} style={({ pressed }) => [styles.modeButton, pressed && styles.textPressed]}>
            <Text style={styles.modeText}>{mode === "signIn" ? "New to Homlo? Create an account" : "Already have an account? Sign in"}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/" as never)} style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}>
            <Text style={styles.guestText}>Explore jobs as a guest</Text>
          </Pressable>
          <Text style={styles.footerText}>Your password and authentication tokens are handled only through Homlo’s secure account service.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  wordmark: { alignItems: "center", flexDirection: "row", gap: 9, paddingTop: 14 },
  mark: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 9, height: 32, justifyContent: "center", width: 32 },
  markText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  brand: { color: "#17201A", fontSize: 22, fontWeight: "800", letterSpacing: -0.6 },
  content: { marginTop: "auto", paddingBottom: 28, paddingTop: 46 },
  eyebrow: { color: "#16803C", fontSize: 11, fontWeight: "800", letterSpacing: 1.15 },
  title: { color: "#17201A", fontSize: 31, fontWeight: "800", letterSpacing: -1, lineHeight: 37, marginTop: 10 },
  copy: { color: "#66736A", fontSize: 15, lineHeight: 22, marginTop: 11, maxWidth: 325 },
  fields: { gap: 10, marginTop: 27 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#D7DFDA", borderRadius: 13, borderWidth: 1, color: "#17201A", fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  primaryButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 14, justifyContent: "center", marginTop: 18, minHeight: 56, paddingHorizontal: 22 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  modeButton: { alignItems: "center", marginTop: 18, minHeight: 32, justifyContent: "center" },
  modeText: { color: "#236B3A", fontSize: 14, fontWeight: "700" },
  error: { color: "#B42318", fontSize: 13, lineHeight: 18, marginTop: 12 },
  notice: { color: "#236B3A", fontSize: 13, lineHeight: 18, marginTop: 12 },
  footer: { gap: 11, paddingBottom: 14 },
  guestButton: { alignItems: "center", borderColor: "#D7DFDA", borderRadius: 13, borderWidth: 1, justifyContent: "center", minHeight: 50 },
  guestText: { color: "#37423A", fontSize: 14, fontWeight: "700" },
  footerText: { color: "#859087", fontSize: 11.5, lineHeight: 16, textAlign: "center" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  textPressed: { opacity: 0.66 },
  disabled: { opacity: 0.65 },
});
