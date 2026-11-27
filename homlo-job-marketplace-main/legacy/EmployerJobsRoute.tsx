// app/employer/[employerId]/jobs.tsx
//
// All Jobs by Employer — Airbnb-style browse: photo-first cards, minimal
// borders, icon-over-label category tabs with an underline for the active
// tab. Reached from Employer Profile's "View all jobs" button.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from '@/lib/router';
import { AppIcon } from "@/components/ui/AppIcon";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jobsColors } from '@/constants/jobsTheme';

import { JobCard as JobCardView } from '@/components/jobs/JobCard';
import type { WorkArrangement as CardArrangement } from '@/components/jobs/jobCardTypes';
import { logoColorFor } from '@/components/jobs/toJobCardData';

import type { JobListing } from '@/app/employer/[employerId]/types';
import { getEmployerById, getEmployerJobs } from '@/app/employer/[employerId]/employerRepository';
import {
  CATEGORY_ORDER,
  CategoryFilter,
  getCategoryIcon,
  getCategoryLabel,
} from '@/app/employer/[employerId]/employmentTypeIcons';

const MINT = jobsColors.mint;
const BORDER = jobsColors.border;
const TEXT_SECONDARY = jobsColors.textSecondary;

type SortMode = 'newest' | 'price_high' | 'price_low';

export default function AllJobsScreen() {
  const router = useRouter();
  const { employerId } = useLocalSearchParams<{ employerId: string }>();

  const insets = useSafeAreaInsets();
  const [employerName, setEmployerName] = useState('');
  const [employerSubtitle, setEmployerSubtitle] = useState('');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!employerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [emp, jobList] = await Promise.all([
        getEmployerById(employerId),
        getEmployerJobs(employerId),
      ]);
      if (cancelled) return;
      if (emp) {
        setEmployerName(emp.name);
        setEmployerSubtitle(`${emp.category} · ${emp.location}`);
      }
      setJobs(jobList);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [employerId]);

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((j) => j.status === 'live');
    if (activeCategory !== 'all') {
      result = result.filter((j) => j.employmentType === activeCategory);
    }
    result = [...result];
    if (sortMode === 'price_high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortMode === 'price_low') {
      result.sort((a, b) => a.price - b.price);
    }
    // 'newest' relies on the mock/API's existing order (already newest-first)
    return result;
  }, [jobs, activeCategory, sortMode]);

  const cycleSortMode = useCallback(() => {
    setSortMode((prev) => {
      if (prev === 'newest') return 'price_high';
      if (prev === 'price_high') return 'price_low';
      return 'newest';
    });
  }, []);

  const sortLabel =
    sortMode === 'newest' ? 'Newest' : sortMode === 'price_high' ? 'Price: high' : 'Price: low';

  const handleJobPress = useCallback(
    (jobId: string) => {
      router.push(`/job/${jobId}`);
    },
    [router]
  );

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-2"
        style={{ paddingTop: Math.max(insets.top, 20) + 16, gap: 12 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <AppIcon name="back" size={22} color="#111318" />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={MINT} />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          ListHeaderComponent={
            <View>
              <View className="pb-5">
                <Text
                  className="font-bold text-[#222]"
                  style={{ fontSize: 23, letterSpacing: -0.3, marginBottom: 4 }}
                >
                  Jobs by {employerName}
                </Text>
                <Text className="text-sm" style={{ color: TEXT_SECONDARY }}>
                  {employerSubtitle}
                </Text>
              </View>

              {/* Category tabs — icon above label, active = underline */}
              <View
                className="flex-row mb-5"
                style={{ gap: 22, borderBottomWidth: 1, borderBottomColor: BORDER }}
              >
                {CATEGORY_ORDER.map((cat) => {
                  const active = cat === activeCategory;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      className="items-center pb-2.5"
                      style={{
                        borderBottomWidth: 2,
                        borderBottomColor: active ? '#222' : 'transparent',
                        marginBottom: -1,
                      }}
                    >
                      <AppIcon name={getCategoryIcon(cat)} size={22} color={active ? '#222' : '#9a9a9a'} />
                      <Text
                        className="mt-1.5"
                        style={{
                          fontSize: 11.5,
                          fontWeight: '600',
                          color: active ? '#222' : '#9a9a9a',
                        }}
                      >
                        {getCategoryLabel(cat)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Count + sort */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-semibold text-[#222]">
                  {filteredJobs.length} active job{filteredJobs.length === 1 ? '' : 's'}
                </Text>
                <Pressable
                  onPress={cycleSortMode}
                  className="flex-row items-center rounded-full border px-3 py-1.5"
                  style={{ borderColor: BORDER, gap: 6 }}
                >
                  <AppIcon name="sort" size={13} color="#222" />
                  <Text className="text-[13px] font-semibold text-[#222]">Sort: {sortLabel}</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm" style={{ color: TEXT_SECONDARY }}>
                No active jobs in this category yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              employerName={employerName}
              onPress={() => handleJobPress(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

/**
 * Employer listings use the shared job container in its `row` variant with the
 * save heart hidden — a buyer browsing an employer page does not bookmark jobs.
 */
function JobCard({
  job,
  employerName,
  onPress,
}: {
  job: JobListing;
  employerName: string;
  onPress: () => void;
}) {
  // types/employer.ts spells the values capitalized; the card uses lowercase.
  const arrangement: CardArrangement =
    job.workArrangement === 'Remote'
      ? 'remote'
      : job.workArrangement === 'Hybrid'
        ? 'hybrid'
        : 'onsite';

  return (
    <View style={{ marginBottom: 10 }}>
      <JobCardView
        job={{
          id: job.id,
          title: job.title,
          employerName,
          employerColor: logoColorFor(employerName),
          imageUrl: job.photoUrl ?? null,
          payLabel: `$${job.price}/${job.priceUnit}`,
          workArrangement: arrangement,
          locationLabel: arrangement === 'remote' ? null : job.location.split(',')[0].trim(),
          positionsLeft: null,
        }}
        variant="row"
        hideSave
        onPress={onPress}
      />
    </View>
  );
}