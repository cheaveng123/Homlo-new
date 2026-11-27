import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { useSafeRouter } from "@/lib/navigation";
import * as DocumentPicker from "@/lib/native/document-picker";

import ImagePlaceholder from "./image-placeholder";
import { AppIcon } from "@/components/ui/AppIcon";
import { colors } from "./colors";
import { type, fonts } from "./typography";
import type { JobDetails } from "./types";
import { useAuth } from "@/hooks/use-auth";
import { trpc, clearQueryClient } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";
import { logJobEvent } from "@/lib/event-logging";

type Props = {
  job: JobDetails;
};

export default function ApplyScreen({ job }: Props) {
  const router = useSafeRouter();
  const { user, logout } = useAuth();
  const submit = trpc.homlo.applications.submit.useMutation();

  const [fullName, setFullName] = useState(() => user?.name?.trim() ?? "");
  const [nameError, setNameError] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = submit.isPending;

  const pickCv = async () => {
    haptic.light();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;
      setCvFileName(result.assets[0].name);
      haptic.success();
    } catch {
      setCvFileName(null);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!fullName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSubmitError(null);
    if (!user) {
      haptic.light();
      router.push("/login" as never);
      return;
    }
    const note = [fullName.trim(), message.trim()].filter(Boolean).join("\n\n") || null;
    try {
      await submit.mutateAsync({ jobId: job.id, message: note });
      logJobEvent({ jobId: job.id, eventType: "apply_submitted" });
      haptic.success();
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Couldn't submit application. Please try again.");
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <AppIcon name="check" size={30} color={colors.mint} />
          </View>
          <Text style={styles.successTitle}>Application sent</Text>
          <Text style={styles.successBody}>
            {job.companyName} will review your application and reach out if there&apos;s a match.
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => router.dismissTo("/" as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.successButtonText}>Back to home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.successSecondary}
            onPress={() => router.push("/applications" as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.successSecondaryText}>View my applications</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const switchAccount = async () => {
    await logout();
    clearQueryClient();
    router.replace("/login" as never);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <AppIcon name="back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Apply to {job.title ?? "this job"}
          </Text>
        </View>

        <Text style={type.label}>Full name</Text>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          placeholder="Your full name"
          placeholderTextColor={colors.muted}
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            if (nameError) setNameError(false);
          }}
        />
        {nameError ? <Text style={styles.errorText}>Enter your name to continue.</Text> : null}
        <View style={{ height: 16 }} />

        {user ? (
          <View style={styles.accountRow}>
            {/* IMAGE: signed-in user's avatar — ImagePlaceholder stays as the
                fallback until the account model carries an avatar URL. */}
            <ImagePlaceholder width={41} height={41} borderRadius={20} icon="user" />
            <View style={{ flex: 1, marginLeft: 11 }}>
              <Text style={styles.accountName}>{user.name}</Text>
              <Text style={styles.accountEmail}>{user.email}</Text>
            </View>
            <TouchableOpacity onPress={switchAccount}>
              <Text style={styles.switchLink}>Switch account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.signInRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.signInTitle}>Sign in with your account</Text>
              <Text style={styles.signInSubtitle}>Optional · autofills your profile</Text>
            </View>
            <TouchableOpacity style={styles.outlineButton} onPress={() => router.push("/login" as never)}>
              <Text style={styles.outlineButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 16 }} />

        <Text style={type.label}>
          CV <Text style={styles.optionalTag}>(optional)</Text>
        </Text>
        <TouchableOpacity onPress={pickCv}>
          <ImagePlaceholder
            height={80}
            icon="upload"
            label={cvFileName ?? "Tap to upload PDF or DOC, up to 10MB"}
            style={{ marginTop: 5 }}
          />
        </TouchableOpacity>
        <View style={{ height: 16 }} />

        <Text style={type.label}>
          Message to employer <Text style={styles.optionalTag}>(optional)</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Introduce yourself or ask a question"
          placeholderTextColor={colors.muted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
        />
        <View style={{ height: 20 }} />

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>{submitting ? "Sending application…" : "Send application"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 18, paddingBottom: 34 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  headerTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  input: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15.5,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.danger },
  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.danger,
    marginTop: 5,
  },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  optionalTag: { color: colors.muted, fontFamily: fonts.bodyRegular },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 14,
    gap: 12,
  },
  signInTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  signInSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mint,
    backgroundColor: colors.mintTint,
    borderRadius: 11,
    padding: 14,
  },
  accountName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.mintDeep },
  accountEmail: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.mintDeep,
    marginTop: 1,
  },
  switchLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.mintDeep,
    textDecorationLine: "underline",
  },
  submitButton: {
    backgroundColor: colors.mint,
    borderRadius: 11,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...type.button, color: "#FFFFFF" },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.mintTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 7,
  },
  successBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
  },
  successButton: {
    alignSelf: "stretch",
    backgroundColor: colors.mint,
    borderRadius: 11,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 28,
  },
  successButtonText: { ...type.button, color: "#FFFFFF" },
  successSecondary: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 6,
  },
  successSecondaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.mintDeep,
  },
});