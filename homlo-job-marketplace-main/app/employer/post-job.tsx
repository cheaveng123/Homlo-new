import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from "@/components/ui/AppIcon";

import PostJobFlow, {
  type JobDraft,
  type JobType,
  type Arrangement,
  type SalaryPeriod,
} from '@/components/jobs-v2/PostJobFlow';
import { JobLocationPicker } from '@/components/JobLocationPicker';
import {
  buildJobSaveInput,
  defaultJobPosting,
  type EmploymentType,
  type JobPostingDraft,
  type JobSaveInput,
  type WorkArrangement,
} from '@/lib/job-posting';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';
import { categorySlug, CATEGORY_NAMES } from '@/components/jobs-v2/categories';
import { uploadJobImage } from '@/lib/job-management';
import { pickerImageToJpegDataUrl } from '@/lib/profile-photo';

/**
 * Route for the employer "post a job" wizard.
 *
 * This file owns persistence only. The step machine, draft object and all of the
 * UI live in `PostJobFlow`, which hands a finished `JobDraft` back through
 * `onPublish` / `onSaveDraft` / `onDiscard`.
 *
 * Failure handling: publish and draft-save errors used to be swallowed by an
 * empty catch, so a rejected save looked like "nothing happens". Errors are now
 * logged and shown to the employer. The wizard stays mounted underneath the
 * failure screen so none of their answers are lost when they tap "Try again".
 */

const EMPLOYMENT_TYPE: Record<JobType, EmploymentType> = {
  'part-time': 'Part-time',
  'full-time': 'Full-time',
  weekends: 'Part-time',
};

const WORK_ARRANGEMENT: Record<Arrangement, WorkArrangement> = {
  'on-site': 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

const SALARY_PERIOD: Record<SalaryPeriod, JobPostingDraft['salaryPeriod']> = {
  hourly: 'Per hour',
  monthly: 'Per month',
  yearly: 'Per year',
};

type Category = { id: string; name: string; slug: string };

type SaveFailure = { kind: 'limit' | 'error'; message: string };

/**
 * Turns whatever the mutation threw into something showable. A plan/listing
 * limit is recognised from the tRPC code or from the server's message, so the
 * employer sees an upgrade prompt instead of a generic error.
 */
function describeFailure(err: unknown): SaveFailure {
  const e = (err ?? {}) as { message?: string; data?: { code?: string } };
  const message = (e.message ?? '').trim();
  const code = e.data?.code ?? '';
  const looksLikeLimit =
    code === 'TOO_MANY_REQUESTS' || /limit|quota|maximum|upgrade/i.test(message);
  if (looksLikeLimit) {
    return {
      kind: 'limit',
      message: message || 'Your account has reached its limit for live listings.',
    };
  }
  return {
    kind: 'error',
    message: message || 'Something went wrong while saving your listing. Please try again.',
  };
}

export default function PostJobWizard() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  /**
   * Set once the listing has gone live. Guards every destructive path: a live
   * job must never be sent back through the draft save (which would set
   * p_status='draft' on a real listing) or deleted by a stray discard.
   */
  const [published, setPublished] = useState(false);

  const { user } = useAuth();
  const saveJob = trpc.homlo.employer.saveJob.useMutation();
  const deleteJob = trpc.homlo.employer.deleteJob.useMutation();
  const utils = trpc.useUtils();

  const { data: categoriesData, isLoading: categoriesLoading } = trpc.homlo.categories.useQuery();
  const dbCategories: Category[] = categoriesData?.categories ?? [];
  const localCats = (CATEGORY_NAMES || []).map((name, idx) => ({
    id: `local-${idx}`,
    name,
    slug: categorySlug(name) || name.toLowerCase().replace(/\s+/g, '-'),
  }));
  const categories: Category[] = dbCategories.length > 0 ? dbCategories : localCats;

  const toSaveInput = (
    d: JobDraft,
    status: 'draft' | 'open',
    options?: { bannerImage?: string; jobId?: string | null },
  ): JobSaveInput => {
    const slug = categorySlug(d.category ?? '');
    const category = categories.find((c) => c.slug === slug);
    if (d.category && !category) {
      // The wizard offers a category the database does not have, so the job
      // is saved with no category id. Logged so a rejected save is traceable.
      console.warn('[post-job] no database category matches', d.category, '->', slug);
    }
    const draft: JobPostingDraft = {
      ...defaultJobPosting,
      title: d.name.trim(),
      category: d.category ?? '',
      employmentType: d.type ? EMPLOYMENT_TYPE[d.type] : '',
      workArrangement: d.arrangement ? WORK_ARRANGEMENT[d.arrangement] : '',
      salaryMin: String(d.salaryMin),
      salaryMax: String(d.salaryMax),
      salaryCurrency: 'USD',
      salaryVisible: true,
      salaryPeriod: SALARY_PERIOD[d.salaryPeriod],
      description: d.description,
      requirements: d.requirements.filter((r) => r.trim()).join('\n'),
      bannerImage: options?.bannerImage ?? '',
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      city: 'Phnom Penh',
      district: '',
      address: d.address.trim(),
      country: 'Cambodia',
      workersNeeded: d.positions,
      autoCloseEnabled: d.autoClose,
    };
    const input = buildJobSaveInput(draft, status, options?.jobId ?? savedDraftId);
    // Override categoryId with the actual UUID from database
    return { ...input, categoryId: category?.id ?? null };
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return undefined;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return undefined;
    return result.assets[0]?.uri;
  };

  const publish = async (d: JobDraft) => {
    if (publishing) return;
    if (!user) { router.replace('/login' as never); return; }
    setFailure(null);
    setPublishing(true);
    try {
      const draftResponse = await saveJob.mutateAsync(toSaveInput(d, 'draft', { bannerImage: '' }));
      const draftJob = (draftResponse as { job?: { id?: string } }).job;
      const draftId = draftJob?.id ?? savedDraftId;
      if (!draftId) throw new Error('Could not prepare the listing. Please try again.');
      setSavedDraftId(draftId);

      let bannerImage = '';
      let bannerUploadFailed = false;
      if (d.photoUri) {
        try {
          const image = await pickerImageToJpegDataUrl({ uri: d.photoUri });
          const uploaded = await uploadJobImage(draftId, image);
          bannerImage = uploaded.url;
        } catch (err) {
          bannerUploadFailed = true;
          console.warn('[post-job] banner upload failed', err);
        }
      }

      const response = await saveJob.mutateAsync(toSaveInput(d, 'open', { bannerImage, jobId: draftId }));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setSavedDraftId(job.id);
      setPublished(true);
      if (bannerUploadFailed) {
        Alert.alert(
          'Published without a photo',
          "We couldn't upload your banner photo, so your listing is live without one.",
        );
      }
      // Targeted invalidation (never a global cache flush): refresh the scopes
      // the new listing must appear in — the employer hub, Home live list and
      // the Jobs search.
      void utils.homlo.employer.jobs.invalidate();
      void utils.homlo.publicJobs.invalidate();
      void utils.homlo.searchJobs.invalidate();
      void utils.homlo.homeFeed.invalidate();
    } catch (err) {
      console.warn('[post-job] publish failed', err);
      setFailure(describeFailure(err));
    } finally {
      setPublishing(false);
    }
  };

  const goToListings = () => {
    router.replace({ pathname: '/employer/listings', params: { tab: 'live' } });
  };

  const saveDraft = async (d: JobDraft) => {
    // Once the job is live, "save as draft" would re-save it with
    // p_status='draft' and pull the listing out of search. Refuse outright.
    if (saving || published) return;
    if (!user) { router.replace('/login' as never); return; }
    setSaving(true);
    try {
      const response = await saveJob.mutateAsync(toSaveInput(d, 'draft'));
      const job = (response as { job?: { id?: string } }).job;
      if (job?.id) setSavedDraftId(job.id);
      void utils.homlo.employer.jobs.invalidate();
      router.back();
    } catch (err) {
      // Keep the sheet open so the employer can retry or discard, and say why.
      console.warn('[post-job] save draft failed', err);
      Alert.alert("Couldn't save draft", describeFailure(err).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Discards the in-progress listing. "Discard" used to only navigate away,
   * which left a draft saved earlier in this session sitting in the employer's
   * dashboard forever, so the modal's promise to "discard it" was never kept.
   * The draft is now actually deleted when this session created one.
   */
  const discard = async () => {
    if (discarding) return;
    setDiscarding(true);
    try {
      if (savedDraftId && !published) {
        await deleteJob.mutateAsync({ jobId: savedDraftId });
        void utils.homlo.employer.jobs.invalidate();
      }
    } catch (err) {
      // A failed delete must not strand the employer on the sheet for a listing
      // they have already chosen to throw away.
      console.warn('[post-job] discard failed', err);
    } finally {
      setDiscarding(false);
      router.back();
    }
  };

  // Show loading while categories fetch
  if (categoriesLoading) {
    return (
      <View style={styles.safe}>
        <ActivityIndicator size="large" color="#5DCAA5" style={{ flex: 1, justifyContent: 'center' }} />
      </View>
    );
  }

  // Success is terminal: the listing is live and must not be re-saved as a
  // draft or deleted from here.
  if (published) {
    return (
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successPage}>
          <View style={styles.successBadge}>
            <AppIcon name="check" size={28} color="#04342C" />
          </View>
          <Text style={styles.successTitle}>Your listing is live</Text>
          <Text style={styles.successSubtitle}>
            This listing is now visible to candidates on the Jobs search.
          </Text>
          <Pressable style={styles.cta} onPress={goToListings}>
            <Text style={styles.ctaText}>Go to listings</Text>
          </Pressable>
          {savedDraftId ? (
            <Pressable
              style={styles.successSecondary}
              onPress={() =>
                router.push({ pathname: '/boost/plan', params: { jobId: savedDraftId } } as never)
              }
            >
              <Text style={styles.successSecondaryText}>Boost this listing</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <PostJobFlow
        categories={categories.map((c) => c.name)}
        onPublish={(d) => void publish(d)}
        onSaveDraft={(d) => void saveDraft(d)}
        onDiscard={() => void discard()}
        onPickPhoto={pickPhoto}
        renderMap={({ onChange }) => (
          <JobLocationPicker
            onSelect={(address) =>
              onChange({
                address:
                  address.formatted || [address.street, address.district, address.city].filter(Boolean).join(', '),
                latitude: address.latitude,
                longitude: address.longitude,
              })
            }
          />
        )}
      />

      {/*
        Failure screen. Rendered on top of the wizard (not instead of it) so the
        employer's answers survive and "Try again" returns to the final step.
      */}
      {failure ? (
        <View style={styles.failureOverlay}>
          <View style={styles.failureBadge}>
            <Text style={styles.failureBadgeText}>!</Text>
          </View>
          <Text style={styles.failureTitle}>
            {failure.kind === 'limit' ? "You've reached your listing limit" : "Couldn't publish your listing"}
          </Text>
          <Text style={styles.failureSubtitle}>{failure.message}</Text>
          {failure.kind === 'limit' ? (
            <Pressable
              style={styles.cta}
              onPress={() => {
                setFailure(null);
                router.push('/account-plans' as never);
              }}
            >
              <Text style={styles.ctaText}>See plans</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cta} onPress={() => setFailure(null)}>
              <Text style={styles.ctaText}>Try again</Text>
            </Pressable>
          )}
          <Pressable style={styles.successSecondary} onPress={() => setFailure(null)}>
            <Text style={styles.successSecondaryText}>
              {failure.kind === 'limit' ? 'Back to my listing' : 'Back to editing'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
// Do not substitute percentages, flex sizing, or a theme spacing scale.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  successPage: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
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
  successTitle: { fontSize: 18, fontWeight: '600', color: '#12271F', marginBottom: 6, textAlign: 'center' },
  successSubtitle: {
    fontSize: 13,
    color: '#5F7A6E',
    textAlign: 'center',
    marginBottom: 20,
  },

  failureOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 120,
    alignItems: 'center',
  },
  failureBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBEAE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  failureBadgeText: { fontSize: 28, fontWeight: '700', color: '#C0392B' },

  cta: {
    marginTop: 20,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  successSecondary: {
    marginTop: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successSecondaryText: { fontSize: 14, fontWeight: '600', color: '#C0392B' },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  failureTitle: { fontSize: 18, fontWeight: '600', color: '#C0392B', marginBottom: 6, textAlign: 'center' },
  failureSubtitle: {
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    marginBottom: 20,
  },
});
