import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { colorsNew } from "@/src/new/theme/tokensNew";

const CATEGORIES = [
  { key: "scam", label: "Scam, or asks for money or bank details" },
  { key: "underage_user", label: "Involves or targets someone under 18" },
  { key: "discrimination", label: "Discrimination" },
  { key: "illegal", label: "Illegal job or activity" },
  { key: "other", label: "Something else" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

/**
 * Report a listing or a profile. Works on iOS, Android and web (RN's
 * multi-button Alert does not render on web). Stored in `reports`; the
 * database emails the owner (reports_notify_owner) without naming the reporter.
 */
export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: "job" | "user";
  targetId: string;
  targetLabel?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const report = trpc.trust.report.useMutation();
  const [category, setCategory] = useState<Category | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCategory(null);
    setDetails("");
    setError(null);
    report.reset();
    onClose();
  };

  const send = () => {
    if (!category) return;
    setError(null);
    report
      .mutateAsync({ targetType, targetId, category, details: details.trim() || undefined })
      .catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : "Could not send the report."));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close report" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.title}>
          Report {targetType === "job" ? "this listing" : "this profile"}
        </Text>
        {targetLabel ? <Text style={styles.sub}>{targetLabel}</Text> : null}

        {!user ? (
          <>
            <Text style={styles.sub}>Sign in to send a report.</Text>
            <Pressable style={styles.primary} onPress={() => { close(); router.push("/login" as never); }}>
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </>
        ) : report.isSuccess ? (
          <>
            <Text style={styles.sub}>Thanks for letting us know. Our team will review it.</Text>
            <Pressable style={styles.primary} onPress={close}>
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: category === c.key }}
                onPress={() => setCategory(c.key)}
                style={[styles.option, category === c.key && styles.optionOn]}
              >
                <Text style={[styles.optionText, category === c.key && styles.optionTextOn]}>{c.label}</Text>
              </Pressable>
            ))}
            <TextInput
              placeholder="Anything else we should know? (optional)"
              placeholderTextColor={colorsNew.muted}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={close}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, { flex: 1, opacity: category && !report.isPending ? 1 : 0.5 }]}
                disabled={!category || report.isPending}
                onPress={send}
              >
                <Text style={styles.primaryText}>{report.isPending ? "Sending…" : "Send report"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "15%",
    maxWidth: 520,
    alignSelf: "center",
    marginHorizontal: "auto" as never,
    backgroundColor: colorsNew.white,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: colorsNew.deep },
  sub: { fontSize: 14, color: colorsNew.muted, marginBottom: 4 },
  option: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 10, padding: 12 },
  optionOn: { borderColor: colorsNew.primary, backgroundColor: colorsNew.tint },
  optionText: { fontSize: 15, color: colorsNew.text },
  optionTextOn: { fontWeight: "700", color: colorsNew.deep },
  input: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 10, padding: 10, minHeight: 70, fontSize: 14, color: colorsNew.text, textAlignVertical: "top" },
  error: { color: colorsNew.danger, fontSize: 14 },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  primary: { backgroundColor: colorsNew.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  primaryText: { color: colorsNew.white, fontWeight: "700", fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  secondaryText: { color: colorsNew.deep, fontWeight: "700", fontSize: 15 },
});
