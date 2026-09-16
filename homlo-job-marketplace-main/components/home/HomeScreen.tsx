import { useState } from 'react';
import { View, Text, FlatList, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import type { Job as FeedJob } from '@/components/job-store';
import { useJobStore } from '@/components/job-store';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { haptic } from '@/lib/haptics';
import { defaultSearchCenter } from '@/lib/job-geography';
import { HomeHeader } from './HomeHeader';
import { JobSearchBar } from './JobSearchBar';
import { GuideCard } from './GuideCard';
import { CategoryIconRow } from './CategoryIconRow';
import { JobCard, type Job } from './JobCard';
import { BottomTabBar } from './BottomTabBar';
import { colors, fontFamily } from './theme';

// Real feed data from the repository layer, mapped onto JobCard's `Job` shape.
function toJob(job: FeedJob, index: number, saved: boolean): Job {
  const [rawRange = job.pay, rawUnit] = job.pay.split(' / ');
  const priceUnit = rawUnit ? `/${rawUnit === 'month' ? 'mo' : rawUnit}` : '';
  return {
    id: job.id,
    image: job.image,
    jobType: job.tag,
    title: job.title,
    company: job.company,
    location: job.location,
    priceRange: rawRange,
    priceUnit,
    imageHeight: index === 0 ? 190 : 170,
    saved,
  };
}

export function HomeScreen() {
  const router = useRouter();
  const { isSaved, toggleSaved } = useJobStore();
  const {
    nearby: jobs,
    loading,
  } = useHomeFeed({
    latitude: defaultSearchCenter.latitude,
    longitude: defaultSearchCenter.longitude,
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null); // null = nothing selected, as designed
  const [activeTab, setActiveTab] = useState('home');

  const openJob = (id: string) => router.push({ pathname: '/job/[id]', params: { id } } as never);
  const applyToJob = (id: string) => {
    haptic.light();
    router.push({ pathname: '/job/[id]/apply', params: { id, from: 'home' } } as never);
  };
  const toggleSave = (id: string) => {
    haptic.selection();
    toggleSaved(id);
  };
  const openFilter = () => router.push('/detailed-search' as never);
  const openGuided = () => router.push('/guided-search' as never);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        ListHeaderComponent={
          <>
            <HomeHeader />
            <JobSearchBar value={search} onChangeText={setSearch} onFilterPress={openFilter} />
            <GuideCard onPress={openGuided} />
            <CategoryIconRow selectedKey={category} onSelect={setCategory} />
            <View style={{ paddingTop: 38, paddingBottom: 29 }} className="px-4 flex-row justify-between items-baseline">
              <Text style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }} className="text-[15px]">
                Jobs near you
              </Text>
              <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[11px]">
                {loading ? '…' : `${jobs.length} open`}
              </Text>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <JobCard
            job={toJob(item, index, isSaved(item.id))}
            onOpen={openJob}
            onPressApply={applyToJob}
            onToggleSave={toggleSave}
          />
        )}
      />

      <BottomTabBar activeKey={activeTab} onSelect={setActiveTab} badgeCount={0} />
    </SafeAreaView>
  );
}