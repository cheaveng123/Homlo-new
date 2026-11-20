import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { CONSENT_WORDING } from "@/lib/legal/consent-wording";
import { trpc } from "@/lib/trpc";
import { colorsNew } from "@/src/new/theme/tokensNew";
import { ConsentCheckbox } from "./LegalUI";

export type ContactMethod = "in_app" | "email" | "phone";
export type ListingTrustFields = {
  employerName: string;
  contactMethod: ContactMethod;
  contactValue: string | null;
  postingConsent: true;
};

const CONTACT_OPTIONS: { key: ContactMethod; label: string }[] = [
  { key: "in_app", label: "Messages in Homlo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

/**
 * Final step before a listing is submitted: account checks, the required
 * fields the wizard does not ask for (employer name, contact method), the
 * live wording check and the job-posting declaration (unticked every time).
 * The server and database enforce all of this again.
 * Mount it only while open, so the declaration starts unticked every time.
 */
export function PublishDeclarationSheet({
  visible,
  listingText,
  defaultEmployerName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  listingText: string;
  defaultEmployerName: string;
  onCancel: () => void;
  onConfirm: (fields: ListingTrustFields) => void;
}) {
  const router = useRouter();
  const status = trpc.trust.status.useQuery(undefined, { enabled: visible });
  const check = trpc.trust.checkListing.useQuery({ text: listingText }, { enabled: visible && listingText.trim().length > 0 });
  const [employerName, setEmployerName] = useState(defaultEmployerName);
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [agreed, setAgreed] = useState(false);

  const s = status.data;
  const missing = s
    ? [
        !s.acceptedCurrentTerms && "accept the current Terms of Service",
        !s.emailVerified && "confirm your email address",
        !s.phoneVerified && "verify your phone number",
      ].filter(Boolean)
    : [];
  const blocked = check.data?.blocked ?? [];
  const needsReview = check.data?.needsReview ?? [];
  const contactOk = contactMethod === "in_app" || (contactMethod !== null && contactValue.trim().length > 3);
  const canPublish = Boolean(s) && missing.length === 0 && blocked.length === 0 && employerName.trim().length >= 2 && contactOk && agreed;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>Before you publish</Text>

            {status.isLoading ? <ActivityIndicator color={colorsNew.primary} /> : null}

            {missing.length > 0 ? (
              <View style={styles.warn}>
                <Text style={styles.warnText}>To post a job, first {missing.join(", ")}.</Text>
                <Pressable
                  style={styles.primary}
                  onPress={() => {
                    onCancel();
                    router.push({ pathname: "/account/verify", params: { next: "/employer/post-job" } } as never);
                  }}
                >
                  <Text style={styles.primaryText}>Verify my account</Text>
                </Pressable>
              </View>
            ) : null}

            {s?.isNewAccount && s.newAccountListingsLeft !== null ? (
              <Text style={styles.muted}>New accounts can post {s.newAccountListingsLeft} more listing(s) in their first week.</Text>
            ) : null}
            {s && !s.hasPostedBefore ? <Text style={styles.muted}>Your first listing is checked by our team before it goes live.</Text> : null}

            {blocked.length > 0 ? (
              <View style={styles.error}>
                <Text style={styles.errorText}>
                  Please edit your listing. It contains wording we cannot publish: {blocked.join(", ")}. Listings must not discriminate by age, gender, race or
                  religion, or recruit minors for hazardous or adult work.
                </Text>
              </View>
            ) : null}
            {needsReview.length > 0 && blocked.length === 0 ? (
              <View style={styles.warn}>
                <Text style={styles.warnText}>
                  Your listing mentions {needsReview.join(", ")}. It will be checked by our team before it goes live. Never ask applicants for money or bank details.
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Employer name (shown on the listing)</Text>
            <TextInput value={employerName} onChangeText={setEmployerName} style={styles.input} maxLength={160} />

            <Text style={styles.label}>How should applicants contact you?</Text>
            <View style={styles.row}>
              {CONTACT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: contactMethod === o.key }}
                  onPress={() => setContactMethod(o.key)}
                  style={[styles.chip, contactMethod === o.key && styles.chipOn]}
                >
                  <Text style={[styles.chipText, contactMethod === o.key && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            {contactMethod === "email" || contactMethod === "phone" ? (
              <TextInput
                value={contactValue}
                onChangeText={setContactValue}
                placeholder={contactMethod === "email" ? "jobs@yourbusiness.com" : "+85512345678"}
                placeholderTextColor={colorsNew.muted}
                keyboardType={contactMethod === "email" ? "email-address" : "phone-pad"}
                autoCapitalize="none"
                style={styles.input}
              />
            ) : null}

            <ConsentCheckbox label={CONSENT_WORDING.jobPosting} checked={agreed} onChange={setAgreed} testID="job-posting-consent" />

            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={onCancel}>
                <Text style={styles.secondaryText}>Back to editing</Text>
              </Pressable>
              <Pressable
                disabled={!canPublish}
                style={[styles.primary, { flex: 1, opacity: canPublish ? 1 : 0.45 }]}
                onPress={() =>
                  contactMethod &&
                  onConfirm({
                    employerName: employerName.trim(),
                    contactMethod,
                    contactValue: contactMethod === "in_app" ? null : contactValue.trim(),
                    postingConsent: true,
                  })
                }
              >
                <Text style={styles.primaryText}>Publish</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colorsNew.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%", width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colorsNew.deep },
  label: { fontSize: 13, fontWeight: "700", color: colorsNew.deep },
  muted: { fontSize: 13, color: colorsNew.muted },
  input: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 10, padding: 12, fontSize: 15, color: colorsNew.text },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { borderColor: colorsNew.primary, backgroundColor: colorsNew.tint },
  chipText: { color: colorsNew.text, fontSize: 14 },
  chipTextOn: { color: colorsNew.deep, fontWeight: "700" },
  warn: { backgroundColor: colorsNew.cream, borderRadius: 12, padding: 12, gap: 10 },
  warnText: { color: colorsNew.creamInk, fontSize: 14, lineHeight: 20 },
  error: { backgroundColor: colorsNew.dangerTint, borderRadius: 12, padding: 12 },
  errorText: { color: colorsNew.danger, fontSize: 14, lineHeight: 20 },
  primary: { backgroundColor: colorsNew.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },
  primaryText: { color: colorsNew.white, fontWeight: "700", fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: colorsNew.border, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
  secondaryText: { color: colorsNew.deep, fontWeight: "700", fontSize: 15 },
});
