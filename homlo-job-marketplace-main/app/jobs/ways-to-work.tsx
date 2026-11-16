// Page 2 of 4: Part-time / Full-time / Weekends / Remote. One route, four v2 layouts.
// Reads the `tab` param the home sends and renders the matching jobs-v2 layout with
// live data: Part-time / Full-time from homlo.searchJobs, Weekends / Remote from the
// home feed's server-composed sections.
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PartTimeScreen, { type PartTimeJob } from '@/components/jobs-v2/PartTimeScreen';
import FullTimeScreen, { type FullTimeJob } from '@/components/jobs-v2/FullTimeScreen';
import WeekendsScreen, { type WeekendJob } from '@/components/jobs-v2/WeekendsScreen';
import RemoteScreen, { type RemoteJob } from '@/components/jobs-v2/RemoteScreen';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useJobSearch } from '@/hooks/use-job-search';
import { useFirstLoadSkeletonFlag } from '@/lib/useFirstLoadSkeletonFlag';
import { haptic } from '@/lib/haptics';

const TAB_SLUGS = ['part-time', 'full-time', 'weekends', 'remote'];

function monthlyAmount(pay: string): number {
  return Number(String(pay).replace(/[^0-9.]/g, '')) || 0;
}

// Wrapper so useHomeFeed only runs when the weekends/remote tab is active.
// useHomeFeed has no `enabled` option, so we conditionally mount this component.
function FeedJobs({ tab, openJob, goBack, goSearch, goFilters }: {
  tab: number; openJob: (id: string) => void; goBack: () => void;
  goSearch: () => void; goFilters: () => void;
}) {
  const { weekend, remote, loading: feedLoading } = useHomeFeed();

  // Hook calls are unconditional within this component (React hook rules).
  const weekendLoading = useFirstLoadSkeletonFlag({ loading: feedLoading, data: weekend });
  const remoteLoading = useFirstLoadSkeletonFlag({ loading: feedLoading, data: remote });

  if (tab === 2) {
    const jobs: WeekendJob[] = weekend.map((j) => {
      const sched = j.schedule?.toLowerCase() ?? '';
      const day = sched.includes('sunday') ? 'SUN' : sched.includes('saturday') ? 'SAT' : 'WEEKEND';
      return { id: j.id, day, hours: j.schedule || 'Flexible hours', title: j.title, company: j.company, pay: j.pay };
    });
    return <WeekendsScreen jobs={jobs} onBack={goBack} onJobPress={openJob} loading={weekendLoading} />;
  }

  if (tab === 3) {
    const jobs: RemoteJob[] = remote.map((j) => ({
      id: j.id, title: j.title, company: j.company, pay: j.pay,
      photo: j.image ? { uri: j.image } : undefined,
    }));
    return (
      <RemoteScreen
        jobs={jobs}
        countLabel={`${jobs.length} work-from-anywhere roles`}
        onBack={goBack} onSearch={goSearch} onFilters={goFilters}
        onJobPress={openJob} loading={remoteLoading}
      />
    );
  }
  return null;
}

export default function WaysToWorkScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const tab = Math.max(0, TAB_SLUGS.indexOf(String(tabParam ?? '')));

  // Only the active type's hook fires; disabled hooks never load.
  const partTime = useJobSearch({ employmentType: 'Part-time', limit: 50, sort: 'recommended' }, { enabled: tab === 0 });
  const fullTime = useJobSearch({ employmentType: 'Full-time', limit: 50, sort: 'recommended' }, { enabled: tab === 1 });

  const partTimeLoading = useFirstLoadSkeletonFlag({ loading: partTime.loading, data: partTime.jobs });
  const fullTimeLoading = useFirstLoadSkeletonFlag({ loading: fullTime.loading, data: fullTime.jobs });

  const openJob = (id: string) => {
    haptic.light();
    router.push({ pathname: '/job/[id]', params: { id } } as never);
  };
  const goBack = () => router.back();
  const goSearch = () => router.push('/search-detail' as never);
  const goFilters = () => router.push('/explore/filters' as never);

  if (tab === 1) {
    const jobs: FullTimeJob[] = fullTime.jobs.map((j) => {
      const amount = monthlyAmount(j.pay);
      const big = `$${amount.toLocaleString()}`;
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        arrangement: j.arrangement ?? 'On-site',
        pay: big,
        rangeLabel: `${big} / month`,
        min: amount,
        max: amount,
      };
    });
    return (
      <FullTimeScreen
        jobs={jobs}
        subtitle={`${jobs.length} steady roles with monthly pay`}
        onBack={goBack}
        onJobPress={openJob}
        onFilters={goFilters}
        loading={fullTimeLoading}
      />
    );
  }

  if (tab >= 2) {
    return <FeedJobs tab={tab} openJob={openJob} goBack={goBack} goSearch={goSearch} goFilters={goFilters} />;
  }

  const jobs = partTime.jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    pay: j.pay,
    location: j.location,
    photo: j.image ? { uri: j.image } : undefined,
  }));
  return (
    <PartTimeScreen
      jobs={jobs}
      countLabel={`${jobs.length} part-time jobs near you`}
      onBack={goBack}
      onSearch={goSearch}
      onFilters={goFilters}
      onJobPress={openJob}
        loading={partTimeLoading}
    />
  );
}
