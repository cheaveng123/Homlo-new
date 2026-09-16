import React, { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Pressable, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Star, Pencil } from 'lucide-react-native';
import {
  EmployerJobListingCard,
  EmployerListing,
  ListingStatus,
} from '@/components/EmployerJobListingCard';
import { BottomTabBar } from '@/components/home/BottomTabBar';
import { useAuth } from '@/hooks/use-auth';
import { useMessagingUnread } from '@/hooks/use-messaging-unread';
import { haptic } from '@/lib/haptics';
import { trpc } from '@/lib/trpc';

const TABS: { key: ListingStatus; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
];

type GatewayJob = { id: string; title: string; location_text: string | null; pay_amount: number | string | null; pay_currency: string | null; pay_type: "hourly" | "daily" | "fixed" | null; status: "draft" | "open" | "filled" | "closed" | "expired" | "cancelled" | null; banner_image: string | null; updated_at: string; created_at: string };

function payLabel(job: GatewayJob) {
  if (job.pay_amount == null || job.pay_currency == null) return 'not set';
  const interval = job.pay_type === 'hourly' ? '/hr' : job.pay_type === 'daily' ? '/day' : '/mo';
  return `${job.pay_currency} ${Number(job.pay_amount).toLocaleString()}${interval}`;
}

function employmentTypeLabel(job: GatewayJob) {
  return job.pay_type === 'hourly' ? 'Hourly' : job.pay_type === 'daily' ? 'Daily' : 'Fixed-term';
}

function listingStatus(job: GatewayJob): ListingStatus {
  if (job.status === 'open') return 'live';
  if (job.status === 'draft') return 'draft';
  return 'review';
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.max(1, Math.round(diffMs / 86_400_000));
  return days === 1 ? 'Edited 1 day ago' : `Edited ${days} days ago`;
}

function toEmployerListing(job: GatewayJob): EmployerListing {
  const status = listingStatus(job);
  return {
    id: job.id,
    title: job.title,
    employmentType: employmentTypeLabel(job),
    salaryLabel: payLabel(job),
    status,
    imageUrl: job.banner_image?.trim() || undefined,
    lastEditedLabel: status === 'draft' ? timeAgo(job.updated_at || job.created_at) : undefined,
    reviewNoteLabel:
      status === 'review' ? `Closed ${new Date(job.updated_at || job.created_at).toLocaleDateString()}` : undefined,
  };
}

export default function EmployerListingsDashboard() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { count } = useMessagingUnread();
  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const [activeTab, setActiveTab] = useState<ListingStatus>(
    tab === 'draft' || tab === 'review' || tab === 'live' ? tab : 'live'
  );
  const [menuJob, setMenuJob] = useState<GatewayJob | null>(null);

  const gatewayJobs: GatewayJob[] = useMemo(
    () => (jobsQuery.data as { jobs?: GatewayJob[] } | undefined)?.jobs ?? [],
    [jobsQuery.data]
  );

  const listings: EmployerListing[] = useMemo(() => gatewayJobs.map(toEmployerListing), [gatewayJobs]);

  const filtered = useMemo(
    () => listings.filter((l) => l.status === activeTab),
    [listings, activeTab]
  );

  const onTabSelect = (key: string) => {
    haptic.light();
    router.push(({ home: '/', search: '/jobs', post: '/employer', alerts: '/inbox', profile: '/profile' } as Record<string, string>)[key] as never);
  };

  const boostJob = (job: GatewayJob) => {
    setMenuJob(null);
    router.push({ pathname: "/employer/boost/[id]", params: { id: job.id, title: job.title, company: user?.name ?? "Your company", city: job.location_text ?? "Remote", salary: payLabel(job) } } as never);
  };

  const editJob = () => {
    setMenuJob(null);
    // Edit flow is not built yet — intentionally no navigation yet.
  };

  const stats = useMemo(() => {
    const active = listings.filter((l) => l.status === 'live').length;
    const applicants = listings.reduce((sum, l) => sum + (l.applicantsCount ?? 0), 0);
    const newApplicants = listings.reduce(
      (sum, l) => sum + (l.newApplicantsCount ?? 0),
      0
    );
    return { active, applicants, newApplicants };
  }, [listings]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My listings</Text>
            <Text style={styles.headerSubtitle}>{user?.name ?? 'Your business'}</Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/employer/post-job')}
          >
            <Plus size={18} color="#04342C" />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatTile value={stats.active} label="Active" />
          <StatTile value={stats.applicants} label="Applicants" />
          <StatTile value={stats.newApplicants} label="New" />
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <Pressable
                key={t.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <EmployerJobListingCard
              listing={item}
              onPress={(id) => router.push(`/employer/job/${id}` as never)}
              onMenuPress={(id) => {
                haptic.selection();
                const job = gatewayJobs.find((candidate) => candidate.id === id) ?? null;
                setMenuJob(job);
              }}
            />
          )}
          ListEmptyComponent={
            jobsQuery.isLoading ? (
              <ActivityIndicator color="#5DCAA5" style={{ marginTop: 40 }} />
            ) : (
              <Text style={styles.empty}>Nothing here yet.</Text>
            )
          }
        />
      </View>
      <BottomTabBar activeKey="post" onSelect={onTabSelect} badgeCount={count} />

      <Modal animationType="slide" transparent visible={menuJob !== null} onRequestClose={() => setMenuJob(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetDismiss} onPress={() => setMenuJob(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{menuJob?.title}</Text>
            <Pressable style={styles.sheetRow} onPress={() => menuJob && boostJob(menuJob)}>
              <View style={styles.sheetRowIcon}><Star size={17} color="#16803C" /></View>
              <View style={styles.sheetRowCopy}>
                <Text style={styles.sheetRowTitle}>Boost listing</Text>
                <Text style={styles.sheetRowSub}>Promote this job to reach more applicants</Text>
              </View>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={editJob}>
              <View style={styles.sheetRowIcon}><Pencil size={17} color="#16803C" /></View>
              <View style={styles.sheetRowCopy}>
                <Text style={styles.sheetRowTitle}>Edit job info</Text>
                <Text style={styles.sheetRowSub}>Update title, salary, description and more</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#12271F' },
  headerSubtitle: { fontSize: 12, color: '#5F7A6E', marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5DCAA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statTile: {
    flex: 1,
    backgroundColor: '#EAF6EF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statValue: { fontSize: 18, fontWeight: '600', color: '#04342C' },
  statLabel: { fontSize: 11, color: '#5F7A6E', marginTop: 2 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F4F7F5',
    borderRadius: 999,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#5DCAA5' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#5F7A6E' },
  tabTextActive: { color: '#04342C' },
  listContent: { paddingBottom: 24 },
  empty: {
    fontSize: 13,
    color: '#5F7A6E',
    textAlign: 'center',
    marginTop: 40,
  },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,39,31,0.45)' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D7E4DE', marginBottom: 14 },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: '#12271F', marginBottom: 8, paddingHorizontal: 4 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#EFF4F1',
  },
  sheetRowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EAF6EF', alignItems: 'center', justifyContent: 'center' },
  sheetRowCopy: { flex: 1 },
  sheetRowTitle: { fontSize: 14, fontWeight: '600', color: '#12271F' },
  sheetRowSub: { fontSize: 12, color: '#5F7A6E', marginTop: 2 },
});