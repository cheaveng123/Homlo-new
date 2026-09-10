import { useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";

type FormState = { fullName: string; locationText: string; bio: string; phone: string; role: "worker" | "employer" | "both" };
type GatewayProfile = { user_id: string; role: "worker" | "employer" | "both"; full_name: string; phone: string | null; bio: string | null; location_text: string | null; profile_photo_key: string | null; verified: boolean | null };
type GatewayAccount = { account: { user_id: string; role: string | null; full_name: string | null; profile_photo_key: string | null; verified: boolean; plan: "free" | "pro" | "enterprise"; plan_status: string } | null; recentActivity: { application_count: number; posted_job_count: number } | null };
const emptyForm: FormState = { fullName: "", locationText: "", bio: "", phone: "", role: "worker" };

function looksLikeUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && /^https?:\/\//i.test(value);
}

const PLAN_LABEL: Record<string, string> = { free: "Free plan", pro: "Pro plan", enterprise: "Enterprise plan" };

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const profileQuery = trpc.homlo.profile.get.useQuery(undefined, { enabled: Boolean(user) });
  const accountQuery = trpc.homlo.account.get.useQuery(undefined, { enabled: Boolean(user) });
  const saveProfile = trpc.homlo.profile.upsert.useMutation({
    onSuccess: () => {
      void profileQuery.refetch();
      void accountQuery.refetch();
    },
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [saveError, setSaveError] = useState("");

  const profile = ((profileQuery.data as { profile?: GatewayProfile | null } | undefined)?.profile ?? null) as GatewayProfile | null;
  const accountData = accountQuery.data as GatewayAccount | undefined;
  const account = accountData?.account ?? null;
  const recentActivity = accountData?.recentActivity ?? null;

  const displayName = profile?.full_name?.trim() || user?.name?.trim() || user?.email?.split("@")[0] || "Your account";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const avatarUri = looksLikeUrl(profile?.profile_photo_key) ? profile.profile_photo_key : null;
  const isVerified = Boolean(account?.verified ?? profile?.verified);

  const completeFields = [profile?.full_name, profile?.role, profile?.location_text, profile?.phone, profile?.bio, avatarUri].filter(Boolean).length;
  const completion = Math.round((completeFields / 6) * 100);
  const nextStep = !profile?.full_name ? "Add your name" : !profile?.role ? "Choose how you use Homlo" : !profile?.bio ? "Introduce yourself" : !profile?.location_text ? "Add your location" : !profile?.phone ? "Add a contact number" : !avatarUri ? "Add a profile photo" : "Your profile is ready";
  const isLoading = profileQuery.isLoading || accountQuery.isLoading;
  const loadFailed = Boolean(profileQuery.isError || accountQuery.isError);

  const roleHeadline = profile?.role
    ? `${profile.role === "both" ? "Worker and employer" : profile.role === "employer" ? "Employer" : "Job seeker"} account`
    : "Build a profile employers can understand";

  const openEditor = () => {
    haptic.light();
    setSaveError("");
    setFormError("");
    setForm({ fullName: profile?.full_name ?? displayName, locationText: profile?.location_text ?? "", bio: profile?.bio ?? "", phone: profile?.phone ?? "", role: profile?.role ?? "worker" });
    setEditing(true);
  };

  const save = async () => {
    if (saveProfile.isPending) return;
    setSaveError("");
    if (form.fullName.trim().length < 2) {
      setFormError("Add the name you would like to use on Homlo.");
      return;
    }
    setFormError("");
    Keyboard.dismiss();
    try {
      await saveProfile.mutateAsync({
        role: form.role,
        fullName: form.fullName.trim(),
        locationText: form.locationText.trim() || null,
        bio: form.bio.trim() || null,
        phone: form.phone.trim() || null,
      });
      haptic.success();
      setEditing(false);
    } catch {
      setSaveError("Your profile could not be saved. Please check your connection and try again.");
    }
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
    router.replace("/login");
  };

  const isEmployerRole = profile?.role === "employer" || profile?.role === "both";
  const employerStatus = isEmployerRole ? "Go to workspace" : profile?.role === "worker" ? "Add employer access" : "Go to workspace";
  const onEmployerPress = isEmployerRole ? () => router.push("/employer" as never) : openEditor;
  const applicationCount = recentActivity?.application_count ?? 0;

  if (authLoading || isLoading) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.loading}><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Loading your profile…</Text></View></ScreenContainer>;
  }

  if (!user) {
    return <ScreenContainer className="flex-1" containerClassName="bg-background"><View style={styles.loading}><IconSymbol name="person.fill" size={28} color="#16803C" /><Text style={styles.loadingTitle}>Sign in to view your profile</Text><ScalePressable onPress={() => router.replace("/login" as never)} style={styles.signInButton}><Text style={styles.signInText}>Sign in</Text></ScalePressable></View></ScreenContainer>;
  }

  return <ScreenContainer className="flex-1" containerClassName="bg-background">
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>YOUR PROFILE</Text>
          <Pressable accessibilityLabel="Edit profile" accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.heroSettings, pressed && styles.pressed]}>
            <IconSymbol name="gearshape" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.heroIdentity}>
          {avatarUri ? <Image accessibilityLabel="Profile photo" source={{ uri: avatarUri }} style={styles.avatarImage} /> : (
            <View style={styles.avatar}><Text style={styles.initials}>{initials || "H"}</Text></View>
          )}
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
            {isVerified ? <IconSymbol name="checkmark.circle.fill" size={16} color="#D7F0DD" /> : null}
          </View>
          <Text style={profile?.role ? styles.headline : styles.missingHeadline}>{roleHeadline}</Text>
          {profile?.location_text ? (
            <View style={styles.locationRow}><IconSymbol name="mappin.and.ellipse" size={13} color="#D5E8D9" /><Text style={styles.location}>{profile.location_text}</Text></View>
          ) : null}
        </View>
      </View>

      <View style={styles.completion}>
        <View style={styles.completionMain}>
          <View style={styles.completionNumber}><Text style={styles.completionPercent}>{completion}%</Text></View>
          <View style={styles.completionCopyWrap}>
            <Text style={styles.completionTitle}>Profile readiness</Text>
            <Text style={styles.completionCopy}>{isLoading ? "Loading…" : completion < 100 ? nextStep : "Your profile is complete"}</Text>
          </View>
        </View>
        <Pressable accessibilityLabel="Complete profile" accessibilityRole="button" onPress={openEditor} style={({ pressed }) => [styles.completeAction, pressed && styles.pressed]}>
          <Text style={styles.completeActionText}>{completion < 100 ? "Complete" : "Review"}</Text>
          <IconSymbol name="chevron.right" size={16} color="#16803C" />
        </Pressable>
        <View style={styles.track}><View style={[styles.fill, { width: `${completion}%` }]} /></View>
      </View>

      {isLoading && !profile ? (
        <View style={styles.loadingRows}><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Loading your account…</Text></View>
      ) : loadFailed ? (
        <View style={styles.errorBox}><Text style={styles.errorTitle}>We could not load your profile.</Text><Text style={styles.errorCopy}>Check your connection and try again.</Text><ScalePressable onPress={() => { void profileQuery.refetch(); void accountQuery.refetch(); }} style={styles.errorButton}><Text style={styles.errorButtonText}>Retry</Text></ScalePressable></View>
      ) : (
        <>
          <Text style={styles.groupLabel}>PERSONAL DETAILS</Text>
          <View style={styles.profileGroup}>
            <ProfileRow detail={profile?.bio || "A short introduction helps employers get to know you."} icon="person.fill" onPress={openEditor} status={profile?.bio ? "Added" : "Add"} title="About you" />
            <ProfileRow detail={profile?.location_text || "Add the city or area where you work."} icon="briefcase.fill" onPress={openEditor} status={profile?.location_text ? "Added" : "Add"} title="Location" />
            <ProfileRow detail={profile?.phone || "Add a number employers can use after contact is enabled."} icon="clock" onPress={openEditor} status={profile?.phone ? "Added" : "Add"} title="Contact number" />
          </View>

          <Text style={styles.groupLabel}>ACCOUNT</Text>
          <View style={styles.profileGroup}>
            <ProfileRow detail={isEmployerRole ? "Manage listings, applicants and boosts." : "Switch to an employer role to manage listings."} icon="briefcase.fill" onPress={onEmployerPress} status={employerStatus} title="Employer workspace" />
            <ProfileRow detail="Review submitted applications and their status." icon="clock" onPress={() => router.push("/applications" as never)} status={applicationCount > 0 ? `${applicationCount} ${applicationCount === 1 ? "application" : "applications"}` : "Track"} title="My applications" />
            <ProfileRow detail={PLAN_LABEL[account?.plan ?? "free"] ?? "Free plan"} icon="person.fill" onPress={() => router.push("/account-plans" as never)} status={account?.plan === "pro" ? "Pro" : account?.plan === "enterprise" ? "Enterprise" : "Free"} title="Account plan" />
          </View>
        </>
      )}

      <Pressable accessibilityLabel="Sign out of Homlo" accessibilityRole="button" disabled={signingOut} onPress={() => void signOut()} style={styles.logout}>
        <Text style={styles.logoutText}>{signingOut ? "Signing out…" : "Sign out"}</Text>
      </Pressable>
    </ScrollView>

    <ProfileEditor error={saveError} form={form} formError={formError} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} onClose={() => setEditing(false)} onSave={() => void save()} saving={saveProfile.isPending} visible={editing} />
  </ScreenContainer>;
}

function ProfileRow({ detail, icon, onPress, status, title }: { detail: string; icon: "person.fill" | "briefcase.fill" | "clock"; onPress: () => void; status?: string; title: string }) {
  return <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.profileRow, pressed && styles.rowPressed]}><View style={styles.rowIcon}><IconSymbol name={icon} size={18} color="#16803C" /></View><View style={styles.rowCopy}><View style={styles.rowTitleLine}><Text style={styles.rowTitle}>{title}</Text>{status ? <Text style={styles.rowStatus}>{status}</Text> : null}</View><Text numberOfLines={2} style={styles.rowDetail}>{detail}</Text></View><IconSymbol name="chevron.right" size={19} color="#94A098" /></Pressable>;
}

function ProfileEditor({ error, form, formError, onChange, onClose, onSave, saving, visible }: { error: string; form: FormState; formError: string; onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void; onClose: () => void; onSave: () => void; saving: boolean; visible: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["bottom", "left", "right"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.editor}>
          <View style={[styles.editorTop, { paddingTop: insets.top + 6 }]}>
            <Pressable accessibilityLabel="Close profile editor" accessibilityRole="button" onPress={onClose} style={styles.closeButton}><IconSymbol name="chevron.left" size={21} color="#17201A" /></Pressable>
            <Text style={styles.editorTitle}>Edit profile</Text>
            <View style={styles.editorSpacer} />
          </View>
          <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <EditorField label="Your name" onChangeText={(value) => onChange("fullName", value)} placeholder="Your name" value={form.fullName} />
            <View style={styles.field}>
              <SelectField accessibilityLabel="Account role" label="How you use Homlo" onChange={(value) => onChange("role", value as FormState["role"])} options={["worker", "employer", "both"]} placeholder="Choose an account role" value={form.role} />
            </View>
            {form.role === "worker" ? <Text style={styles.fieldHint}>Choose Employer or Both to manage job listings and applicants.</Text> : null}
            <EditorField label="Location" onChangeText={(value) => onChange("locationText", value)} placeholder="e.g. Phnom Penh" value={form.locationText} />
            <EditorField label="Contact number" onChangeText={(value) => onChange("phone", value)} placeholder="Optional" value={form.phone} />
            <EditorField label="About" multiline onChangeText={(value) => onChange("bio", value)} placeholder="A short introduction about your work and strengths" value={form.bio} />
            {formError ? <Text accessibilityRole="alert" style={styles.saveError}>{formError}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={styles.saveError}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.editorFooter}>
            <Pressable accessibilityLabel="Save profile changes" accessibilityRole="button" disabled={saving} onPress={onSave} style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.saveDisabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </Modal>
  );
}

function EditorField({ label, multiline, onChangeText, placeholder, value }: { label: string; multiline?: boolean; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput multiline={multiline} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A098" style={[styles.input, multiline && styles.textArea]} textAlignVertical={multiline ? "top" : "center"} value={value} /></View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  title: { color: "#17201A", fontSize: 26, fontWeight: "700", letterSpacing: -0.7, lineHeight: 32 },
  profileHero: { backgroundColor: "#0F5C2B", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginHorizontal: -20, marginTop: -20, minHeight: 224, paddingHorizontal: 20, paddingTop: 20 },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  heroLabel: { color: "#D5E8D9", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  heroSettings: { alignItems: "center", borderColor: "rgba(255,255,255,0.35)", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  heroIdentity: { alignItems: "center", marginTop: 16 },
  avatar: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9EFE0", borderRadius: 32, borderWidth: 2, height: 64, justifyContent: "center", width: 64 },
  avatarImage: { backgroundColor: "#D9EFE0", borderColor: "#D9EFE0", borderRadius: 32, borderWidth: 2, height: 64, width: 64 },
  initials: { color: "#16803C", fontSize: 19, fontWeight: "700" },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 5, justifyContent: "center", marginTop: 8 },
  name: { color: "#FFFFFF", flexShrink: 1, fontSize: 18, fontWeight: "700", lineHeight: 22 },
  headline: { color: "#E5F1E7", fontSize: 13, lineHeight: 18, marginTop: 2 },
  missingHeadline: { color: "#D5E8D9", fontSize: 13, lineHeight: 18, marginTop: 3 },
  locationRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 4 },
  location: { color: "#D5E8D9", fontSize: 12, lineHeight: 17 },
  completion: { backgroundColor: "#FFFFFF", borderColor: "#E0E9E5", borderRadius: 15, borderWidth: 1, marginTop: -16, padding: 13, shadowColor: "#173C25", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  completionMain: { alignItems: "center", flexDirection: "row" },
  completionNumber: { alignItems: "center", backgroundColor: "#E2F0EC", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  completionPercent: { color: "#16803C", fontSize: 12.5, fontWeight: "700" },
  completionCopyWrap: { flex: 1, marginLeft: 10 },
  completionTitle: { color: "#17201A", fontSize: 14, fontWeight: "600", lineHeight: 18 },
  completionCopy: { color: "#66736A", fontSize: 12, lineHeight: 17, marginTop: 2 },
  completeAction: { alignItems: "center", flexDirection: "row", gap: 1, paddingLeft: 8, paddingVertical: 7 },
  completeActionText: { color: "#16803C", fontSize: 12, fontWeight: "600" },
  track: { backgroundColor: "#DCE7E2", borderRadius: 2, height: 4, marginTop: 13, overflow: "hidden" },
  fill: { backgroundColor: "#22A447", height: 4 },
  groupLabel: { color: "#74817D", fontSize: 10, fontWeight: "700", letterSpacing: 0.75, marginTop: 21 },
  profileGroup: { backgroundColor: "#FFFFFF", borderColor: "#E0E8E4", borderRadius: 13, borderWidth: 1, marginTop: 8, overflow: "hidden" },
  profileRow: { alignItems: "center", borderBottomColor: "#E6ECE9", borderBottomWidth: 1, flexDirection: "row", minHeight: 69, paddingHorizontal: 11, paddingVertical: 9 },
  rowPressed: { backgroundColor: "#F7FAF8" },
  rowIcon: { alignItems: "center", backgroundColor: "#EDF5F2", borderRadius: 16, height: 32, justifyContent: "center", marginRight: 10, width: 32 },
  rowCopy: { flex: 1, paddingRight: 8 },
  rowTitleLine: { alignItems: "baseline", flexDirection: "row", gap: 7 },
  rowTitle: { color: "#17201A", fontSize: 14, fontWeight: "600", lineHeight: 19 },
  rowStatus: { color: "#16803C", fontSize: 10.5, fontWeight: "600" },
  rowDetail: { color: "#66736A", fontSize: 12, lineHeight: 17, marginTop: 2 },
  logout: { alignSelf: "flex-start", marginTop: 18, paddingVertical: 8 },
  logoutText: { color: "#66736A", fontSize: 13, fontWeight: "500" },
  pressed: { opacity: 0.6 },
  loading: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  loadingTitle: { color: "#17201A", fontSize: 17, fontWeight: "800", marginTop: 6 },
  loadingText: { color: "#66736A", fontSize: 14, fontWeight: "600" },
  loadingRows: { alignItems: "center", gap: 12, marginTop: 34 },
  errorBox: { alignItems: "center", backgroundColor: "#FDEEEE", borderColor: "#F3CCCC", borderRadius: 14, borderWidth: 1, marginTop: 22, padding: 18 },
  errorTitle: { color: "#7A2B2B", fontSize: 14, fontWeight: "700" },
  errorCopy: { color: "#8A4A4A", fontSize: 12.5, marginTop: 4 },
  errorButton: { alignItems: "center", backgroundColor: "#A53B3B", borderRadius: 11, justifyContent: "center", marginTop: 14, minHeight: 42, paddingHorizontal: 22 },
  errorButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  signInButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", marginTop: 18, minHeight: 48, paddingHorizontal: 22 },
  signInText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  editor: { flex: 1 },
  editorTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 6 },
  closeButton: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 18, height: 38, justifyContent: "center", width: 38 },
  editorTitle: { color: "#17201A", fontSize: 16, fontWeight: "700" },
  editorSpacer: { width: 38 },
  editorContent: { padding: 20, paddingBottom: 108 },
  field: { marginTop: 18 },
  fieldLabel: { color: "#17201A", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  fieldHint: { color: "#66736A", fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#DCE5E2", borderRadius: 11, borderWidth: 1, color: "#17201A", fontSize: 14, minHeight: 50, paddingHorizontal: 13 },
  textArea: { minHeight: 100, paddingTop: 12 },
  saveError: { color: "#A53B3B", fontSize: 12.5, lineHeight: 18, marginTop: 16 },
  editorFooter: { backgroundColor: "#F7F8F6", borderTopColor: "#E2E8E5", borderTopWidth: 1, bottom: 0, left: 0, padding: 16, position: "absolute", right: 0 },
  saveButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", minHeight: 52 },
  saveDisabled: { opacity: 0.65 },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});