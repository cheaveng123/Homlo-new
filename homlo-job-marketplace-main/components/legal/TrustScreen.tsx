import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useRouter } from "@/lib/router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colorsNew } from "@/src/new/theme/tokensNew";
import { LegalFooter } from "./LegalUI";

/** Plain page shell used by the legal, verification, privacy, appeal and admin screens. */
export function TrustScreen({ title, children, maxWidth = 760 }: { title: string; children: ReactNode; maxWidth?: number }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.inner, { maxWidth }]}>{children}</View>
        <LegalFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Btn({
  label,
  onPress,
  disabled,
  busy,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const bg = tone === "primary" ? colorsNew.primary : tone === "danger" ? colorsNew.danger : colorsNew.white;
  const fg = tone === "secondary" ? colorsNew.deep : colorsNew.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, tone === "secondary" && styles.btnOutline]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colorsNew.muted} style={[styles.input, rest.multiline && { minHeight: 110, textAlignVertical: "top" }, style]} {...rest} />
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text accessibilityRole="alert" style={styles.error}>{children}</Text> : null;
}

export const trustStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" },
  ok: { color: "#0B6F8A", fontWeight: "700" },
  pill: { alignSelf: "flex-start", backgroundColor: colorsNew.tint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  pillText: { color: colorsNew.deep, fontSize: 13, fontWeight: "700" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsNew.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colorsNew.border, backgroundColor: colorsNew.white },
  back: { width: 72 },
  backText: { color: colorsNew.primary, fontSize: 16, fontWeight: "600" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colorsNew.deep },
  scroll: { paddingVertical: 16 },
  inner: { width: "100%", alignSelf: "center", paddingHorizontal: 16, gap: 14 },
  card: { backgroundColor: colorsNew.white, borderRadius: 14, borderWidth: 1, borderColor: colorsNew.border, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colorsNew.deep },
  btn: { minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnOutline: { borderWidth: 1, borderColor: colorsNew.border },
  btnText: { fontSize: 15, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: colorsNew.deep },
  input: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colorsNew.text, backgroundColor: colorsNew.white },
  muted: { fontSize: 14, lineHeight: 20, color: colorsNew.muted },
  error: { fontSize: 14, color: colorsNew.danger },
});
