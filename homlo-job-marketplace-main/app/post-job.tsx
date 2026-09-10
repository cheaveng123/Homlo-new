import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { opportunityCategories } from "@/lib/category-data";
import {
  buildJobSaveInput,
  defaultJobPosting,
  draftFromRemoteJob,
  formatPostingSalary,
  jobPostingDraftKey,
  jobPostingLiveKey,
  type EmploymentType,
  type JobPostingDraft,
  type RemoteJobRecord,
  type SalaryPeriod,
  type WorkArrangement,
  validatePostingStep,
} from "@/lib/job-posting";
import { currencyCode, currencyLabel, currencyOptions } from "@/lib/currencies";
import { defaultSearchCenter } from "@/lib/job-geography";
import { JobLocationMap } from "@/components/job-location-map";
import { reverseOpenStreetMapPlace, searchOpenStreetMapPlace, type MapCoordinate, type OpenStreetMapPlace } from "@/lib/openstreetmap-geocoding";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { JobBannerImage } from "@/components/job-banner-image";
import { haptic } from "@/lib/haptics";
import { fontFamilies } from "@/lib/typography";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

const employmentOptions: EmploymentType[] = ["Full-time", "Part-time", "Contract", "Internship"];
const arrangementOptions: WorkArrangement[] = ["On-site", "Hybrid", "Remote"];
const salaryPeriods: SalaryPeriod[] = ["Per month", "Per year", "Per day", "Per hour"];
const totalSteps = 7;

export default function PostJobScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<JobPostingDraft>(defaultJobPosting);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftNotice, setDraftNotice] = useState("");
  const [draftNoticeIsError, setDraftNoticeIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const backLockRef = useRef(false);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [remoteJobId, setRemoteJobId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const saveRemoteJob = trpc.homlo.employer.saveJob.useMutation();
  const utils = trpc.useUtils();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const employerJobs = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user && jobId), retry: false });

  const applyBannerAsset = (uri: string, mimeType: string, name: string) => {
    update("bannerImage", uri);
    update("bannerImageMimeType", mimeType);
    update("bannerImageName", name);
    haptic.success();
  };

  const applyBannerPickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 4 * 1024 * 1024) {
      setBannerError("Please choose an image smaller than 4 MB.");
      return;
    }
    applyBannerAsset(asset.uri, asset.mimeType ?? "image/jpeg", asset.fileName ?? "photo");
  };

  const pickBannerImage = () => {
    setBannerError("");
    haptic.light();
    if (Platform.OS === "web") {
      pickBannerFromWebBrowser();
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Add your job image", options: ["Cancel", "Take Photo", "Choose Photo", "Choose File"], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) void pickBannerFromCamera();
          else if (index === 2) void pickBannerFromLibrary();
          else if (index === 3) void pickBannerFromDocument();
        },
      );
      return;
    }
    void pickBannerFromLibrary();
  };

  const pickBannerFromCamera = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setBannerError("Camera access is needed to take a picture. Enable it in your device settings.");
        return;
      }
      applyBannerPickerResult(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85 }));
    } catch {
      setBannerError("We couldn’t open your camera. Please try again.");
    }
  };

  const pickBannerFromLibrary = async () => {
    try {
      applyBannerPickerResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85 }));
    } catch {
      setBannerError("We couldn’t open your photos. Please try again.");
    }
  };

  const pickBannerFromDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 4 * 1024 * 1024) {
        setBannerError("Please choose an image smaller than 4 MB.");
        return;
      }
      applyBannerAsset(asset.uri, asset.mimeType ?? "image/jpeg", asset.name ?? "photo");
    } catch {
      setBannerError("We couldn’t open your files. Please try again.");
    }
  };

  const pickBannerFromWebBrowser = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        setBannerError("Please choose an image smaller than 4 MB.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result !== "string" || !reader.result) {
          setBannerError("We couldn’t read that image. Please try another one.");
          return;
        }
        applyBannerAsset(reader.result, file.type || "image/jpeg", file.name || "photo");
      });
      reader.readAsDataURL(file);
    });
    input.click();
  };

  const clearBannerImage = () => {
    update("bannerImage", "");
    update("bannerImageMimeType", "");
    update("bannerImageName", "");
  };

  useEffect(() => {
    const sourceKey = mode === "live" ? jobPostingLiveKey : jobPostingDraftKey;
    AsyncStorage.getItem(sourceKey)
      .then((saved) => {
        if (saved) setDraft((current) => ({ ...current, ...(JSON.parse(saved) as JobPostingDraft) }));
      })
      .catch(() => undefined);
  }, [mode]);

  useEffect(() => {
    if (!jobId) return;
    const saved = employerJobs.data as RemoteJobRecord[] | undefined;
    const match = saved?.find((item) => item.id === jobId);
    if (match) {
      void Promise.resolve().then(() => {
        setDraft((current) => ({ ...current, ...draftFromRemoteJob(match), id: match.id }));
        setRemoteJobId(match.id);
        setErrors({});
      });
    }
  }, [jobId, employerJobs.data]);

  if (authLoading) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingScreen}><ActivityIndicator color="#08675F" /><Text style={styles.loadingText}>Restoring your account…</Text></View>
      </ScreenContainer>
    );
  }
  if (!user) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingScreen}><IconSymbol name="person.fill" size={26} color="#08675F" /><Text style={styles.signedOutTitle}>Sign in to post a job</Text><Text style={styles.signedOutCopy}>Your draft and published listings are linked to your secure Homlo account.</Text><ScalePressable hapticFeedback onPress={() => router.replace("/login" as never)} style={styles.signedOutButton}><Text style={styles.signedOutButtonText}>Sign in</Text></ScalePressable></View>
      </ScreenContainer>
    );
  }

  const update = <K extends keyof JobPostingDraft>(key: K, value: JobPostingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const mapJobInput = (status: "draft" | "open") => buildJobSaveInput(draft, status, remoteJobId);

  const saveDraft = async (leave = false) => {
    if (!user) { router.replace("/login" as never); return; }
    if (saving) return;
    setSaving(true);
    try {
      const response = await saveRemoteJob.mutateAsync(mapJobInput("draft"));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setRemoteJobId(job.id);
      await AsyncStorage.setItem(jobPostingDraftKey, JSON.stringify({ ...draft, id: job?.id ?? draft.id }));
      const nextId = job?.id;
      if (nextId) setDraft((current) => ({ ...current, id: nextId }));
      // The hub lists drafts by querying employer.jobs; refresh its cache (and
      // nothing else) so a newly saved draft appears without a manual reload.
      void utils.homlo.employer.jobs.invalidate();
      haptic.success();
      setDraftNoticeIsError(false);
      if (leave) router.replace("/employer" as never);
      else setDraftNotice("Draft saved securely to your Homlo account.");
    } catch (cause) {
      setDraftNoticeIsError(true);
      setDraftNotice(cause instanceof Error ? cause.message : "We could not save this draft.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (backLockRef.current) return;
    if (step === 1) {
      backLockRef.current = true;
      router.replace("/employer" as never);
    } else {
      setExitPrompt(true);
    }
  };

  const next = () => {
    const nextErrors = validatePostingStep(step, draft);
    if (Object.keys(nextErrors).length) {
      haptic.selection();
      setErrors(nextErrors);
      return;
    }
    haptic.light();
    setErrors({});
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const publish = async () => {
    if (publishing) return;
    if (!user) { router.replace("/login" as never); return; }
    const publishErrors = [1, 2, 3, 4, 5].flatMap((targetStep) => Object.entries(validatePostingStep(targetStep, draft)));
    if (publishErrors.length) {
      haptic.selection();
      setDraftNoticeIsError(true);
      setDraftNotice("Complete the highlighted fields before publishing.");
      setErrors(Object.fromEntries(publishErrors));
      const firstStep = Math.max(...Object.keys(Object.fromEntries(publishErrors)).map((key) => (key === "title" || key === "category" || key === "employmentType" || key === "workArrangement" ? 1 : key === "city" || key === "location" ? 2 : key === "description" ? 3 : key === "salaryMin" || key === "salaryMax" ? 4 : 5)));
      setStep(firstStep);
      return;
    }
    setPublishing(true);
    try {
      const response = await saveRemoteJob.mutateAsync(mapJobInput("open"));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setRemoteJobId(job.id);
      await AsyncStorage.removeItem(jobPostingDraftKey);
      setPublished(true);
      // Targeted invalidation (never a global cache flush): refresh the three
      // scopes the new listing must appear in — the employer hub, the Home live
      // list and the Jobs search. Active screens re-fetch in the background;
      // dormant queries just become stale and refresh on their next visit.
      void utils.homlo.employer.jobs.invalidate();
      void utils.homlo.publicJobs.invalidate();
      void utils.homlo.searchJobs.invalidate();
      void utils.homlo.homeFeed.invalidate();
      haptic.success();
    } catch (cause) {
      setDraftNoticeIsError(true);
      setDraftNotice(cause instanceof Error ? cause.message : "We could not publish this job. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const resetForm = () => {
    setPublished(false);
    setStep(1);
    setDraft({ ...defaultJobPosting });
    setRemoteJobId(null);
    setErrors({});
    setDraftNotice("");
    setDraftNoticeIsError(false);
    setBannerError("");
  };

  if (published) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.successScreen}>
          <View style={styles.successIcon}><IconSymbol name="checkmark.circle.fill" size={52} color="#08675F" /></View>
          <Text style={styles.successTitle}>Your job is live</Text>
          <Text style={styles.successCopy}>{draft.title} is now visible to candidates looking for opportunities like yours.</Text>
          <View style={styles.liveSummary}><Text numberOfLines={1} style={styles.liveSummaryTitle}>{draft.title}</Text><Text numberOfLines={1} style={styles.liveSummaryCompany}>{draft.companyName} · {draft.city || "Remote"}</Text></View>
          <View style={styles.successActions}>
            <ScalePressable hapticFeedback onPress={() => router.replace("/employer" as never)} style={[styles.primaryButton, styles.successPrimaryButton]}><Text style={styles.primaryButtonText}>Manage job</Text><IconSymbol name="arrow.right" size={18} color="#FFFFFF" /></ScalePressable>
            <ScalePressable hapticFeedback onPress={resetForm} style={styles.successSecondaryButton}><IconSymbol name="plus" size={17} color="#08675F" /><Text style={styles.secondaryButtonText}>Post another job</Text></ScalePressable>
          </View>
          <ScalePressable accessibilityLabel="Go to Home" hapticFeedback onPress={() => router.replace("/" as never)} style={styles.successTertiaryButton}><Text style={styles.successTertiaryText}>Go to Home</Text></ScalePressable>
        </Animated.View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 105 + Math.max(insets.bottom, 10) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <ScalePressable accessibilityLabel="Back to listings" accessibilityRole="button" hapticFeedback onPress={goBack} style={styles.backButton}><IconSymbol name="chevron.left" size={20} color="#16211F" /><Text style={styles.backButtonText}>Back</Text></ScalePressable>
            <Text style={styles.topTitle}>Post a job</Text>
            <ScalePressable hapticFeedback onPress={() => void saveDraft()} style={styles.draftButton}><Text style={styles.draftButtonText}>{saving ? "Saving…" : "Save draft"}</Text></ScalePressable>
          </View>
          <View style={styles.progressRow}><Text style={styles.progressText}>STEP {step} OF {totalSteps}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} /></View></View>
          {draftNotice ? <View style={[styles.notice, draftNoticeIsError && styles.noticeError]}><IconSymbol name={draftNoticeIsError ? "exclamationmark.circle.fill" : "checkmark.circle.fill"} size={16} color={draftNoticeIsError ? "#B13D3D" : "#08675F"} /><Text style={styles.noticeText}>{draftNotice}</Text></View> : null}
          <View key={step} style={styles.stepContent}>
            {step === 1 ? <JobBasics bannerError={bannerError} draft={draft} errors={errors} onClearBanner={clearBannerImage} onPickBanner={() => void pickBannerImage()} update={update} /> : null}
            {step === 2 ? <LocationStep draft={draft} errors={errors} update={update} /> : null}
            {step === 3 ? <DetailsStep draft={draft} errors={errors} update={update} /> : null}
            {step === 4 ? <CompensationStep draft={draft} errors={errors} update={update} /> : null}
            {step === 5 ? <ApplicationStep draft={draft} errors={errors} update={update} /> : null}
            {step === 6 ? <PreviewStep draft={draft} /> : null}
            {step === 7 ? <PublishStep draft={draft} /> : null}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {step > 1 ? <ScalePressable hapticFeedback onPress={() => setStep((current) => current - 1)} style={styles.footerBack}><Text style={styles.footerBackText}>Back</Text></ScalePressable> : <View style={styles.footerSpacer} />}
          <ScalePressable hapticFeedback={step < 7} onPress={step === 7 ? () => void publish() : next} style={[styles.primaryButton, publishing && styles.disabledButton]}><Text style={styles.primaryButtonText}>{publishing ? "Publishing…" : step === 7 ? "Publish job" : step === 6 ? "Continue to publish" : "Continue"}</Text><IconSymbol name="arrow.right" size={18} color="#FFFFFF" /></ScalePressable>
        </View>
        {exitPrompt ? <ExitPrompt onCancel={() => setExitPrompt(false)} onDiscard={() => { void AsyncStorage.removeItem(jobPostingDraftKey); router.replace("/employer" as never); }} onSave={() => void saveDraft(true)} /> : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

type StepProps = { draft: JobPostingDraft; errors: Record<string, string>; update: <K extends keyof JobPostingDraft>(key: K, value: JobPostingDraft[K]) => void };

function JobBasics({ bannerError, draft, errors, onClearBanner, onPickBanner, update }: StepProps & { bannerError: string; onPickBanner: () => void; onClearBanner: () => void }) {
  return <View><StepIntro title="Let’s create your job" copy="Tell candidates about the position you’re hiring for." /><InputField error={errors.title} label="Job title" onChangeText={(value) => update("title", value)} placeholder="e.g. Junior Software Developer" value={draft.title} /><View style={styles.selectFieldWrap}><SelectField accessibilityLabel="Choose job category" label="Category" onChange={(value) => update("category", value)} options={opportunityCategories.map((category) => category.title)} placeholder="Choose a category" value={draft.category} /></View>{errors.category ? <ErrorText message={errors.category} /> : null}<View style={styles.selectFieldWrap}><SelectField accessibilityLabel="Choose employment type" label="Employment type" onChange={(value) => update("employmentType", value as EmploymentType)} options={employmentOptions} placeholder="Choose employment type" value={draft.employmentType} /></View>{errors.employmentType ? <ErrorText message={errors.employmentType} /> : null}<View style={styles.selectFieldWrap}><SelectField accessibilityLabel="Choose work arrangement" label="Work arrangement" onChange={(value) => update("workArrangement", value as WorkArrangement)} options={arrangementOptions} placeholder="Choose work arrangement" value={draft.workArrangement} /></View>{errors.workArrangement ? <ErrorText message={errors.workArrangement} /> : null}<Text style={styles.fieldLabel}>Banner image</Text><Text style={styles.fieldHint}>Add a photo of the workplace, office, or role — landscape 16:9 works best. Upload from your photos or take a new picture.</Text><BannerImagePreview draft={draft} onClear={onClearBanner} onPick={onPickBanner} />{bannerError ? <ErrorText message={bannerError} /> : null}</View>;
}

function LocationStep({ draft, errors, update }: StepProps) {
  const remote = draft.workArrangement === "Remote";
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<OpenStreetMapPlace[]>([]);
  const [mapError, setMapError] = useState("");

  const applyPlace = (place: OpenStreetMapPlace) => {
    update("latitude", place.coordinate.latitude);
    update("longitude", place.coordinate.longitude);
    update("city", place.city);
    update("district", place.district);
    update("province", place.province);
    update("country", place.country);
    update("postalCode", place.postalCode);
    if (place.addressLine) update("address", place.addressLine);
    setMapError("");
  };

  const handleCoordinateSelect = async (coordinate: MapCoordinate) => {
    update("latitude", coordinate.latitude);
    update("longitude", coordinate.longitude);
    setMapError("");
    try {
      const place = await reverseOpenStreetMapPlace({ latitude: coordinate.latitude, longitude: coordinate.longitude });
      if (place) {
        update("city", place.city || draft.city);
        update("district", place.district || draft.district);
        update("province", place.province || draft.province);
        update("country", place.country || draft.country);
        update("postalCode", place.postalCode || draft.postalCode);
        if (place.addressLine) update("address", place.addressLine);
      }
    } catch {
      setMapError("Couldn’t find the exact address. You can type it below.");
    }
  };

  const runSearch = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    try {
      setResults(await searchOpenStreetMapPlace(term));
    } catch {
      setResults([]);
      setMapError("No matches found. Try a different search.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <View>
      <StepIntro title="Where is the job?" copy={remote ? "Candidates will see that this is a remote position." : "Drop a pin or search for the exact work location."} />
      {remote ? (
        <View style={styles.remoteNotice}><IconSymbol name="mappin.and.ellipse" size={19} color="#08675F" /><View><Text style={styles.remoteNoticeTitle}>Remote position</Text><Text style={styles.remoteNoticeCopy}>No physical office location is required.</Text></View></View>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Search and pick the location on the map</Text>
          <View style={styles.searchRow}>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search country, city or address" style={styles.searchInput} onSubmitEditing={() => void runSearch()} returnKeyType="search" />
            <ScalePressable hapticFeedback onPress={() => void runSearch()} style={styles.searchButton}><Text style={styles.searchButtonText}>{searching ? "…" : "Search"}</Text></ScalePressable>
          </View>
          {results.length ? (
            <View style={styles.searchResults}>
              {results.map((place) => (
                <Pressable key={place.id} onPress={() => { setResults([]); setQuery(place.label); applyPlace(place); }} style={styles.searchResultRow}><IconSymbol name="mappin" size={14} color="#08675F" /><Text style={styles.searchResultText} numberOfLines={2}>{place.label}</Text></Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.mapWrap}>
            <JobLocationMap coordinate={draft.latitude != null && draft.longitude != null ? { latitude: draft.latitude, longitude: draft.longitude } : null} defaultCoordinate={defaultSearchCenter} onChange={(coordinate) => void handleCoordinateSelect(coordinate)} />
          </View>
          {mapError ? <ErrorText message={mapError} /> : null}
          {errors.location ? <ErrorText message={errors.location} /> : null}
          {draft.latitude != null ? <Text style={styles.pinText}><IconSymbol name="location.fill" size={13} color="#08675F" /> Pin set on the map</Text> : null}
          <InputField error={errors.city} label="City / town" onChangeText={(value) => update("city", value)} placeholder="e.g. Phnom Penh" value={draft.city} />
          <InputField label="Province / state" onChangeText={(value) => update("province", value)} placeholder="Optional" value={draft.province} />
          <InputField label="District / area" onChangeText={(value) => update("district", value)} placeholder="Optional" value={draft.district} />
          <InputField label="Street address" multiline onChangeText={(value) => update("address", value)} placeholder="Optional" value={draft.address} />
          <InputField label="Postal code" onChangeText={(value) => update("postalCode", value)} placeholder="Optional" value={draft.postalCode} />
        </>
      )}
    </View>
  );
}

function DetailsStep({ draft, errors, update }: StepProps) {
  return <View><StepIntro title="Tell candidates about the role" copy="Keep the essentials clear and easy to scan on mobile." /><InputField error={errors.description} label="Job description" multiline onChangeText={(value) => update("description", value)} placeholder="Describe the role, team, and the impact this person will make." value={draft.description} /><InputField label="Responsibilities" multiline onChangeText={(value) => update("responsibilities", value)} placeholder="What will this person do day to day?" value={draft.responsibilities} /><InputField label="Requirements" multiline onChangeText={(value) => update("requirements", value)} placeholder="Skills, experience, or qualifications." value={draft.requirements} /><InputField label="Skills" onChangeText={(value) => update("skills", value)} placeholder="e.g. React, communication, Excel" value={draft.skills} /><InputField label="Benefits" multiline onChangeText={(value) => update("benefits", value)} placeholder="Optional perks, learning, or wellbeing support." value={draft.benefits} /></View>;
}

function CompensationStep({ draft, errors, update }: StepProps) {
  const min = Number(draft.salaryMin);
  const max = Number(draft.salaryMax);
  const rangeSwapped = draft.salaryMin.trim() !== "" && draft.salaryMax.trim() !== "" && Number.isFinite(min) && Number.isFinite(max) && min > max;
  return <View><StepIntro title="Compensation" copy="Salary is optional. You can keep it private or share a useful range." /><View style={styles.switchRow}><View><Text style={styles.switchTitle}>Show salary publicly</Text><Text style={styles.switchCopy}>Candidates see the range on your job.</Text></View><Switch onValueChange={(value) => update("salaryVisible", value)} thumbColor="#FFFFFF" trackColor={{ false: "#CBD8D4", true: "#08675F" }} value={draft.salaryVisible} /></View>{draft.salaryVisible ? <><View style={styles.inputPair}><View style={styles.pairHalf}><InputField error={errors.salaryMin} keyboardType="numeric" label="Minimum salary" onChangeText={(value) => update("salaryMin", value)} placeholder="e.g. 600" value={draft.salaryMin} /></View><View style={styles.pairHalf}><InputField error={errors.salaryMax} keyboardType="numeric" label="Maximum salary" onChangeText={(value) => update("salaryMax", value)} placeholder="e.g. 900" value={draft.salaryMax} /></View></View>{rangeSwapped && !errors.salaryMin && !errors.salaryMax ? <ErrorText message="Minimum must be lower than or equal to maximum." /> : null}<View style={styles.selectFieldWrap}><SelectField accessibilityLabel="Choose currency" label="Currency" onChange={(value) => update("salaryCurrency", currencyCode(value))} options={currencyOptions} placeholder="Choose currency" value={currencyLabel(draft.salaryCurrency)} /></View><View style={styles.selectFieldWrap}><SelectField accessibilityLabel="Choose salary period" label="Salary period" onChange={(value) => update("salaryPeriod", value as SalaryPeriod)} options={salaryPeriods} placeholder="Choose salary period" value={draft.salaryPeriod} /></View></> : <View style={styles.negotiableNote}><IconSymbol name="checkmark.circle.fill" size={18} color="#08675F" /><Text style={styles.negotiableText}>Candidates will see “Salary not disclosed.”</Text></View>}</View>;
}

function ApplicationStep({ draft, errors, update }: StepProps) {
  return <View><StepIntro title="Application" copy="Candidates apply and message you inside Homlo — no external links or contact details needed." /><View style={styles.homloApply}><IconSymbol name="checkmark.circle.fill" size={20} color="#08675F" /><View><Text style={styles.homloApplyTitle}>Apply through Homlo</Text><Text style={styles.homloApplyCopy}>Candidates submit their details and start a conversation with you directly in the app. This keeps every application and follow-up in one place.</Text></View></View><InputField label="Application deadline" onChangeText={(value) => update("deadline", value)} placeholder="Optional · e.g. 30 September 2026" value={draft.deadline} /></View>;
}

function PreviewStep({ draft }: { draft: JobPostingDraft }) {
  return <View><StepIntro title="Preview your job" copy="This is how candidates will experience the key details of your listing." /><View style={styles.previewCard}><View style={styles.previewBanner}><PreviewBannerImage bannerUri={draft.bannerImage} category={draft.category} title={draft.title} /><View style={styles.previewBannerOverlay} /><View style={styles.previewBannerCopy}><Text style={styles.previewCategory}>{draft.category || "Category"}</Text><Text style={styles.previewTitle}>{draft.title || "Your job title"}</Text><Text style={styles.previewCompany}>{draft.companyName}</Text></View></View><View style={styles.previewBody}><Text style={styles.previewLocation}>{draft.workArrangement === "Remote" ? "Remote position" : `${draft.city || "Location"}${draft.district ? ` · ${draft.district}` : ""}`}</Text><Text style={styles.previewPay}>{formatPostingSalary(draft)}</Text><Text numberOfLines={3} style={styles.previewDescription}>{draft.description || "Your job description will appear here, with the most important information easy to scan."}</Text></View></View><Text style={styles.previewHint}>You can use Back to edit any details before publishing.</Text></View>;
}

function PublishStep({ draft }: { draft: JobPostingDraft }) {
  return <View><StepIntro title="Ready to publish?" copy="Review the essentials one last time. You can also save this as a draft from the top right." /><View style={styles.publishSummary}><SummaryLine label="Job title" value={draft.title || "Not added"} /><SummaryLine label="Company" value={draft.companyName} /><SummaryLine label="Location" value={draft.workArrangement === "Remote" ? "Remote" : draft.city || "Not added"} /><SummaryLine label="Employment" value={draft.employmentType || "Not added"} /><SummaryLine label="Salary" value={formatPostingSalary(draft)} /><SummaryLine label="Applications" value="Through Homlo" last /></View></View>;
}

function StepIntro({ title, copy }: { title: string; copy: string }) { return <View style={styles.intro}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageCopy}>{copy}</Text></View>; }

function BannerImagePreview({ draft, onClear, onPick }: { draft: JobPostingDraft; onClear: () => void; onPick: () => void }) {
  if (!draft.bannerImage) {
    return (
      <ScalePressable accessibilityLabel="Choose a banner image" hapticFeedback onPress={onPick} style={styles.bannerEmpty}>
        <View style={styles.bannerEmptyIcon}><IconSymbol name="photo.on.rectangle.angled" size={22} color="#08675F" /></View>
        <View style={styles.bannerEmptyCopy}><Text style={styles.bannerEmptyTitle}>Add a banner image</Text><Text style={styles.bannerEmptyHint}>Recommended: 1600 × 900 px (16:9) · Landscape works best</Text></View>
        <IconSymbol name="chevron.right" size={18} color="#08675F" />
      </ScalePressable>
    );
  }
  return (
    <View style={styles.bannerPreviewWrap}>
      <JobBannerImage accessibilityLabel="Banner preview" uri={draft.bannerImage} style={styles.bannerPreviewImage} />
      <View style={styles.bannerPreviewActions}>
        <ScalePressable accessibilityLabel="Replace banner image" hapticFeedback onPress={onPick} style={styles.bannerActionPrimary}><Text style={styles.bannerActionPrimaryText}>Replace</Text></ScalePressable>
        <ScalePressable accessibilityLabel="Remove banner image" hapticFeedback onPress={onClear} style={styles.bannerActionSecondary}><Text style={styles.bannerActionSecondaryText}>Remove</Text></ScalePressable>
      </View>
      {draft.bannerImageName ? <Text numberOfLines={1} style={styles.bannerFileName}>{draft.bannerImageName}</Text> : null}
    </View>
  );
}

function PreviewBannerImage({ bannerUri, category, title }: { bannerUri: string; category: string; title: string }) {
  if (bannerUri) return <JobBannerImage accessibilityLabel="Banner preview" uri={bannerUri} style={StyleSheet.absoluteFill} />;
  const initial = (category || title || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={[StyleSheet.absoluteFill, styles.previewBannerFallback]}><Text style={styles.previewBannerFallbackText}>{initial}</Text></View>
  );
}

function InputField({ error, keyboardType, label, multiline, onChangeText, placeholder, value }: { error?: string; keyboardType?: "default" | "numeric" | "email-address"; label: string; multiline?: boolean; onChangeText: (value: string) => void; placeholder?: string; value: string }) { return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput keyboardType={keyboardType} multiline={multiline} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8A9692" style={[styles.input, multiline && styles.multilineInput, error && styles.inputError]} textAlignVertical={multiline ? "top" : "center"} value={value} />{error ? <ErrorText message={error} /> : null}</View>; }

function ErrorText({ message }: { message: string }) { return <Text style={styles.errorText}>{message}</Text>; }
function SummaryLine({ label, value, last }: { label: string; value: string; last?: boolean }) { return <View style={[styles.summaryLine, !last && styles.summaryDivider]}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }
function ExitPrompt({ onCancel, onDiscard, onSave }: { onCancel: () => void; onDiscard: () => void; onSave: () => void }) { return <View style={styles.promptOverlay}><View style={styles.promptCard}><Text style={styles.promptTitle}>Save this job as a draft?</Text><Text style={styles.promptCopy}>Keep your progress and finish publishing whenever you are ready.</Text><ScalePressable hapticFeedback onPress={onSave} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save draft</Text></ScalePressable><ScalePressable hapticFeedback onPress={onDiscard} style={styles.discardButton}><Text style={styles.discardText}>Discard</Text></ScalePressable><Pressable onPress={onCancel} style={styles.continueEditing}><Text style={styles.continueEditingText}>Continue editing</Text></Pressable></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, paddingBottom: 120 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, backButton: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 1, minHeight: 38, paddingRight: 8 }, backButtonText: { color: "#405148", fontSize: 13, fontWeight: "600" }, topTitle: { color: "#16211F", fontSize: 15, fontWeight: "600" }, draftButton: { paddingHorizontal: 6, paddingVertical: 8 }, draftButtonText: { color: "#08675F", fontSize: 12.5, fontWeight: "600" }, progressRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 20 }, progressText: { color: "#64716E", fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6 }, progressTrack: { backgroundColor: "#DFE9E6", borderRadius: 3, flex: 1, height: 4, overflow: "hidden" }, progressFill: { backgroundColor: "#08675F", height: 4 }, notice: { alignItems: "center", backgroundColor: "#EFF8F5", borderRadius: 10, flexDirection: "row", gap: 7, marginTop: 16, padding: 10 }, noticeError: { backgroundColor: "#FBEFEF" }, noticeText: { color: "#197166", flex: 1, fontSize: 11.5, lineHeight: 16 }, searchRow: { flexDirection: "row", gap: 8 }, searchInput: { backgroundColor: "#FFFFFF", borderColor: "#DCE5E2", borderRadius: 11, borderWidth: 1, color: "#16211F", flex: 1, fontFamily: fontFamilies.regular, fontSize: 13.5, minHeight: 46, paddingHorizontal: 13 }, searchButton: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 11, justifyContent: "center", minWidth: 66, paddingHorizontal: 12 }, searchButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" }, searchResults: { backgroundColor: "#FFFFFF", borderRadius: 11, borderWidth: 1, borderColor: "#DCE5E2", marginTop: 8, maxHeight: 220, overflow: "hidden" }, searchResultRow: { alignItems: "center", borderBottomColor: "#EEF2F0", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, padding: 12 }, searchResultText: { color: "#23312D", flex: 1, fontSize: 12.5, lineHeight: 17 }, mapWrap: { borderRadius: 12, height: 230, marginTop: 10, overflow: "hidden" }, pinText: { color: "#197166", fontSize: 12, fontWeight: "600", marginTop: 10 }, stepContent: { flex: 1 }, intro: { marginTop: 27 }, pageTitle: { color: "#16211F", fontSize: 25, fontWeight: "700", letterSpacing: -0.7 }, pageCopy: { color: "#64716E", fontSize: 13.5, lineHeight: 20, marginTop: 7 }, fieldWrap: { marginTop: 20 }, selectFieldWrap: { marginTop: 20 }, fieldLabel: { color: "#23312D", fontSize: 13, fontWeight: "600", marginBottom: 9 },   input: { backgroundColor: "#FFFFFF", borderColor: "#DCE5E2", borderRadius: 11, borderWidth: 1, color: "#16211F", fontFamily: fontFamilies.regular, fontSize: 13.5, minHeight: 48, paddingHorizontal: 13 }, multilineInput: { minHeight: 106, paddingTop: 12 }, inputError: { borderColor: "#C74D4D" }, errorText: { color: "#B13D3D", fontSize: 11.5, marginTop: 6 }, chipList: { gap: 8, paddingRight: 8 }, choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, loadingScreen: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 }, loadingText: { color: "#64716E", fontSize: 13 }, signedOutTitle: { color: "#16211F", fontSize: 19, fontWeight: "700", marginTop: 6 }, signedOutCopy: { color: "#64716E", fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 320, textAlign: "center" }, signedOutButton: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 12, justifyContent: "center", marginTop: 14, minHeight: 48, paddingHorizontal: 22 }, signedOutButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, choiceChip: { backgroundColor: "#F0F6F4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, choiceChipActive: { backgroundColor: "#E0F0EC", borderColor: "#08675F", borderWidth: 1 }, choiceChipText: { color: "#53615D", fontSize: 12, fontWeight: "500" }, choiceChipTextActive: { color: "#08675F", fontWeight: "600" }, remoteNotice: { alignItems: "center", backgroundColor: "#EFF8F5", borderRadius: 12, flexDirection: "row", gap: 10, marginTop: 23, padding: 14 }, remoteNoticeTitle: { color: "#1A302B", fontSize: 13.5, fontWeight: "600" }, remoteNoticeCopy: { color: "#64716E", fontSize: 11.5, marginTop: 3 }, switchRow: { alignItems: "center", backgroundColor: "#F7FBF9", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", marginTop: 23, padding: 13 }, switchTitle: { color: "#23312D", fontSize: 13.5, fontWeight: "600" }, switchCopy: { color: "#72807C", fontSize: 11.5, marginTop: 3 }, inputPair: { flexDirection: "row", gap: 10 }, pairHalf: { flex: 1 }, negotiableNote: { alignItems: "center", backgroundColor: "#EFF8F5", borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 22, padding: 12 }, negotiableText: { color: "#197166", flex: 1, fontSize: 12.5 }, homloApply: { alignItems: "center", backgroundColor: "#F7FBF9", borderRadius: 11, flexDirection: "row", gap: 9, marginTop: 19, padding: 13 }, homloApplyTitle: { color: "#23312D", fontSize: 13, fontWeight: "600" }, homloApplyCopy: { color: "#71817C", fontSize: 11.5, marginTop: 3 }, previewCard: { backgroundColor: "#FFFFFF", borderColor: "#E0E8E4", borderRadius: 14, borderWidth: 1, marginTop: 22, overflow: "hidden" }, previewBanner: { aspectRatio: 16 / 9, backgroundColor: "#0B7368", maxHeight: 260, overflow: "hidden", padding: 16, position: "relative" }, previewBannerOverlay: { backgroundColor: "rgba(8, 60, 56, 0.42)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, previewBannerCopy: { bottom: 14, left: 16, position: "absolute", right: 16 }, previewBannerFallback: { alignItems: "center", backgroundColor: "#0B7368", justifyContent: "center" }, previewBannerFallbackText: { color: "#C4EEE5", fontSize: 56, fontWeight: "700" }, fieldHint: { color: "#64716E", fontSize: 11.5, lineHeight: 16, marginBottom: 9, marginTop: -2 }, bannerEmpty: { alignItems: "center", backgroundColor: "#F4F7F5", borderColor: "#D7E1DC", borderRadius: 12, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 86, padding: 14 }, bannerEmptyIcon: { alignItems: "center", backgroundColor: "#E0F0EC", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, bannerEmptyCopy: { flex: 1 }, bannerEmptyTitle: { color: "#16211F", fontSize: 13, fontWeight: "600" }, bannerEmptyHint: { color: "#64716E", fontSize: 11.5, marginTop: 2 }, bannerPreviewWrap: { marginTop: 4 }, bannerPreviewImage: { aspectRatio: 16 / 9, backgroundColor: "#E0E8E4", borderRadius: 12, maxHeight: 240, overflow: "hidden" }, bannerPreviewActions: { flexDirection: "row", gap: 8, marginTop: 9 }, bannerActionPrimary: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 10, justifyContent: "center", minHeight: 38, paddingHorizontal: 16 }, bannerActionPrimaryText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "600" }, bannerActionSecondary: { alignItems: "center", borderColor: "#DCE5E2", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 16 }, bannerActionSecondaryText: { color: "#08675F", fontSize: 12.5, fontWeight: "600" }, bannerFileName: { color: "#94A098", fontSize: 11, marginTop: 6 }, previewCategory: { color: "#C4EEE5", fontSize: 11.5, fontWeight: "500" }, previewTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", letterSpacing: -0.5, marginTop: 21 }, previewCompany: { color: "#D8F3ED", fontSize: 12.5, marginTop: 5 }, previewBody: { padding: 15 }, previewLocation: { color: "#60706B", fontSize: 12.5 }, previewPay: { color: "#08675F", fontSize: 13, fontWeight: "600", marginTop: 8 }, previewDescription: { color: "#53615D", fontSize: 12.5, lineHeight: 18, marginTop: 13 }, previewHint: { color: "#74817D", fontSize: 11.5, lineHeight: 16, marginTop: 11 }, publishSummary: { backgroundColor: "#FFFFFF", borderColor: "#E0E8E4", borderRadius: 14, borderWidth: 1, marginTop: 22, paddingHorizontal: 14 }, summaryLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 13 }, summaryDivider: { borderBottomColor: "#E7ECEA", borderBottomWidth: 1 }, summaryLabel: { color: "#74817D", fontSize: 11.5 }, summaryValue: { color: "#16211F", fontSize: 12.5, fontWeight: "600", maxWidth: "58%", textAlign: "right" }, footer: { alignItems: "center", backgroundColor: "#FFFEFC", borderTopColor: "#E7ECEA", borderTopWidth: 1, bottom: 0, flexDirection: "row", gap: 10, left: 0, paddingHorizontal: 20, paddingTop: 11, position: "absolute", right: 0 }, footerBack: { paddingHorizontal: 9, paddingVertical: 13 }, footerBackText: { color: "#08675F", fontSize: 13.5, fontWeight: "600" }, footerSpacer: { width: 0 }, primaryButton: { alignItems: "center", backgroundColor: "#08675F", borderRadius: 12, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 49, paddingHorizontal: 14 }, primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" }, disabledButton: { opacity: 0.6 }, promptOverlay: { alignItems: "center", backgroundColor: "rgba(14, 30, 27, 0.36)", bottom: 0, justifyContent: "flex-end", left: 0, padding: 14, position: "absolute", right: 0, top: 0, zIndex: 30 }, promptCard: { backgroundColor: "#FFFEFC", borderRadius: 18, padding: 20, width: "100%" }, promptTitle: { color: "#16211F", fontSize: 19, fontWeight: "700" }, promptCopy: { color: "#64716E", fontSize: 13.5, lineHeight: 19, marginTop: 7 }, discardButton: { alignItems: "center", borderColor: "#E7ECEA", borderRadius: 12, borderWidth: 1, marginTop: 10, minHeight: 46 }, discardText: { color: "#B13D3D", fontSize: 13.5, fontWeight: "600", lineHeight: 46 }, continueEditing: { alignItems: "center", padding: 13 }, continueEditingText: { color: "#08675F", fontSize: 13.5, fontWeight: "600" }, successScreen: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 24 }, successIcon: { alignItems: "center", backgroundColor: "#E0F0EC", borderRadius: 43, height: 86, justifyContent: "center", width: 86 }, successTitle: { color: "#16211F", fontSize: 27, fontWeight: "700", letterSpacing: -0.7, marginTop: 22 }, successCopy: { color: "#64716E", fontSize: 14, lineHeight: 21, marginTop: 9, textAlign: "center" }, liveSummary: { backgroundColor: "#F0F8F6", borderRadius: 12, marginTop: 20, padding: 14, width: "100%" }, liveSummaryTitle: { color: "#16211F", fontSize: 14, fontWeight: "600" }, liveSummaryCompany: { color: "#64716E", fontSize: 12, marginTop: 4 }, successPrimaryButton: { flex: 0, minHeight: 52, width: "100%" }, successSecondaryButton: { alignItems: "center", borderColor: "#DCE5E2", borderRadius: 12, borderWidth: 1, marginTop: 14, minHeight: 50, justifyContent: "center", width: "100%" }, secondaryButton: { alignItems: "center", marginTop: 11, minHeight: 44 }, secondaryButtonText: { color: "#08675F", fontSize: 13.5, fontWeight: "600" }, successActions: { marginTop: 24, width: "100%" }, successTertiaryButton: { alignItems: "center", marginTop: 10, minHeight: 40 }, successTertiaryText: { color: "#64716E", fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
});
