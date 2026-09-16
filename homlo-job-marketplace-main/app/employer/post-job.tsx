import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { ChevronLeft, X, Camera, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { JobLocationPicker, PickedAddress } from '@/components/JobLocationPicker';
import { PostJobExitModal } from '@/components/PostJobExitModal';
import { opportunityCategories } from '@/lib/category-data';
import {
  buildJobSaveInput,
  defaultJobPosting,
  type EmploymentType,
  type JobPostingDraft,
  type JobSaveInput,
  type WorkArrangement,
} from '@/lib/job-posting';
import { pickerImageToJpegDataUrl } from '@/lib/profile-photo';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

const CATEGORIES = opportunityCategories.map((category) => category.title);

const EMPLOYMENT_TYPES = ['Part time', 'Full time', 'Weekends', 'Contract'];
const ARRANGEMENTS = ['On-site', 'Hybrid', 'Remote'] as const;
const SALARY_TYPES = ['Hourly', 'Monthly', 'Yearly'] as const;

const SALARY_BOUNDS: Record<(typeof SALARY_TYPES)[number], [number, number]> = {
  Hourly: [1, 30],
  Monthly: [100, 1500],
  Yearly: [1200, 18000],
};

const TOTAL_STEPS = 7; // steps 0-6 are questions/preview; step 7 is success

export default function PostJobWizard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [arrangement, setArrangement] = useState<(typeof ARRANGEMENTS)[number] | null>(
    null
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryType, setSalaryType] =
    useState<(typeof SALARY_TYPES)[number]>('Monthly');
  const [salaryMax, setSalaryMax] = useState(650);

  const { user } = useAuth();
  const saveJob = trpc.homlo.employer.saveJob.useMutation();
  const utils = trpc.useUtils();

  const [minBound, maxBound] = SALARY_BOUNDS[salaryType];

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(7, i));
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onMomentumEnd = (e: any) => {
    setStep(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const toSaveInput = (status: 'draft' | 'open'): JobSaveInput => {
    const draft: JobPostingDraft = {
      ...defaultJobPosting,
      title,
      category,
      employmentType: (employmentType ?? '') as EmploymentType,
      workArrangement: (arrangement ?? '') as WorkArrangement,
      salaryMax: String(salaryMax),
      salaryCurrency: 'USD',
      salaryVisible: true,
      salaryPeriod:
        salaryType === 'Hourly' ? 'Per hour' : salaryType === 'Yearly' ? 'Per year' : 'Per month',
      description,
      requirements,
      bannerImage: photoUri ?? '',
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      city: address?.city ?? 'Phnom Penh',
      district: address?.district ?? '',
      address: address?.street ?? '',
      country: 'Cambodia',
    };
    return buildJobSaveInput(draft, status, savedDraftId);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(await pickerImageToJpegDataUrl(result.assets[0], { maxWidth: 1600 }));
  };

  const publish = async () => {
    if (publishing) return;
    if (!user) { router.replace('/login' as never); return; }
    setPublishing(true);
    try {
      const response = await saveJob.mutateAsync(toSaveInput('open'));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setSavedDraftId(job.id);
      // Targeted invalidation (never a global cache flush): refresh the scopes
      // the new listing must appear in — the employer hub, Home live list and
      // the Jobs search.
      void utils.homlo.employer.jobs.invalidate();
      void utils.homlo.publicJobs.invalidate();
      void utils.homlo.searchJobs.invalidate();
      void utils.homlo.homeFeed.invalidate();
      goTo(7);
    } catch {
      // Stay on the preview step; the job is not published.
    } finally {
      setPublishing(false);
    }
  };

  const goToListings = () => {
    router.replace({ pathname: '/employer/listings', params: { tab: 'live' } });
  };

  const saveDraft = async () => {
    if (saving) return;
    if (!user) { router.replace('/login' as never); return; }
    setSaving(true);
    try {
      const response = await saveJob.mutateAsync(toSaveInput('draft'));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setSavedDraftId(job.id);
      void utils.homlo.employer.jobs.invalidate();
      setExitModalVisible(false);
      router.back();
    } catch {
      // Keep the modal open so the employer can retry or discard.
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setExitModalVisible(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => goTo(step - 1)}
          hitSlop={10}
          style={[styles.iconBtn, (step === 0 || step === 7) && styles.iconBtnHidden]}
        >
          <ChevronLeft size={18} color="#12271F" />
        </Pressable>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, ((step + 1) / TOTAL_STEPS) * 100)}%` },
            ]}
          />
        </View>

        {step < 7 && <Text style={styles.stepLabel}>{step + 1} / {TOTAL_STEPS}</Text>}

        <Pressable
          onPress={() => setExitModalVisible(true)}
          hitSlop={10}
          style={[styles.iconBtn, step === 7 && styles.iconBtnHidden]}
        >
          <X size={16} color="#12271F" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {/* ---------- Step 1: title + category ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Job details</Text>
          <Text style={styles.subheading}>Title and category</Text>

          <Text style={styles.label}>Job title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Barista"
            placeholderTextColor="#8FA69B"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.cta, !title && styles.ctaDisabled]}
            disabled={!title}
            onPress={() => goTo(1)}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 2: employment + arrangement ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Employment</Text>
          <Text style={styles.subheading}>Type and work arrangement</Text>

          <View style={styles.grid}>
            {EMPLOYMENT_TYPES.map((t) => {
              const active = employmentType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.gridCell, active && styles.cellActive]}
                  onPress={() => setEmploymentType(t)}
                >
                  <Text style={[styles.cellText, active && styles.cellTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>Work arrangement</Text>
          <View style={styles.rowGroup}>
            {ARRANGEMENTS.map((a) => {
              const active = arrangement === a;
              return (
                <Pressable
                  key={a}
                  style={[styles.rowChip, active && styles.cellActive]}
                  onPress={() => setArrangement(a)}
                >
                  <Text style={[styles.rowChipText, active && styles.cellTextActive]}>
                    {a}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.cta, !(employmentType && arrangement) && styles.ctaDisabled]}
            disabled={!(employmentType && arrangement)}
            onPress={() => goTo(2)}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 3: photo ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Job photo</Text>
          <Text style={styles.subheading}>Shown on the job card</Text>

          <Pressable style={styles.photoBox} onPress={pickPhoto}>
            <Camera size={26} color="#5F7A6E" />
            <Text style={styles.photoHint}>
              {photoUri ? 'Photo selected' : 'Tap to upload a photo'}
            </Text>
          </Pressable>

          <Pressable style={styles.cta} onPress={() => goTo(3)}>
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 4: location ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Location</Text>
          <Text style={styles.subheading}>Search or drop a pin</Text>

          <JobLocationPicker onSelect={setAddress} />

          <Pressable
            style={[styles.cta, !address && styles.ctaDisabled]}
            disabled={!address}
            onPress={() => goTo(4)}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 5: description + requirements ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Description</Text>
          <Text style={styles.subheading}>What the job is, and what it takes</Text>

          <Text style={styles.label}>Job description</Text>
          <TextInput
            style={styles.textarea}
            value={description}
            onChangeText={setDescription}
            placeholder="What will they do day to day?"
            placeholderTextColor="#8FA69B"
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Requirements</Text>
          <TextInput
            style={styles.textarea}
            value={requirements}
            onChangeText={setRequirements}
            placeholder="Experience, skills, certifications..."
            placeholderTextColor="#8FA69B"
            multiline
            numberOfLines={4}
          />

          <Pressable style={styles.cta} onPress={() => goTo(5)}>
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 6: salary ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Salary range</Text>
          <Text style={styles.subheading}>Pick a pay period</Text>

          <View style={styles.salaryTypeRow}>
            {SALARY_TYPES.map((t) => {
              const active = salaryType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.rowChip, active && styles.cellActive]}
                  onPress={() => {
                    setSalaryType(t);
                    setSalaryMax(
                      Math.round((SALARY_BOUNDS[t][0] + SALARY_BOUNDS[t][1]) / 2)
                    );
                  }}
                >
                  <Text style={[styles.rowChipText, active && styles.cellTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sliderLabels}>
            <Text style={styles.sliderValue}>${minBound}</Text>
            <Text style={styles.sliderValue}>${salaryMax}</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={minBound}
            maximumValue={maxBound}
            step={salaryType === 'Hourly' ? 1 : 10}
            value={salaryMax}
            onValueChange={setSalaryMax}
            minimumTrackTintColor="#5DCAA5"
            maximumTrackTintColor="#E1E8E3"
            thumbTintColor="#0F3D2B"
          />

          <Pressable style={styles.cta} onPress={() => goTo(6)}>
            <Text style={styles.ctaText}>Preview listing</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 7: preview ---------- */}
        <ScrollView style={{ width }} contentContainerStyle={styles.page}>
          <Text style={styles.heading}>Preview</Text>
          <Text style={styles.subheading}>Check before publishing</Text>

          <View style={styles.previewCard}>
            <View style={styles.previewThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>{title || 'Job title'}</Text>
              <Text style={styles.previewMeta}>
                {employmentType ?? '—'} · {arrangement ?? '—'}
              </Text>
              <View style={styles.previewTag}>
                <Text style={styles.previewTagText}>
                  ${salaryMax}/{salaryType === 'Hourly' ? 'hr' : salaryType === 'Yearly' ? 'yr' : 'mo'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.previewHint}>
            This job container is exactly how it will appear to job seekers. Go
            back to any step to edit.
          </Text>

          <Pressable style={[styles.cta, publishing && styles.ctaDisabled]} onPress={() => void publish()} disabled={publishing}>
            <Text style={styles.ctaText}>{publishing ? 'Publishing…' : 'Publish'}</Text>
          </Pressable>
        </ScrollView>

        {/* ---------- Step 8: success ---------- */}
        <View style={{ width, ...styles.successPage }}>
          <View style={styles.successBadge}>
            <Check size={28} color="#04342C" />
          </View>
          <Text style={styles.successTitle}>Your listing is live</Text>
          <Text style={styles.successSubtitle}>
            This listing is now visible to candidates on the Jobs search.
          </Text>
          <Pressable style={styles.cta} onPress={goToListings}>
            <Text style={styles.ctaText}>Go to listings</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PostJobExitModal
        visible={exitModalVisible}
        onSaveDraft={() => void saveDraft()}
        onDiscard={discard}
        onCancel={() => setExitModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
// Do not substitute percentages, flex sizing, or a theme spacing scale.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnHidden: { opacity: 0 },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E1E8E3',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#5DCAA5' },
  stepLabel: { fontSize: 11, color: '#5F7A6E' },

  page: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32 },
  heading: { fontSize: 20, fontWeight: '600', color: '#12271F', marginBottom: 2 },
  subheading: { fontSize: 12, color: '#5F7A6E', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#12271F', marginBottom: 6 },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: '#12271F',
  },
  textarea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#12271F',
    minHeight: 84,
    textAlignVertical: 'top',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#5DCAA5', borderColor: '#5DCAA5' },
  chipText: { fontSize: 12, color: '#12271F' },
  chipTextActive: { color: '#04342C', fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: {
    width: '47%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
  },
  cellActive: { backgroundColor: '#5DCAA5', borderColor: '#5DCAA5' },
  cellText: { fontSize: 13, color: '#12271F' },
  cellTextActive: { color: '#04342C', fontWeight: '500' },

  rowGroup: { flexDirection: 'row', gap: 8 },
  rowChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    alignItems: 'center',
  },
  rowChipText: { fontSize: 12, color: '#12271F' },

  photoBox: {
    height: 150,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#DCE5E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoHint: { fontSize: 12, color: '#5F7A6E' },

  salaryTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sliderValue: { fontSize: 13, fontWeight: '500', color: '#12271F' },

  previewCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  previewThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#EAF6EF',
  },
  previewTitle: { fontSize: 14, fontWeight: '500', color: '#12271F' },
  previewMeta: { fontSize: 12, color: '#5F7A6E', marginTop: 2, marginBottom: 6 },
  previewTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF6EF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewTagText: { fontSize: 11, color: '#04342C' },
  previewHint: { fontSize: 12, color: '#5F7A6E', marginBottom: 16 },

  successPage: {
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  } as any,
  successBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5DCAA5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 18, fontWeight: '600', color: '#12271F', marginBottom: 6 },
  successSubtitle: {
    fontSize: 13,
    color: '#5F7A6E',
    textAlign: 'center',
    marginBottom: 20,
  },

  cta: {
    marginTop: 20,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#5DCAA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 15, fontWeight: '600', color: '#04342C' },
});