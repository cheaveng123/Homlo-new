// Page 2 of 4: Part-time / Full-time / Volunteer / Weekends. One route, one screen.
// Reads the `tab` param the home sends and renders JobTypeScreen with live data:
// Part-time / Full-time from homlo.searchJobs, Volunteer / Weekends from the home
// feed's server-composed sections. The picker on the page switches the type in
// place (local state), so the same hooks simply follow the selected type.
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import JobTypeScreen, { type ListedJob } from '@/components/jobs-v2/JobTypeScreen';
import { HOME_JOB_TYPES } from '@/lib/job-types';
import { useJobStore } from '@/components/job-store';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useJobSearch } from '@/hooks/use-job-search';
import { sectionLoadState, useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { employerIdForCompany } from '@/lib/mock/employerMockData';
import { haptic } from '@/lib/haptics';

/** Picker order and labels follow the Home Job type cards. */
const TYPES = HOME_JOB_TYPES.map((t) => ({ key: t.key, label: t.label }));
const TAB_SLUGS: string[] = TYPES.map((t) => t.key);

type FeedState = { jobs: ListedJob[]; loading: boolean; error: boolean; refetch: () => void };

// Mounted only while weekends/volunteer is selected, because useHomeFeed has no
// `enabled` option. It reports the selected section up to the screen.
function FeedBridge({ type, onData }: { type: 'weekends' | 'volunteer'; onData: (s: FeedState) => void }) {
  const { weekend, volunteer, ready, error, refetch } = useHomeFeed();

  // Skeleton until the feed and its job records are in (`ready`); an error
  // settles it so the page can show its retry state.
  const settled = ready || !!error;
  const weekendLoading = sectionLoadState({ settled, count: weekend.length }) === 'loading';
  const volunteerLoading = sectionLoadState({ settled, count: volunteer.length }) === 'loading';

  const jobs = type === 'weekends' ? weekend : volunteer;
  const loading = type === 'weekends' ? weekendLoading : volunteerLoading;
  useEffect(() => {
    onData({ jobs, loading, error: !!error, refetch });
    // refetch is a new function each render; the data fields drive updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, loading, error, onData]);
  return null;
}

export default function WaysToWorkScreen() {
  const router = useRouter();
  const { isSaved, toggleSaved } = useJobStore();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initial = TAB_SLUGS[Math.max(0, TAB_SLUGS.indexOf(String(tabParam ?? '')))];
  const [type, setType] = useState(initial);
  const [feed, setFeed] = useState<FeedState | null>(null);
  // A new `tab` param (e.g. a deep link while this page is open) wins over the picker.
  const [lastParam, setLastParam] = useState(initial);
  if (initial !== lastParam) {
    setLastParam(initial);
    setType(initial);
  }

  // Only the selected type's hook fires; disabled hooks never load.
  const partTime = useJobSearch({ employmentType: 'Part-time', limit: 50, sort: 'recommended' }, { enabled: type === 'part-time' });
  const fullTime = useJobSearch({ employmentType: 'Full-time', limit: 50, sort: 'recommended' }, { enabled: type === 'full-time' });

  // useJobSearch returns [] while loading; an empty array counts as data to the
  // flag, which hid the skeleton and flashed the empty state. Treat [] as none.
  const partTimeLoading = useFirstLoadSkeletonFlag({ loading: partTime.loading, data: partTime.jobs.length ? partTime.jobs : undefined });
  const fullTimeLoading = useFirstLoadSkeletonFlag({ loading: fullTime.loading, data: fullTime.jobs.length ? fullTime.jobs : undefined });

  const isFeed = type === 'weekends' || type === 'volunteer';
  const search = type === 'full-time' ? fullTime : partTime;
  const jobs: ListedJob[] = isFeed ? feed?.jobs ?? [] : search.jobs;
  const loading = isFeed ? feed?.loading ?? true : type === 'full-time' ? fullTimeLoading : partTimeLoading;
  const error = isFeed ? !!feed?.error : !!search.error;

  return (
    <>
      {isFeed ? <FeedBridge type={type as 'weekends' | 'volunteer'} onData={setFeed} /> : null}
      <JobTypeScreen
        types={TYPES}
        type={type}
        onSelectType={(key) => {
          if (key === 'weekends' || key === 'volunteer') setFeed(null);
          setType(key);
        }}
        jobs={jobs}
        loading={loading}
        error={error}
        onRetry={() => (isFeed ? feed?.refetch() : void search.refetch())}
        onBack={() => router.back()}
        onSearch={() => router.push('/search-detail' as never)}
        onFilters={() => router.push('/explore/filters' as never)}
        onNearMe={() => router.push('/jobs/near-you' as never)}
        onOpenJob={(id) => {
          haptic.light();
          router.push({ pathname: '/job/[id]', params: { id } } as never);
        }}
        onOpenEmployer={(company) => {
          haptic.light();
          router.push({ pathname: '/employer/[employerId]', params: { employerId: employerIdForCompany(company) } } as never);
        }}
        isSaved={isSaved}
        onToggleSave={(id) => toggleSaved(id)}
      />
    </>
  );
}
