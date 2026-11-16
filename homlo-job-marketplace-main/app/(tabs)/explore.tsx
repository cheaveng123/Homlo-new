import ExploreScreen from '@/components/explore/ExploreScreen';
import { useJobStore } from '@/components/job-store';
import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';

export default function ExploreRoute() {
  const router = useRouter();
  const { savedIds } = useJobStore();

  return (
    <ExploreScreen
      locationLabel="Phnom Penh"
      newJobsLabel="1,240 new jobs today"
      savedCount={savedIds.length}
      onOpenSaved={() => router.push('/saved' as never)}
      onFilterPress={() => router.push('/explore/filters' as never)}
      onOpenMap={() => {
        haptic.light();
        router.push('/jobs-map' as never);
      }}
    />
  );
}
