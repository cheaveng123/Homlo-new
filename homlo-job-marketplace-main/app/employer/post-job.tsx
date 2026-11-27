import React, { useState } from 'react';
import { PublishDeclarationSheet, type ListingTrustFields } from '@/components/legal/PublishDeclarationSheet';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from '@/lib/router';
import * as ImagePicker from '@/lib/native/image-picker';
import { ErrorStateIcon, SuccessIcon } from '@/src/components/icons';
import { PressableScale, Reveal } from '@/src/design/motion';
import { Skeleton } from '@/src/design/primitives';
import { palette, radii, shadows } from '@/src/design/tokens';
import { TextNew } from '@/src/new/components/TextNew';

import PostJobFlow, {
  type JobDraft,
  type JobType,
  type Arrangement,
  type SalaryPeriod,
} from '@/components/jobs-v2/PostJobFlow';
import {
  buildJobSaveInput,
  defaultJobPosting,
  type EmploymentType,
  type JobPostingDraft,
  type JobSaveInput,
  type WorkArrangement,
} from '@/lib/job-posting';
import { useAuth } from '@/hooks/use-auth';
import type { WeekDay } from '@/lib/work-time';
import { trpc } from '@/lib/trpc';
import { categorySlug, CATEGORY_NAMES } from '@/components/jobs-v2/categories';
import { JOB_FIELDS, resolveJobField } from '@/lib/job-fields';
import { JobFieldGlyph } from '@/components/shared/JobFieldGlyphs';
import { uploadJobImage } from '@/lib/job-management';
import { pickerImageToJpegDataUrl } from '@/lib/profile-photo';
import { PublishingProgress, type PublishStep } from '@/components/jobs-v2/PublishingProgress';

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
  // No "Volunteer" employment type exists in the save format; like Weekends it
  // is stored as Part-time. (Volunteer listings are recognised by their wording
  // or a $0 pay, see VOLUNTEER_PATTERN in lib/job-types.ts.)
  volunteer: 'Part-time',
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

type WorkTimeInput = {
  workDays: WeekDay[] | null;
  clockIn: string | null;
  clockOut: string | null;
  payMax: number | null;
};

type SaveFailure = { kind: 'limit' | 'error'; message: string };

type PlanId = 'free' | 'pro' | 'enterprise';

/**
 * Reads the server's plan-limit message, e.g.
 * "Your free plan allows 2 active jobs. ..." / "Your pro plan allows 50 published posts per month. ...",
 * and works out the plan the employer needs next.
 */
function planLimitDetails(message: string): { current: PlanId; required: PlanId; reason: 'active' | 'posts'; limit: string } {
  const plan = (message.match(/your\s+(free|pro|enterprise)\s+plan/i)?.[1]?.toLowerCase() ?? 'free') as PlanId;
  const limit = message.match(/allows\s+(\d+)/i)?.[1] ?? '';
  const reason = /post/i.test(message) && !/active/i.test(message) ? 'posts' : 'active';
  const required: PlanId = plan === 'free' ? 'pro' : 'enterprise';
  return { current: plan, required, reason, limit };
}

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
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  /** Progress screen: the steps for this publish, the one running, and the finished flag. */
  const [progress, setProgress] = useState<{ steps: PublishStep[]; step: number; done: boolean; jobTitle: string } | null>(null);
  /**
   * Set once the listing has gone live. Guards every destructive path: a live
   * job must never be sent back through the draft save (which would set
   * p_status='draft' on a real listing) or deleted by a stray discard.
   */
  const [published, setPublished] = useState(false);
  /** Set when the listing was submitted but waits for moderator review. */
  const [pendingReview, setPendingReview] = useState(false);
  /** The finished wizard draft waiting for the publish declaration sheet. */
  const [declaring, setDeclaring] = useState<JobDraft | null>(null);

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
    options?: { bannerImage?: string; jobId?: string | null; trust?: ListingTrustFields },
  ): JobSaveInput & Partial<ListingTrustFields> & WorkTimeInput => {
    // The wizard offers the 19 official job fields; the database still stores
    // the older category names. Map field -> database category through the
    // field aliases (e.g. "IT & Technology" -> "Technology"); a legacy name
    // (an older draft) resolves the same way.
    const field = resolveJobField(d.category ?? '');
    const category = field
      ? categories.find((c) => resolveJobField(c.name)?.id === field.id)
      : categories.find((c) => c.slug === categorySlug(d.category ?? ''));
    if (d.category && !category) {
      // No database category exists for this field yet (see the
      // add_job_field_categories migration), so the job is saved without a
      // category id. Logged so it is traceable.
      console.warn('[post-job] no database category matches', d.category);
    }
    const draft: JobPostingDraft = {
      ...defaultJobPosting,
      title: d.name.trim(),
      category: d.category ?? '',
      employmentType: d.type ? EMPLOYMENT_TYPE[d.type] : '',
      workArrangement: d.arrangement ? WORK_ARRANGEMENT[d.arrangement] : '',
      salaryMin: String(d.salaryMin),
      salaryMax: String(d.payMode === 'fixed' ? d.salaryMin : d.salaryMax),
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
    // Work time + pay range (059_job_work_time.sql). N/A parts are sent as null.
    const workTime: WorkTimeInput = {
      workDays: d.daysNA || d.workDays.length === 0 ? null : d.workDays,
      clockIn: d.hoursNA || !d.clockIn || !d.clockOut ? null : d.clockIn,
      clockOut: d.hoursNA || !d.clockIn || !d.clockOut ? null : d.clockOut,
      payMax: d.payMode === 'range' && d.salaryMax > d.salaryMin ? d.salaryMax : null,
    };
    return { ...input, categoryId: category?.id ?? null, ...(options?.trust ?? {}), ...workTime };
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

  const publish = async (d: JobDraft, trust: ListingTrustFields) => {
    if (publishing) return;
    if (!user) { router.replace('/login' as never); return; }
    setFailure(null);
    setPublishing(true);

    const steps: PublishStep[] = [
      { key: 'check', label: 'Checking your details' },
      ...(d.photoUri ? [{ key: 'photo', label: 'Uploading your photo' }] : []),
      { key: 'publish', label: 'Publishing to job seekers' },
    ];
    const advance = (key: string) =>
      setProgress((p) => (p ? { ...p, step: Math.max(p.step, steps.findIndex((s) => s.key === key)) } : p));
    setProgress({ steps, step: 0, done: false, jobTitle: d.name.trim() });

    try {
      let draftId = savedDraftId;
      let bannerImage = '';
      let bannerUploadFailed = false;

      if (d.photoUri) {
        // The photo needs a job id to upload against, so save a bannerless draft first.
        const draftResponse = await saveJob.mutateAsync(toSaveInput(d, 'draft', { bannerImage: '' }));
        const draftJob = (draftResponse as { job?: { id?: string } }).job;
        draftId = draftJob?.id ?? savedDraftId;
        if (!draftId) throw new Error('Could not prepare the listing. Please try again.');
        setSavedDraftId(draftId);

        advance('photo');
        try {
          const image = await pickerImageToJpegDataUrl({ uri: d.photoUri });
          const uploaded = await uploadJobImage(draftId, image);
          bannerImage = uploaded.url;
        } catch (err) {
          bannerUploadFailed = true;
          console.warn('[post-job] banner upload failed', err);
        }
      }

      // Without a photo there is nothing to upload, so the listing is published in one save.
      advance('publish');
      const response = await saveJob.mutateAsync(toSaveInput(d, 'open', { bannerImage, jobId: draftId, trust }));
      const job = (response as { job?: { id?: string; status?: string } }).job;
      if (job?.id) setSavedDraftId(job.id);
      setPendingReview(job?.status === 'pending_review');

      // Let the ring close and the check draw before showing the success page.
      setProgress((p) => (p ? { ...p, done: true } : p));
      await new Promise((r) => setTimeout(r, 650));
      setPublished(true);
      setProgress(null);
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
      setProgress(null);
      const f = describeFailure(err);
      if (f.kind === 'limit') {
        // Over the plan: open Account plans on the plan that lifts the limit. The wizard
        // stays mounted underneath, so "Back" returns to the finished listing.
        const info = planLimitDetails(f.message);
        router.push({
          pathname: '/account-plans',
          params: { required: info.required, reason: info.reason, limit: info.limit, from: info.current },
        } as never);
      } else {
        setFailure(f);
      }
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
  // Loading: the wizard's own shape (header, progress, question, tiles) as skeletons.
  if (categoriesLoading) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top + 6 }]} accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
        <View style={styles.skelHeader}>
          <Skeleton width={42} height={42} radius={21} />
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Skeleton width={90} height={14} />
            <Skeleton width={130} height={10} />
          </View>
          <Skeleton width={42} height={42} radius={21} />
        </View>
        <View style={styles.skelProgress}>
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={5} radius={3} style={{ flex: 1, width: undefined }} />)}
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Skeleton width={52} height={52} radius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="30%" height={10} />
              <Skeleton width="85%" height={20} />
            </View>
          </View>
          <Skeleton width="90%" height={12} />
          <Skeleton height={54} radius={radii.input} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width="48%" height={104} radius={radii.tile} />)}
          </View>
        </View>
      </View>
    );
  }

  // Success is terminal: the listing is live and must not be re-saved as a
  // draft or deleted from here.
  if (published) {
    return (
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={[styles.successPage, { paddingBottom: insets.bottom + 24 }]}>
          <Reveal index={0} style={styles.successBadge}>
            <SuccessIcon size={72} />
          </Reveal>
          <Reveal index={1}>
            <TextNew variant="hero" heading weight="extrabold" color={palette.ink} align="center">
              {pendingReview ? 'Submitted for review' : 'Your job is live'}
            </TextNew>
            <TextNew variant="body" color={palette.muted} align="center" style={styles.successSubtitle}>
              {pendingReview
                ? 'Our team checks new and flagged listings before they appear. We will email you when it is live.'
                : 'Job seekers can now find it in Jobs search, on the map and in their recommendations.'}
            </TextNew>
          </Reveal>
          <Reveal index={2} style={{ alignSelf: 'stretch' }}>
            <PressableScale style={[styles.cta, shadows.lift]} onPress={goToListings} accessibilityRole="button">
              <TextNew variant="title" heading weight="bold" color="#fff">Go to my listings</TextNew>
            </PressableScale>
            {savedDraftId && !pendingReview ? (
              <PressableScale
                style={styles.successSecondary}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/boost/plan', params: { jobId: savedDraftId } } as never)
                }
              >
                <TextNew variant="title" heading weight="bold" color={palette.amberInk}>Boost this listing</TextNew>
              </PressableScale>
            ) : null}
          </Reveal>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <PostJobFlow
        categories={JOB_FIELDS.map((f) => f.title)}
        renderCategoryIcon={(name) => {
          const field = resolveJobField(name);
          return field ? <JobFieldGlyph id={field.id} size={24} /> : null;
        }}
        onPublish={(d) => setDeclaring(d)}
        onSaveDraft={(d) => void saveDraft(d)}
        onDiscard={() => void discard()}
        onPickPhoto={pickPhoto}
      />

      {declaring ? (
      <PublishDeclarationSheet
        visible
        listingText={declaring ? [declaring.name, declaring.description, ...declaring.requirements].filter(Boolean).join(' ') : ''}
        defaultEmployerName={user?.name ?? ''}
        onCancel={() => setDeclaring(null)}
        onConfirm={(trust) => {
          const d = declaring;
          setDeclaring(null);
          if (d) void publish(d, trust);
        }}
      />
      ) : null}

      {progress ? (
        <PublishingProgress steps={progress.steps} step={progress.step} done={progress.done} jobTitle={progress.jobTitle} />
      ) : null}

      {/*
        Failure screen. Rendered on top of the wizard (not instead of it) so the
        employer's answers survive and "Try again" returns to the final step.
      */}
      {failure ? (
        <View style={[styles.failureOverlay, { paddingTop: insets.top + 96 }]}>
          <View style={styles.successBadge}>
            <ErrorStateIcon size={72} surface={palette.page} />
          </View>
          <TextNew variant="header" heading weight="extrabold" color={palette.ink} align="center">
            {failure.kind === 'limit' ? "You've reached your listing limit" : "Couldn't publish your job"}
          </TextNew>
          <TextNew variant="body" color={palette.muted} align="center" style={styles.successSubtitle}>{failure.message}</TextNew>
          <View style={styles.failureNote}>
            <TextNew variant="caption" weight="semibold" color={palette.cyanDeep} align="center">
              Your answers are safe. Nothing you entered was lost.
            </TextNew>
          </View>
          {failure.kind === 'limit' ? (
            <PressableScale
              style={[styles.cta, shadows.lift]}
              accessibilityRole="button"
              onPress={() => {
                setFailure(null);
                router.push('/account-plans' as never);
              }}
            >
              <TextNew variant="title" heading weight="bold" color="#fff">See plans</TextNew>
            </PressableScale>
          ) : (
            <PressableScale style={[styles.cta, shadows.lift]} onPress={() => setFailure(null)} accessibilityRole="button">
              <TextNew variant="title" heading weight="bold" color="#fff">Try again</TextNew>
            </PressableScale>
          )}
          <PressableScale style={styles.successSecondary} onPress={() => setFailure(null)} accessibilityRole="button">
            <TextNew variant="title" heading weight="bold" color={palette.cyanDeep}>
              {failure.kind === 'limit' ? 'Back to my listing' : 'Back to editing'}
            </TextNew>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.page },

  skelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  skelProgress: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginTop: 12 },

  successPage: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: palette.cyanTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  successSubtitle: { marginTop: 8, marginBottom: 24 },

  failureOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.page,
    paddingHorizontal: 24,
    alignItems: 'stretch',
  },
  failureNote: {
    alignSelf: 'center',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.cyanTint,
  },

  cta: {
    marginTop: 12,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  successSecondary: {
    marginTop: 10,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});
