import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { BookOpen, Camera, ChevronDown, ChevronRight, MapPin, X } from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { pickerImageToJpegDataUrl } from "@/lib/profile-photo";
import {
  buildJobSavePayload,
  editableFieldsFromJob,
  normalizeEmployerJob,
  uploadJobImage,
  type PayableJobStatus,
} from "@/lib/job-management";
import {
  clearJobEditDraft,
  readJobEditDraft,
  type JobEditDraft,
} from "@/lib/job-edit-draft";
import type { EditableJobFields, JobStatus, PayType } from "@/backend/domain/models";

const PAY_TYPE_ORDER: PayType[] = ["hourly", "daily", "fixed"];

function payTypeCycle(current: PayType): PayType {
  return PAY_TYPE_ORDER[(PAY_TYPE_ORDER.indexOf(current) + 1) % PAY_TYPE_ORDER.length]!;
}

function payableStatus(status: JobStatus): PayableJobStatus {
  return status === "draft" || status === "open" || status === "closed" || status === "cancelled"
    ? status
    : "closed";
}

export default function EditJobScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = id;
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const saveJob = trpc.homlo.employer.saveJob.useMutation();

  const [fields, setFields] = useState<EditableJobFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user && jobId) });
  const job = useMemo(() => {
    const rows = (jobsQuery.data as { jobs?: unknown[] } | undefined)?.jobs ?? [];
    const row = rows.find((candidate) => (candidate as { id?: unknown }).id === jobId);
    return row ? normalizeEmployerJob(row as never) : null;
  }, [jobsQuery.data, jobId]);

  const originalFields = useMemo(() => (job ? editableFieldsFromJob(job) : null), [job]);

  // Seed the form once the job loads.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!originalFields || seededRef.current) return;
    seededRef.current = true;
    setFields(originalFields);
  }, [originalFields]);

  // Apply a picker-written draft once (on focus return), waiting for the form
  // to initialize if the user lands here before the job finished loading.
  const fieldsReadyRef = useRef(false);
  const pendingDraftRef = useRef<JobEditDraft | null>(null);
  useEffect(() => {
    if (fields) fieldsReadyRef.current = true;
  }, [fields]);

  const applyDraft = useCallback((draft: JobEditDraft) => {
    setFields((prev) =>
      prev
        ? {
            ...prev,
            category: draft.category ?? prev.category,
            locationLabel: draft.locationLabel || prev.locationLabel,
            latitude: draft.latitude ?? prev.latitude,
            longitude: draft.longitude ?? prev.longitude,
          }
        : prev,
    );
  }, []);

  useEffect(() => {
    if (!fields || !pendingDraftRef.current) return;
    applyDraft(pendingDraftRef.current);
    pendingDraftRef.current = null;
  }, [fields, applyDraft]);

  useFocusEffect(
    useCallback(() => {
      if (!jobId) return;
      let cancelled = false;
      void readJobEditDraft(jobId).then((draft) => {
        if (cancelled || !draft) return;
        if (fieldsReadyRef.current) applyDraft(draft);
        else pendingDraftRef.current = draft;
        void clearJobEditDraft(jobId);
      });
      return () => {
        cancelled = true;
      };
    }, [jobId, applyDraft]),
  );

  function isDirty() {
    if (!originalFields || !fields) return false;
    return JSON.stringify(originalFields) !== JSON.stringify(fields);
  }

  function update<K extends keyof EditableJobFields>(key: K, value: EditableJobFields[K]) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to change the job image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      aspect: [16, 9],
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingImage(true);
    try {
      const dataUrl = await pickerImageToJpegDataUrl(result.assets[0], { maxWidth: 1600 });
      const { url } = await uploadJobImage(jobId!, dataUrl);
      update("imageUrl", url);
    } catch {
      Alert.alert("Couldn't upload image", "Try again in a moment.");
    } finally {
      setUploadingImage(false);
    }
  }

  function openLocationPicker() {
    router.push({
      pathname: "/employer/job/[id]/edit/location",
      params: {
        id: jobId!,
        lat: fields?.latitude != null ? String(fields.latitude) : "",
        lng: fields?.longitude != null ? String(fields.longitude) : "",
      },
    } as never);
  }

  function openCategoryPicker() {
    router.push({
      pathname: "/employer/job/[id]/edit/category",
      params: { id: jobId!, current: fields?.category ?? "" },
    } as never);
  }

  function cyclePayType() {
    if (!fields) return;
    update("payType", payTypeCycle(fields.payType));
  }

  function handleClose() {
    if (isDirty()) {
      Alert.alert("Discard changes?", "You have unsaved changes to this job.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }

  async function handleSave() {
    if (!fields || !job) return;
    if (!fields.title.trim()) {
      Alert.alert("Add a job title", "Job title cannot be empty.");
      return;
    }
    if (job.status !== "draft" && !fields.description.trim()) {
      Alert.alert("Add a description", "A short description is required for a published job.");
      return;
    }
    if (!fields.payAmount || fields.payAmount <= 0) {
      Alert.alert("Check the salary", "Enter a salary amount greater than 0.");
      return;
    }
    setSaving(true);
    try {
      await saveJob.mutateAsync(
        buildJobSavePayload(fields, {
          jobId: job.id,
          imageUrl: fields.imageUrl,
          status: payableStatus(job.status),
        }),
      );
      void utils.homlo.employer.jobs.invalidate();
      router.back();
    } catch {
      Alert.alert("Couldn't save changes", "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-sm font-semibold text-foreground text-center">Sign in to edit this job.</Text>
        <TouchableOpacity onPress={() => router.replace("/login" as never)} className="mt-4 bg-primary rounded-2xl px-6 py-3">
          <Text className="text-white text-sm font-semibold">Sign in</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (!fields || (jobsQuery.isLoading && !job)) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator color="#16803C" />
        <Text className="mt-3 text-sm text-muted">Loading job</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right"]}>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14 }}>
        {/* Top bar */}
        <View className="flex-row items-center justify-between mb-3.5">
          <TouchableOpacity onPress={handleClose} hitSlop={10}>
            <X size={20} color="#17201A" />
          </TouchableOpacity>
          <Text className="text-[15px] font-semibold text-foreground">Edit job</Text>
          <TouchableOpacity onPress={() => void handleSave()} disabled={saving} hitSlop={10}>
            <Text className="text-[13px] font-semibold text-primary">{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <TouchableOpacity
          onPress={() => void pickImage()}
          activeOpacity={0.85}
          className="rounded-2xl overflow-hidden h-[110px] mb-4 bg-primary"
        >
          {fields.imageUrl ? (
            <ImageBackground source={{ uri: fields.imageUrl }} className="flex-1" resizeMode="cover">
              <ChangePhotoBadge uploading={uploadingImage} />
            </ImageBackground>
          ) : (
            <View className="flex-1 items-center justify-center">
              <BookOpen size={32} color="#EAF3DE" />
              <ChangePhotoBadge uploading={uploadingImage} />
            </View>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Field label="Job title">
          <TextInput
            value={fields.title}
            onChangeText={(value) => update("title", value)}
            className="bg-surface border border-border rounded-xl px-3 py-2.5 text-[14px] text-foreground"
            placeholder="e.g. English tutor (after-school)"
          />
        </Field>

        {/* Category */}
        <Field label="Category">
          <PickerRow value={fields.category ?? "Choose a category"} onPress={openCategoryPicker} />
        </Field>

        {/* Location */}
        <Field label="Location">
          <TouchableOpacity
            onPress={openLocationPicker}
            className="bg-surface border border-border rounded-xl px-3 py-2.5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2 flex-1">
              <MapPin size={16} color="#16803C" />
              <Text className="text-[13px] text-foreground" numberOfLines={1}>
                {fields.locationLabel || "Choose a location"}
              </Text>
            </View>
            <ChevronRight size={14} color="#94A098" />
          </TouchableOpacity>
        </Field>

        {/* Salary */}
        <Field label="Salary">
          <View className="flex-row gap-2.5">
            <TextInput
              value={String(fields.payAmount)}
              onChangeText={(value) => update("payAmount", Number(value.replace(/[^0-9.]/g, "")) || 0)}
              keyboardType="decimal-pad"
              className="flex-1 bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground"
            />
            <TouchableOpacity
              onPress={cyclePayType}
              className="flex-1 bg-surface border border-border rounded-xl px-3 py-2.5 flex-row items-center justify-between"
            >
              <Text className="text-[13px] text-foreground capitalize">{fields.payType}</Text>
              <ChevronDown size={14} color="#94A098" />
            </TouchableOpacity>
          </View>
        </Field>

        {/* Roles to fill */}
        <Field label="Roles to fill">
          <TextInput
            value={String(fields.rolesTotal)}
            onChangeText={(value) => update("rolesTotal", Number(value.replace(/[^0-9]/g, "")) || 0)}
            keyboardType="number-pad"
            className="bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground"
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <TextInput
            value={fields.description}
            onChangeText={(value) => update("description", value)}
            multiline
            numberOfLines={4}
            className="bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground leading-5"
            textAlignVertical="top"
          />
        </Field>

        {/* Requirements */}
        <Field label="Requirements" last>
          <TextInput
            value={fields.requirements}
            onChangeText={(value) => update("requirements", value)}
            multiline
            numberOfLines={3}
            className="bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground leading-5"
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={saving}
          className="bg-primary rounded-2xl py-3.5 items-center mt-1"
        >
          <Text className="text-white text-[14px] font-semibold">{saving ? "Saving..." : "Save changes"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function ChangePhotoBadge({ uploading }: { uploading: boolean }) {
  return (
    <View className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2.5 py-1.5 flex-row items-center gap-1.5">
      <Camera size={14} color="#fff" />
      <Text className="text-xs text-white">{uploading ? "Uploading..." : "Change photo"}</Text>
    </View>
  );
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View className={last ? "mb-4" : "mb-3"}>
      <Text className="text-xs text-muted mb-1">{label}</Text>
      {children}
    </View>
  );
}

function PickerRow({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface border border-border rounded-xl px-3 py-2.5 flex-row items-center justify-between"
    >
      <Text className="text-[13px] text-foreground">{value}</Text>
      <ChevronDown size={14} color="#94A098" />
    </TouchableOpacity>
  );
}