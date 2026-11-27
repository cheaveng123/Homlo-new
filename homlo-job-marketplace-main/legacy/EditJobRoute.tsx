// EmployerEditJobScreen (employer side): edit all details of a listed job
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from '@/lib/router';
import { AppIcon } from "@/components/ui/AppIcon";
import * as ImagePicker from '@/lib/native/image-picker';
import MintGradientButton from '@/components/employer-job/MintGradientButton';
import ConfirmActionSheet from '@/components/employer-job/ConfirmActionSheet';
import OptionPickerSheet from '@/components/employer-job/OptionPickerSheet';
import { ChipGroup, DropdownField, FieldWrap, Stepper, TextField, ToggleRow } from '@/components/employer-job/JobFormFields';
import { colors, font, shadows } from '@/components/employer-job/job-management-tokens';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';
import { pickerImageToJpegDataUrl } from '@/lib/profile-photo';
import {
  buildJobSavePayload,
  normalizeEmployerJob,
  uploadJobImage,
  type PayableJobStatus,
} from '@/lib/job-management';
import { opportunityCategories } from '@/lib/category-data';
import type { JobStatus } from '@/backend/domain/models';

// Real category list, the same one Post a Job / Quick Search use.
const CATEGORIES = opportunityCategories.map((c) => c.title);
const EMPLOYMENT = ['Full-time', 'Part-time', 'Weekends', 'Contract', 'Temporary', 'Seasonal', 'Internship', 'Freelance'];
const PAY_TYPES = ['Hourly', 'Daily', 'Monthly'];

function payableStatus(status: JobStatus): PayableJobStatus {
  return status === 'draft' || status === 'open' || status === 'closed' || status === 'cancelled' ? status : 'closed';
}

function payTypeLabel(payType: string): string {
  return payType === 'hourly' ? 'Hourly' : payType === 'daily' ? 'Daily' : 'Monthly';
}

function payTypeValue(label: string): 'hourly' | 'daily' | 'fixed' {
  return label === 'Hourly' ? 'hourly' : label === 'Daily' ? 'daily' : 'fixed';
}

export default function EmployerEditJobScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const saveJob = trpc.homlo.employer.saveJob.useMutation();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [employment, setEmployment] = useState('Weekends');
  const [arrangement, setArrangement] = useState('On-site');
  const [location, setLocation] = useState('');
  const [positions, setPositions] = useState(1);
  const [rate, setRate] = useState('');
  const [payType, setPayType] = useState('Hourly');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [autoClose, setAutoClose] = useState(true);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);

  const [picker, setPicker] = useState<'category' | 'employment' | 'pay' | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user && id) });
  const job = useMemo(() => {
    const rows = (jobsQuery.data as { jobs?: unknown[] } | undefined)?.jobs ?? [];
    const row = rows.find((candidate) => (candidate as { id?: unknown }).id === id);
    return row ? normalizeEmployerJob(row as never) : null;
  }, [jobsQuery.data, id]);

  // Seed the form once the job loads (fields not persisted server-side, like
  // employment type / work arrangement, keep the approved preview defaults).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!job || seededRef.current) return;
    seededRef.current = true;
    setTitle(job.title);
    setCategory(job.category ?? '');
    setLocation(job.locationLabel ?? '');
    setPositions(Math.max(job.rolesTotal, 1));
    setRate(job.payAmount > 0 ? String(job.payAmount) : '');
    setPayType(payTypeLabel(job.payType));
    setDescription(job.description);
    setRequirements(job.requirements ?? '');
    setImageUri(job.imageUrl ?? undefined);
  }, [job]);

  async function changeImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to change the job image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      aspect: [16, 9],
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingImage(true);
    try {
      const dataUrl = await pickerImageToJpegDataUrl(result.assets[0], { maxWidth: 1600 });
      const { url } = await uploadJobImage(id!, dataUrl);
      setImageUri(url);
    } catch {
      Alert.alert("Couldn't upload image", 'Try again in a moment.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!job) return;
    if (!title.trim()) {
      Alert.alert('Add a job title', 'Job title cannot be empty.');
      return;
    }
    if (job.status !== 'draft' && !description.trim()) {
      Alert.alert('Add a description', 'A short description is required for a published job.');
      return;
    }
    const payAmount = Number(rate);
    if (!payAmount || payAmount <= 0) {
      Alert.alert('Check the salary', 'Enter a salary amount greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await saveJob.mutateAsync(
        buildJobSavePayload(
          {
            title,
            description,
            requirements,
            category,
            imageUrl: imageUri ?? null,
            locationLabel: location,
            latitude: job.latitude,
            longitude: job.longitude,
            payAmount,
            payCurrency: job.payCurrency,
            payType: payTypeValue(payType),
            rolesTotal: positions,
          },
          {
            jobId: job.id,
            imageUrl: imageUri ?? null,
            status: payableStatus(job.status),
            autoCloseEnabled: autoClose,
          },
        ),
      );
      void utils.homlo.employer.jobs.invalidate();
      setSaved(true);
    } catch {
      Alert.alert("Couldn't save changes", 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  if (jobsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.mint} />
        <Text style={styles.centerTx}>Loading job</Text>
      </View>
    );
  }
  if (!user || !job) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTx}>
          {!user ? 'Sign in to edit this job.' : 'This listing is no longer available.'}
        </Text>
        <Pressable
          onPress={() => router.replace(!user ? ('/login' as never) : ('/employer' as never))}
          style={styles.centerBtn}
        >
          <Text style={styles.centerBtnTx}>{!user ? 'Sign in' : 'Back to listed jobs'}</Text>
        </Pressable>
      </View>
    );
  }

  const heroStyle = [styles.hero, { paddingTop: insets.top + 10 }];
  const heroInner = (
    <>
      <LinearGradient colors={['rgba(14,59,46,0.4)', 'rgba(14,59,46,0.85)']} style={StyleSheet.absoluteFill} />
      <View style={styles.bar}>
        <Pressable style={styles.ib} onPress={() => router.back()}>
          <AppIcon name="back" size={18} color={colors.forest} />
        </Pressable>
      </View>
      <Text style={styles.h1}>Edit job</Text>
      <Text style={styles.sub}>Update the details applicants see</Text>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {imageUri ? (
          <ImageBackground source={{ uri: imageUri }} style={heroStyle}>{heroInner}</ImageBackground>
        ) : (
          <View style={[heroStyle, { backgroundColor: colors.forest }]}>{heroInner}</View>
        )}

        <View style={[styles.photo, shadows.card]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.forest }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.photoTitle}>Job image</Text>
            <Text style={styles.photoSub}>Shown on your listing</Text>
          </View>
          <Pressable style={styles.change} onPress={() => void changeImage()}>
            <Text style={styles.changeTx}>{uploadingImage ? 'Uploading…' : 'Change'}</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <FieldWrap label="Job title">
            <TextField value={title} onChangeText={setTitle} />
          </FieldWrap>

          <FieldWrap label="Category">
            <ChipGroup
              options={['Hospitality & Service', 'Retail']}
              value={category}
              onChange={setCategory}
              onOtherPress={() => setPicker('category')}
            />
          </FieldWrap>

          <FieldWrap label="Employment type">
            <ChipGroup
              options={['Full-time', 'Part-time', 'Weekends']}
              value={employment}
              onChange={setEmployment}
              onOtherPress={() => setPicker('employment')}
            />
          </FieldWrap>

          <FieldWrap label="Work arrangement">
            <ChipGroup options={['On-site', 'Hybrid', 'Remote']} value={arrangement} onChange={setArrangement} />
          </FieldWrap>

          <FieldWrap label="Location">
            <TextField value={location} onChangeText={setLocation} />
          </FieldWrap>

          <FieldWrap label="Positions available">
            <Stepper value={positions} onChange={setPositions} />
          </FieldWrap>

          <FieldWrap label="Pay rate">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextField value={rate} onChangeText={setRate} keyboardType="decimal-pad" style={{ flex: 1.3 }} />
              <DropdownField value={payType} onPress={() => setPicker('pay')} style={{ flex: 1 }} />
            </View>
          </FieldWrap>

          <FieldWrap label="Description">
            <TextField value={description} onChangeText={setDescription} multiline />
          </FieldWrap>

          <FieldWrap label="Requirements">
            <TextField value={requirements} onChangeText={setRequirements} multiline />
          </FieldWrap>

          <ToggleRow label="Auto-close when all positions are filled" value={autoClose} onChange={setAutoClose} />
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* pinned save bar */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        locations={[0, 0.45]}
        pointerEvents="box-none"
        style={[styles.save, { paddingBottom: 22 + insets.bottom * 0.5 }]}
      >
        <MintGradientButton label={saving ? 'Saving…' : 'Save changes'} height={56} fontSize={16} onPress={() => void handleSave()} />
      </LinearGradient>

      {/* pickers */}
      <OptionPickerSheet
        visible={picker === 'category'}
        title="Choose a category"
        options={CATEGORIES}
        selected={category}
        onSelect={(v) => { setCategory(v); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <OptionPickerSheet
        visible={picker === 'employment'}
        title="Employment type"
        options={EMPLOYMENT}
        selected={employment}
        onSelect={(v) => { setEmployment(v); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <OptionPickerSheet
        visible={picker === 'pay'}
        title="Pay period"
        options={PAY_TYPES}
        selected={payType}
        onSelect={(v) => { setPayType(v); setPicker(null); }}
        onClose={() => setPicker(null)}
      />

      {/* saved pop-up */}
      <ConfirmActionSheet
        visible={saved}
        icon="check"
        title="Changes saved"
        message="Your listing is updated and applicants will see the new details."
        confirmLabel="Back to job"
        onConfirm={() => { setSaved(false); router.back(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 14 },
  centerTx: { fontFamily: font.b500, fontSize: 14, color: colors.forest, textAlign: 'center' },
  centerBtn: { backgroundColor: colors.mint, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20 },
  centerBtnTx: { fontFamily: font.b600, fontSize: 14, color: colors.white },
  hero: { paddingHorizontal: 20, paddingBottom: 70, overflow: 'hidden' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  ib: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: font.h800, fontSize: 28, letterSpacing: -0.5, color: colors.white },
  sub: { fontFamily: font.b400, fontSize: 13, marginTop: 4, color: 'rgba(255,255,255,0.85)' },
  photo: { marginTop: -48, marginHorizontal: 20, backgroundColor: colors.white, borderRadius: 26, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 72, height: 72, borderRadius: 20 },
  photoTitle: { fontFamily: font.b600, fontSize: 15, color: colors.forest },
  photoSub: { fontFamily: font.b400, fontSize: 12, color: colors.muted, marginTop: 1 },
  change: { backgroundColor: colors.tint, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  changeTx: { fontFamily: font.b600, fontSize: 13, color: colors.mint },
  form: { flexGrow: 1, marginTop: 20, backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 22, paddingHorizontal: 20 },
  save: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 30, paddingHorizontal: 20 },
});