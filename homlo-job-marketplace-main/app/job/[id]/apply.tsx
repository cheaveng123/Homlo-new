import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getJob } from "@/components/job-store";
import { JobBannerImage } from "@/components/job-banner-image";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { SelectField } from "@/components/ui/select-field";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { localImageUris } from "@/lib/local-image-uris";
import { Text } from "@/components/ui/text";
import { fontFamilies } from "@/lib/typography";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { logJobEvent } from "@/lib/event-logging";

const availabilityOptions = ["Weekdays", "Evenings", "Weekends", "Flexible"];
type Step = "information" | "review" | "sent";

export default function ApplyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { jobs: availableJobs, loading: liveJobsLoading } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);
  const { user } = useAuth();
  const isCanonicalJobId = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
  const byJobInput = useMemo(() => ({ jobId: isCanonicalJobId ? id! : "00000000-0000-0000-0000-000000000000" }), [id, isCanonicalJobId]);
  const existingQuery = trpc.homlo.applications.byJob.useQuery(byJobInput, { enabled: Boolean(isCanonicalJobId && user) });
  const submit = trpc.homlo.applications.submit.useMutation();
  useEffect(() => {
    if (isCanonicalJobId) logJobEvent({ jobId: id!, eventType: "apply_started" });
  }, [isCanonicalJobId, id]);
  const [availability, setAvailability] = useState("Flexible");
  const [note, setNote] = useState("");
  const [cv, setCv] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [cvError, setCvError] = useState("");
  const leaveLockRef = useRef(false);
  const [step, setStep] = useState<Step>("information");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  useEffect(() => {
    if (step !== "sent" || !submittedId) return;
    const timer = setTimeout(() => router.replace(`/applications/${submittedId}` as never), 700);
    return () => clearTimeout(timer);
  }, [router, step, submittedId]);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const applicantName = user?.name?.trim() || user?.email?.split("@")[0] || "Your account";
  const profileLine = user?.email || "Complete your profile to add more details";
  const availabilityChoices = availabilityOptions;

  const pickCv = async () => {
    setCvError("");
    haptic.light();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      });
      if (result.canceled || !result.assets?.[0]) return;
      setCv(result.assets[0]);
      haptic.success();
    } catch {
      setCvError("We couldn’t open your files. Please try again.");
    }
  };

  const cvSize = cv?.size ? `${(cv.size / 1024 / 1024).toFixed(cv.size < 1024 * 1024 ? 0 : 1)} MB` : "Ready to attach";

  const applied = (existingQuery.data as { application?: { id: string; status: string } | null } | undefined)?.application ?? null;
  const applicationId = submittedId ?? applied?.id ?? null;
  const statusText = useMemo(() => applied?.status ? applied.status.replace("_", " ").replace(/^./, (value) => value.toUpperCase()) : "Submitted", [applied]);
const submitApplication = async () => {
    if (!job || submit.isPending) return;
    if (!user) {
      setSubmitError("");
      haptic.light();
      setLoginPromptVisible(true);
      return;
    }
    if (!isCanonicalJobId) {
      setSubmitError("This curated preview listing has not been migrated to the live marketplace yet.");
      return;
    }
    setSubmitError("");
    const message = [note.trim(), availability !== "Flexible" ? `Availability: ${availability}` : ""].filter(Boolean).join("\n\n") || null;
    const submitInput = { jobId: job.id, message };
    try {
      const result = await submit.mutateAsync(submitInput);
      const application = (result as { application?: { id?: string } }).application;
      if (!application?.id) throw new Error("The application service did not return an application record.");
      setSubmittedId(application.id);
      logJobEvent({ jobId: job.id, eventType: "apply_submitted" });
      haptic.success();
      setStep("sent");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Couldn't submit application. Please try again.");
    }
  };

  if (!job && liveJobsLoading) return <ScreenContainer className="items-center justify-center p-6"><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Loading this opportunity…</Text></ScreenContainer>;
  if (!job) return <ScreenContainer className="items-center justify-center p-6"><Text style={styles.missingTitle}>This role is no longer available.</Text><ScalePressable hapticFeedback onPress={() => router.back()} style={styles.returnButton}><Text style={styles.returnText}>Go back</Text></ScalePressable></ScreenContainer>;
  const leaveApply = () => { if (step === "review") { setStep("information"); return; } if (leaveLockRef.current) return; leaveLockRef.current = true; if (from === "detail") router.back(); else router.replace({ pathname: "/job/[id]", params: { id: job.id } } as never); };
  if (isCanonicalJobId && existingQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#16803C" /><Text style={styles.loadingText}>Checking your application</Text></ScreenContainer>;
  if (applied && step !== "sent") return <ExistingApplication applicationId={applied.id} job={job} onBack={leaveApply} status={statusText} />;
  if (step === "sent") return <SentApplication applicationId={applicationId} job={job} onBrowse={() => router.replace("/jobs" as never)} onView={() => router.replace(applicationId ? `/applications/${applicationId}` as never : "/applications" as never)} />;
  return <><ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={[styles.applyHero, { paddingTop: Math.max(insets.top, 12) + 8 }]}><ApplyHeroImage job={job} /><View style={styles.applyHeroShade} /><View style={styles.heroTopBar}><ScalePressable accessibilityLabel="Back to job details" hapticFeedback onPress={leaveApply} style={styles.heroBackButton}><IconSymbol name="chevron.left" size={19} color="#FFFFFF" /><Text style={styles.heroBackText}>Back</Text></ScalePressable><Text style={styles.heroTitle}>Apply</Text><View style={styles.heroSpacer} /></View><View style={styles.heroJobCopy}><Text style={styles.heroEyebrow}>{step === "information" ? "APPLY FOR" : "REVIEW APPLICATION"}</Text><Text numberOfLines={2} style={styles.heroJobTitle}>{job.title}</Text><Text style={styles.heroJobCompany}>{job.company}</Text></View></View><View style={styles.bodyContent}><View style={styles.progressRow}><Text style={styles.progressText}>{step === "information" ? "STEP 1 OF 2" : "STEP 2 OF 2"}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, step === "review" && styles.progressFillComplete]} /></View></View><JobSummary job={job} />{step === "information" ? <View><View style={styles.introBlock}><Text style={styles.pageTitle}>Your application</Text><Text style={styles.pageSubtitle}>We will share the account details below with {job.company}.</Text></View><View style={styles.profileSummary}><View style={styles.profileIcon}><IconSymbol name="person.fill" size={18} color="#16803C" /></View><View style={styles.profileCopy}><Text style={styles.profileName}>{applicantName}</Text><Text numberOfLines={2} style={styles.profileLine}>{profileLine}</Text></View>{user ? <IconSymbol name="checkmark.circle.fill" size={18} color="#16803C" /> : <Pressable accessibilityRole="button" onPress={() => setLoginPromptVisible(true)} style={styles.signInInline}><Text style={styles.signInInlineText}>Sign in</Text></Pressable>}</View><Text style={styles.fieldLabel}>CV / Resume <Text style={styles.optional}>(optional)</Text></Text><Pressable accessibilityLabel={cv ? `Replace CV ${cv.name}` : "Add a CV or resume"} accessibilityRole="button" onPress={() => void pickCv()} style={({ pressed }) => [styles.cvCard, pressed && styles.cvPressed]}><View style={styles.cvIcon}><IconSymbol name="paperclip" size={18} color="#16803C" /></View><View style={styles.cvCopy}><Text numberOfLines={1} style={styles.cvTitle}>{cv?.name || "Add your CV or resume"}</Text><Text style={styles.cvMeta}>{cv ? `${cv.mimeType === "application/pdf" ? "PDF" : "Document"} · ${cvSize}` : "PDF or Word document"}</Text></View><Text style={styles.cvAction}>{cv ? "Replace" : "Add"}</Text></Pressable>{cvError ? <Text style={styles.cvError}>{cvError}</Text> : null}<View style={styles.fieldWrap}><SelectField accessibilityLabel="Choose availability" label="When can you work?" onChange={(value) => { haptic.selection(); setAvailability(value); }} options={availabilityChoices} placeholder="Choose availability" value={availability} /></View><Text style={styles.fieldLabel}>Message to employer <Text style={styles.optional}>(optional)</Text></Text><TextInput accessibilityLabel="Optional message to employer" multiline onChangeText={setNote} placeholder="Introduce yourself or share anything helpful…" placeholderTextColor="#94A098" style={styles.noteInput} textAlignVertical="top" value={note} /></View> : <View><View style={styles.introBlock}><Text style={styles.pageTitle}>Review application</Text><Text style={styles.pageSubtitle}>Review exactly what will be sent before submitting.</Text></View><View style={styles.reviewSection}><Text style={styles.reviewSectionTitle}>Applying for</Text><Text style={styles.reviewJob}>{job.title}</Text><Text style={styles.reviewCompany}>{job.company} · {job.location}</Text></View><ReviewLine label="Applicant" value={applicantName} /><ReviewLine label="Contact" value={user?.email || "Sign in to add your contact details"} /><ReviewLine label="Availability" value={availability} /><ReviewLine label="CV / Resume" value={cv?.name || "No CV attached"} /><View style={styles.messageBlock}><Text style={styles.reviewSectionTitle}>Message</Text><Text style={note ? styles.messageText : styles.messageMuted}>{note || "No message added."}</Text></View><Text style={styles.consent}>By submitting, you agree to share the information above with {job.company} for this role.</Text></View>}</View></ScrollView><View style={styles.actionBar}>{submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}<ScalePressable hapticFeedback={!submit.isPending} onPress={step === "information" ? () => setStep("review") : () => void submitApplication()} style={[styles.primaryButton, submit.isPending && styles.disabledButton]}><Text style={styles.primaryButtonText}>{step === "information" ? "Continue" : submit.isPending ? "Submitting application…" : "Submit application"}</Text>{!submit.isPending ? <IconSymbol name="arrow.right" size={18} color="#FFFFFF" /> : null}</ScalePressable></View></ScreenContainer><LoginPrompt onClose={() => setLoginPromptVisible(false)} onNotNow={() => { setLoginPromptVisible(false); leaveApply(); }} onSignIn={() => { setLoginPromptVisible(false); router.push("/login" as never); }} visible={loginPromptVisible} /></>;
}
function ApplyHeroImage({ job }: { job: NonNullable<ReturnType<typeof getJob>> }) {
  const uri = localImageUris[job.id] || job.image;
  if (uri) return <JobBannerImage accessibilityLabel={`${job.company} workplace`} uri={uri} style={styles.applyHeroImage} />;
  return <View accessibilityLabel={`${job.company} workplace`} style={styles.applyHeroImage} />;
}

function JobSummary({ job }: { job: NonNullable<ReturnType<typeof getJob>> }) {
  const uri = localImageUris[job.id] || job.image;
  return <View style={styles.roleCard}><View style={styles.roleCopy}><Text style={styles.roleKicker}>ROLE DETAILS</Text><Text numberOfLines={1} style={styles.roleTitle}>{job.title}</Text><Text style={styles.roleCompany}>{job.company}</Text><Text numberOfLines={1} style={styles.roleMeta}>{job.location} · {job.arrangement}</Text><Text style={styles.rolePay}>{job.pay}</Text></View>{uri ? <JobBannerImage accessibilityLabel={`${job.company} workplace`} uri={uri} style={styles.roleImage} /> : <View accessibilityLabel={`${job.company} workplace`} style={styles.roleImage} />}</View>;
}
function ReviewLine({ label, value }: { label: string; value: string }) { return <View style={styles.reviewLine}><Text style={styles.reviewLineLabel}>{label}</Text><Text style={styles.reviewLineValue}>{value}</Text></View>; }
function LoginPrompt({ onClose, onNotNow, onSignIn, visible }: { onClose: () => void; onNotNow: () => void; onSignIn: () => void; visible: boolean }) { return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.loginOverlay}><Pressable accessibilityLabel="Close login prompt" accessibilityRole="button" onPress={onClose} style={styles.loginDismiss} /><View style={styles.loginSheet}><View style={styles.loginHandle} /><Text style={styles.loginEyebrow}>ACCOUNT REQUIRED</Text><Text style={styles.loginTitle}>Sign in to apply</Text><Text style={styles.loginCopy}>Use your secure Homlo account to submit and track applications.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={styles.socialButton}><IconSymbol name="person.fill" size={17} color="#16803C" /><Text style={styles.socialText}>Sign in to Homlo</Text></Pressable><Pressable accessibilityRole="button" onPress={onNotNow} style={styles.loginCancel}><Text style={styles.loginCancelText}>Back to job</Text></Pressable></View></View></Modal>; }
function ExistingApplication({ applicationId, job, onBack, status }: { applicationId: string; job: NonNullable<ReturnType<typeof getJob>>; onBack: () => void; status: string }) { const router = useRouter(); return <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}><View style={styles.stateScreen}><View style={styles.stateMark}><IconSymbol name="checkmark.circle.fill" size={42} color="#16803C" /></View><Text style={styles.stateTitle}>Application submitted</Text><Text style={styles.stateCopy}>You have already applied for {job.title} at {job.company}.</Text><View style={styles.statusLine}><Text style={styles.statusLabel}>Status</Text><Text style={styles.statusValue}>{status}</Text></View><ScalePressable hapticFeedback onPress={() => router.push({ pathname: "/conversations/[id]", params: { id: "conversation", applicationId } } as never)} style={styles.primaryButton}><IconSymbol name="message.fill" size={16} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Message employer</Text></ScalePressable><ScalePressable hapticFeedback onPress={() => router.replace(`/applications/${applicationId}` as never)} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>View application</Text></ScalePressable><ScalePressable hapticFeedback onPress={onBack} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Back to job details</Text></ScalePressable></View></ScreenContainer>; }
function SentApplication({ applicationId, job, onBrowse, onView }: { applicationId: string | null; job: NonNullable<ReturnType<typeof getJob>>; onBrowse: () => void; onView: () => void }) { const router = useRouter(); return <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}><View style={styles.stateScreen}><View style={styles.stateMark}><IconSymbol name="checkmark.circle.fill" size={42} color="#16803C" /></View><Text style={styles.stateTitle}>Application sent</Text><Text style={styles.stateCopy}>Your application for {job.title} has been submitted to {job.company}. You can message the employer directly now.</Text>
{applicationId ? <ScalePressable hapticFeedback onPress={() => router.push({ pathname: "/conversations/[id]", params: { id: "conversation", applicationId } } as never)} style={styles.primaryButton}><IconSymbol name="message.fill" size={16} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Message employer</Text></ScalePressable> : null}
<ScalePressable hapticFeedback onPress={onView} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>View application</Text></ScalePressable><ScalePressable hapticFeedback onPress={onBrowse} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Back to jobs</Text></ScalePressable></View></ScreenContainer>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 128 }, bodyContent: { paddingHorizontal: 20 }, applyHero: { backgroundColor: "#0F5C2B", height: 214, marginTop: 0, overflow: "hidden", paddingHorizontal: 28, position: "relative" }, applyHeroImage: { height: "100%", left: 0, opacity: 0.78, position: "absolute", top: 0, width: "100%" }, applyHeroShade: { backgroundColor: "rgba(15, 92, 43, 0.46)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, heroTopBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 0, position: "relative", zIndex: 2 }, heroBackButton: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.24)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 2, height: 42, justifyContent: "center", paddingHorizontal: 12, width: 92 }, heroBackText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" }, heroTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" }, heroSpacer: { width: 78 }, heroJobCopy: { bottom: 16, left: 28, position: "absolute", right: 28 }, heroEyebrow: { color: "#E8F6EA", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, heroJobTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.45, lineHeight: 27, marginTop: 4 }, heroJobCompany: { color: "#E2F0E5", fontSize: 13, marginTop: 3 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, backButton: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 19, height: 38, justifyContent: "center", width: 38 }, topTitle: { color: "#17201A", fontSize: 15, fontWeight: "800" }, topSpacer: { width: 38 }, progressRow: { alignItems: "center", flexDirection: "row", gap: 9, marginTop: 14 }, progressText: { color: "#66736A", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.65 }, progressTrack: { backgroundColor: "#E2E8E5", borderRadius: 2, flex: 1, height: 4, overflow: "hidden" }, progressFill: { backgroundColor: "#22A447", height: 4, width: "50%" }, progressFillComplete: { width: "100%" }, roleCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5E0", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 12, padding: 12 }, roleImage: { backgroundColor: "#EAF3EC", borderRadius: 10, height: 52, width: 52 }, roleKicker: { color: "#16803C", fontSize: 9.5, fontWeight: "800", letterSpacing: 0.7, marginBottom: 4 }, roleCopy: { flex: 1, marginLeft: 11 }, roleTitle: { color: "#17201A", fontSize: 15, fontWeight: "800" }, roleCompany: { color: "#66736A", fontSize: 12.5, marginTop: 3 }, roleMeta: { color: "#66736A", fontSize: 11.5, marginTop: 4 }, rolePay: { color: "#16803C", fontSize: 12.5, fontWeight: "800", marginTop: 5 }, introBlock: { marginTop: 20 }, pageTitle: { color: "#17201A", fontSize: 23, fontWeight: "800", letterSpacing: -0.65 }, pageSubtitle: { color: "#66736A", fontSize: 13, lineHeight: 18, marginTop: 5 }, profileSummary: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D5DFD9", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 22, padding: 13 }, profileIcon: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 16, height: 32, justifyContent: "center", width: 32 }, profileCopy: { flex: 1, marginLeft: 10 }, profileName: { color: "#17201A", fontSize: 13, fontWeight: "800" }, profileLine: { color: "#66736A", fontSize: 11.5, marginTop: 2 }, signInInline: { paddingHorizontal: 5, paddingVertical: 5 }, signInInlineText: { color: "#16803C", fontSize: 12, fontWeight: "800" }, fieldWrap: { marginTop: 24 }, fieldLabel: { color: "#17201A", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 24 }, cvCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5E0", borderRadius: 13, borderWidth: 1, flexDirection: "row", minHeight: 68, paddingHorizontal: 12, paddingVertical: 10 }, cvIcon: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, cvCopy: { flex: 1, marginLeft: 10 }, cvTitle: { color: "#17201A", fontSize: 13, fontWeight: "700" }, cvMeta: { color: "#66736A", fontSize: 11.5, marginTop: 3 }, cvAction: { color: "#16803C", fontSize: 12, fontWeight: "800", marginLeft: 8 }, cvPressed: { opacity: 0.7, transform: [{ scale: 0.985 }] }, cvError: { color: "#A53B3B", fontSize: 11.5, marginTop: 6 }, optional: { color: "#94A098", fontWeight: "500" }, noteInput: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 13, borderWidth: 1, color: "#17201A", fontFamily: fontFamilies.regular, fontSize: 13.5, height: 105, lineHeight: 19, padding: 13 }, reviewSection: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, marginTop: 23, paddingBottom: 16 }, reviewSectionTitle: { color: "#66736A", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }, reviewJob: { color: "#17201A", fontSize: 18, fontWeight: "800", marginTop: 8 }, reviewCompany: { color: "#66736A", fontSize: 12.5, marginTop: 4 }, reviewLine: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, paddingVertical: 14 }, reviewLineLabel: { color: "#66736A", fontSize: 11.5 }, reviewLineValue: { color: "#17201A", fontSize: 13.5, fontWeight: "700", marginTop: 4 }, messageBlock: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, paddingVertical: 16 }, messageText: { color: "#405148", fontSize: 13.5, lineHeight: 20, marginTop: 8 }, messageMuted: { color: "#94A098", fontSize: 13, fontStyle: "italic", marginTop: 8 }, consent: { color: "#66736A", fontSize: 11.5, lineHeight: 17, marginTop: 17 }, actionBar: { backgroundColor: "#F7F8F6", borderTopColor: "#E2E8E5", borderTopWidth: 1, bottom: 0, left: 0, padding: 16, position: "absolute", right: 0 }, primaryButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 }, primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, disabledButton: { opacity: 0.65 }, submitError: { color: "#A53B3B", fontSize: 12.5, lineHeight: 17, marginBottom: 9, textAlign: "center" }, stateScreen: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, stateMark: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 42, height: 84, justifyContent: "center", width: 84 }, stateTitle: { color: "#17201A", fontSize: 26, fontWeight: "800", letterSpacing: -0.7, marginTop: 22 }, stateCopy: { color: "#66736A", fontSize: 14, lineHeight: 21, marginTop: 9, textAlign: "center" }, statusLine: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 19, padding: 12, width: "100%" }, statusLabel: { color: "#66736A", fontSize: 12 }, statusValue: { color: "#16803C", fontSize: 12.5, fontWeight: "800", textTransform: "capitalize" }, secondaryAction: { marginTop: 14, padding: 10 }, secondaryActionText: { color: "#16803C", fontSize: 13.5, fontWeight: "800" }, missingTitle: { color: "#17201A", fontSize: 18, fontWeight: "800", textAlign: "center" }, returnButton: { backgroundColor: "#16803C", borderRadius: 12, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 }, returnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, loadingText: { color: "#66736A", fontSize: 13, marginTop: 11 }, loginOverlay: { backgroundColor: "rgba(17, 30, 25, 0.38)", flex: 1, justifyContent: "flex-end" }, loginDismiss: { flex: 1 }, loginSheet: { backgroundColor: "#FFFEFC", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 }, loginHandle: { alignSelf: "center", backgroundColor: "#CBD5D0", borderRadius: 3, height: 4, marginBottom: 20, width: 40 }, loginEyebrow: { color: "#16803C", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.7 }, loginTitle: { color: "#17201A", fontSize: 25, fontWeight: "800", letterSpacing: -0.7, marginTop: 7 }, loginCopy: { color: "#66736A", fontSize: 13.5, lineHeight: 20, marginTop: 7 }, socialButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE4DF", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 15, minHeight: 52 }, socialPressed: { opacity: 0.72 }, socialText: { color: "#17201A", fontSize: 14, fontWeight: "700" }, loginLaterNote: { color: "#66736A", fontSize: 11.5, lineHeight: 16, marginTop: 11, textAlign: "center" }, loginCancel: { alignItems: "center", marginTop: 11, padding: 9 }, loginCancelText: { color: "#66736A", fontSize: 13, fontWeight: "700" },
});
