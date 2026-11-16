// app/employer/[employerId]/index.tsx
//
// Employer Profile — VISITOR VIEW ONLY.
// Reached by tapping the "About the employer" card on Job Detail.
// No owner-editing controls here — that lives on a separate "my profile" screen.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from "@/components/ui/AppIcon";

import { jobsColors } from '@/constants/jobsTheme';

import type { Employer, JobListing, Review } from '@/app/employer/[employerId]/types';
import {
  getEmployerById,
  getEmployerJobsPreview,
  getEmployerReviews,
} from '@/app/employer/[employerId]/employerRepository';
import { JobCard as JobCardView } from '@/components/jobs/JobCard';
import type { WorkArrangement as CardArrangement } from '@/components/jobs/jobCardTypes';
import { logoColorFor } from '@/components/jobs/toJobCardData';

const MINT = jobsColors.mint;
const BORDER = jobsColors.border;
const TEXT_SECONDARY = jobsColors.textSecondary;

export default function EmployerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { employerId } = useLocalSearchParams<{ employerId: string }>();

  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobsPreview, setJobsPreview] = useState<JobListing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!employerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [emp, jobs, revs] = await Promise.all([
        getEmployerById(employerId),
        getEmployerJobsPreview(employerId, 3),
        getEmployerReviews(employerId),
      ]);
      if (cancelled) return;
      setEmployer(emp);
      setJobsPreview(jobs);
      setReviews(revs);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [employerId]);

  const handleViewAllJobs = useCallback(() => {
    if (!employerId) return;
    router.push(`/employer/${employerId}/jobs`);
  }, [employerId, router]);

  const handleMessage = useCallback(() => {
    // Stub route — confirm real messaging flow before wiring further.
    router.push('/messages/stub');
  }, [router]);

  const handleJobPress = useCallback(
    (jobId: string) => {
      router.push(`/job/${jobId}`);
    },
    [router]
  );

  if (loading || !employer) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={MINT} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating back / overflow buttons over the banner, kept clear of the
          notch/status bar so they stay within thumb reach */}
      <View
        className="absolute left-4 right-4 flex-row items-center justify-between"
        style={{ top: insets.top + 12, zIndex: 10 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
          hitSlop={8}
        >
          <AppIcon name="back" size={18} color="#111318" />
        </Pressable>
        <Pressable
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
          hitSlop={8}
        >
          <AppIcon name="dots" size={18} color={TEXT_SECONDARY} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner — 16:9. Blank (no placeholder icon) when the employer
            hasn't set one, since this is the visitor-facing view. Sits
            BEHIND the avatar via z-index/elevation below. */}
        <View
          className="w-full"
          style={{ aspectRatio: 16 / 9, backgroundColor: '#eef0f2', zIndex: 1 }}
        >
          {employer.bannerUrl ? (
            <Image
              source={{ uri: employer.bannerUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}
        </View>

        {/* Identity block — avatar overlaps the banner's bottom edge and
            must render above it (elevation/zIndex + white ring border) */}
        <View className="items-center px-5" style={{ marginTop: -52, zIndex: 2 }}>
          <View
            className="rounded-full items-center justify-center bg-neutral-100"
            style={{
              width: 88,
              height: 88,
              borderWidth: 4,
              borderColor: '#ffffff',
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            {employer.avatarUrl ? (
              <Image
                source={{ uri: employer.avatarUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 999 }}
                resizeMode="cover"
              />
            ) : (
              <AppIcon name="user" size={32} color="#9aa0a6" />
            )}
          </View>

          <View className="flex-row items-center mt-3">
            <Text className="text-[21px] font-bold text-[#111318]">{employer.name}</Text>
            {employer.verified ? (
              <AppIcon name="circle-check" size={19} color={MINT} style={{ marginLeft: 6 }} />
            ) : null}
          </View>
          <Text className="text-sm mt-1" style={{ color: TEXT_SECONDARY }}>
            {employer.category} · {employer.location}
          </Text>

          {/* Actions */}
          <View className="flex-row w-full mt-4" style={{ gap: 10 }}>
            <Pressable
              onPress={handleMessage}
              className="flex-1 py-3 rounded-xl items-center border"
              style={{ borderColor: BORDER }}
            >
              <Text className="text-[15px] font-semibold text-[#111318]">Message</Text>
            </Pressable>
            <Pressable
              onPress={handleViewAllJobs}
              className="flex-1 py-3 rounded-xl items-center"
              style={{ backgroundColor: MINT }}
            >
              <Text className="text-[15px] font-semibold text-white">View all jobs</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-5 mt-5">
          {/* Stats row */}
          <View
            className="flex-row rounded-2xl overflow-hidden border mb-6"
            style={{ borderColor: BORDER }}
          >
            <StatCell value={String(employer.activeJobsCount)} label="Active jobs" />
            <Divider />
            <StatCell value={employer.rating.toFixed(1)} label="Rating" />
            <Divider />
            <StatCell value={employer.yearsOnHomlo} label="On Homlo" last />
          </View>

          {/* About */}
          <Section title="About the employer">
            <Text className="text-[14.5px] leading-6" style={{ color: '#3a3d42' }}>
              {employer.about}
            </Text>
          </Section>

          {/* Details */}
          <Section title="Details">
            <InfoRow icon={<AppIcon name="pin" size={24} color={TEXT_SECONDARY} />} label="Location" value={employer.location} />
            <InfoRow icon={<AppIcon name="building" size={24} color={TEXT_SECONDARY} />} label="Industry" value={employer.industry} />
            <InfoRow icon={<AppIcon name="clock" size={24} color={TEXT_SECONDARY} />} label="Response time" value={employer.responseTime} isLast />
          </Section>

          {/* Active jobs preview */}
          <Section title="Active jobs from this employer">
            {jobsPreview.map((job) => (
              <View key={job.id} style={{ marginBottom: 10 }}>
                <JobCardView
                  job={{
                    id: job.id,
                    title: job.title,
                    employerName: employer.name,
                    employerColor: logoColorFor(employer.name),
                    imageUrl: job.photoUrl ?? null,
                    payLabel: `$${job.price}/${job.priceUnit}`,
                    workArrangement: toCardArrangement(job.workArrangement),
                    locationLabel:
                      job.workArrangement === 'Remote'
                        ? null
                        : job.location.split(',')[0].trim(),
                    positionsLeft: null,
                  }}
                  variant="row"
                  hideSave
                  onPress={() => handleJobPress(job.id)}
                />
              </View>
            ))}
          </Section>

          {/* Reviews */}
          <Section title="Reviews">
            <View className="flex-row items-center mb-3.5" style={{ gap: 10 }}>
              <Text className="text-[26px] font-extrabold text-[#111318]">
                {employer.rating.toFixed(1)}
              </Text>
              <View>
                <StarRow rating={Math.round(employer.rating)} />
                <Text className="text-xs mt-0.5" style={{ color: TEXT_SECONDARY }}>
                  {employer.reviewCount} reviews
                </Text>
              </View>
            </View>

            {reviews.map((review) => (
              <View
                key={review.id}
                className="rounded-2xl border p-3.5 mb-2.5"
                style={{ borderColor: BORDER }}
              >
                <View className="flex-row items-center mb-1.5" style={{ gap: 8 }}>
                  <View className="rounded-full bg-neutral-100" style={{ width: 30, height: 30 }} />
                  <View>
                    <Text className="text-[13.5px] font-semibold text-[#111318]">
                      {review.authorName}
                    </Text>
                    <StarRow rating={review.rating} size={11} />
                  </View>
                </View>
                <Text className="text-[13.5px] leading-5" style={{ color: '#3a3d42' }}>
                  {review.text}
                </Text>
              </View>
            ))}
          </Section>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-[17px] font-bold text-[#111318] mb-2.5">{title}</Text>
      {children}
    </View>
  );
}

function StatCell({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View className="flex-1 items-center py-3.5 px-1">
      <Text className="text-[17px] font-bold text-[#111318]">{value}</Text>
      <Text className="text-xs mt-0.5" style={{ color: TEXT_SECONDARY }}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: BORDER }} />;
}

function InfoRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className="flex-row items-center py-3"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: BORDER } : undefined}
    >
      {icon}
      <Text className="text-sm ml-2.5" style={{ color: TEXT_SECONDARY }}>
        {label}
      </Text>
      <Text className="text-sm font-semibold ml-auto text-[#111318]">{value}</Text>
    </View>
  );
}

/** types/employer.ts spells the values capitalized; the card uses lowercase. */
function toCardArrangement(arrangement: string | null | undefined): CardArrangement {
  if (arrangement === 'Remote') return 'remote';
  if (arrangement === 'Hybrid') return 'hybrid';
  return 'onsite';
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <AppIcon
          name="star"
          key={i}
          size={size}
          color={MINT}
        />
      ))}
    </View>
  );
}