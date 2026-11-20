// components/MyListingsScreen.tsx
//
// "My listings" dashboard for employers (Live / Draft / Review).
// All reads run through the real tRPC → edge-function → Postgres path
// (homlo.employer.jobs + homlo.employer.applications per live job); there are
// no direct Supabase calls from the screen.
//
// Matches the home-page design language: Lagoon & Sunrise palette for the header gradient,
// rounded white content sheet over a teal spill, tint cards/tags, the shared
// BottomTabBar hot bar and sun for the "Closing soon" pill.

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { BottomTabBar } from '@/components/home/BottomTabBar';
import { colors, fontFamily } from '@/theme';
import { useAuth } from '@/hooks/use-auth';
import { useMessagingUnread } from '@/hooks/use-messaging-unread';
import { haptic } from '@/lib/haptics';
import { trpc } from '@/lib/trpc';

// Tab routes mirror app/(tabs)/_layout.tsx.
const ROUTES: Record<string, string> = {
  home: '/',
  search: '/jobs',
  post: '/employer',
  alerts: '/inbox',
  profile: '/profile',
};

// ---- Real-data model -------------------------------------------------------
type TabKey = 'Live' | 'Draft' | 'Review';

type Job = {
  id: string;
  title: string;
  meta: string;
  tag: string;
  urgentTag?: string;
  filled: number;
  total: number;
  postedAgo: string;
  views: number;
  status: 'live' | 'draft' | 'review';
};

type GatewayJob = {
  id: string;
  title: string | null;
  description: string | null;
  pay_amount: number | string | null;
  pay_currency: string | null;
  pay_type: 'hourly' | 'daily' | 'fixed' | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number | null;
  workers_hired: number | null;
  banner_image: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  requirements?: string | null;
  category?: string | null;
  views_count?: number | string | null;
  boost_id?: string | null;
};

function payLabel(job: GatewayJob) {
  if (job.pay_amount == null || job.pay_currency == null) return 'not set';
  const interval = job.pay_type === 'hourly' ? '/hr' : job.pay_type === 'daily' ? '/day' : '/mo';
  return `${job.pay_currency} ${Number(job.pay_amount).toLocaleString()}${interval}`;
}

function employmentTypeLabel(job: GatewayJob) {
  return job.pay_type === 'hourly' ? 'Hourly' : job.pay_type === 'daily' ? 'Daily' : 'Fixed-term';
}

type ListingStatus = Job['status'];

function listingStatus(job: GatewayJob): ListingStatus {
  if (job.status === 'open') return 'live';
  if (job.status === 'draft') return 'draft';
  return 'review';
}

function timeAgoShort(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.round(diffMs / 3_600_000));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.max(1, Math.round(diffMs / 86_400_000));
  if (days < 7) return `${days}d ago`;
  const weeks = Math.max(1, Math.round(days / 7));
  return `${weeks}w ago`;
}

function toJob(job: GatewayJob): Job {
  const status = listingStatus(job);
  const total = Math.max(Number(job.workers_needed ?? 0), 0);
  const filled = Math.max(Number(job.workers_hired ?? 0), 0);
  const closingSoon = status === 'live' && total > 0 && filled / total >= 0.75;
  return {
    id: job.id,
    title: job.title ?? 'Untitled job',
    meta: `${employmentTypeLabel(job)} · ${payLabel(job)}`,
    tag: job.category?.trim() || employmentTypeLabel(job),
    urgentTag: closingSoon ? 'Closing soon' : undefined,
    filled,
    total,
    postedAgo: timeAgoShort(job.updated_at || job.created_at || new Date().toISOString()),
    views: Math.max(0, Number(job.views_count ?? 0)),
    status,
  };
}

const tabs: TabKey[] = ['Live', 'Draft', 'Review'];

const SHEET_RADIUS = 32;

export default function MyListingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { count } = useMessagingUnread();
  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const lockUntilRef = useRef(0);

  const [activeTab, setActiveTab] = useState<TabKey>(
    tab === 'Draft' || tab === 'Review' || tab === 'Live' ? tab : 'Live',
  );
  const [menuJob, setMenuJob] = useState<Job | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const gatewayJobs: GatewayJob[] = useMemo(
    () => (jobsQuery.data as { jobs?: GatewayJob[] } | undefined)?.jobs ?? [],
    [jobsQuery.data],
  );

  const jobs: Job[] = useMemo(() => gatewayJobs.map(toJob), [gatewayJobs]);

  const filtered = useMemo(() => jobs.filter((j) => j.status === activeTab.toLowerCase()), [jobs, activeTab]);

  // Applicants / New totals come from the real per-job application rows for
  // live listings only (the only statuses still accepting applications).
  const liveJobs = useMemo(() => gatewayJobs.filter((j) => listingStatus(j) === 'live'), [gatewayJobs]);

  // PERF: one query for every job's applicants (was one query per live job).
  const applicantsQuery = trpc.homlo.employer.allApplications.useQuery(undefined, {
    enabled: liveJobs.length > 0,
  });

  const stats = useMemo(() => {
    const active = liveJobs.length;
    const liveIds = new Set(liveJobs.map((j) => j.id));
    let applicants = 0;
    let newApplicants = 0;
    const rows = (applicantsQuery.data as { applications?: { job_id?: string; status?: string }[] } | undefined)
      ?.applications ?? [];
    for (const r of rows) {
      if (!r.job_id || !liveIds.has(r.job_id)) continue;
      applicants += 1;
      if (r.status === 'applied') newApplicants += 1;
    }
    return { active, applicants, newApplicants };
  }, [applicantsQuery.data, liveJobs]);

  const initials = useMemo(() => {
    const name = user?.name?.trim() || '';
    if (!name) return 'MC';
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('');
  }, [user?.name]);

  const screenName = user?.name?.trim() || 'Your business';

  const notify = () => haptic.light();

  const selectTab = (key: string) => {
    const target = ROUTES[key] as never;
    const alreadyThere =
      key === 'post'
        ? pathname === '/employer' || pathname.startsWith('/employer')
        : pathname === target;
    if (alreadyThere) return;
    const now = Date.now();
    if (now < lockUntilRef.current) return;
    lockUntilRef.current = now + 400;
    // Haptic feedback is played by BottomTabBar itself.
    router.push(target);
  };

  const openJob = (job: Job) => {
    notify();
    router.push(`/employer/job/${job.id}` as never);
  };

  const boostJob = (job: Job) => {
    setMenuJob(null);
    notify();
    router.push({ pathname: '/boost/plan', params: { jobId: job.id } } as never);
  };

  const editJob = (job: Job) => {
    setMenuJob(null);
    notify();
    router.push(`/employer/job/${job.id}/edit` as never);
  };

  const onRefresh = () => {
    setRefreshing(true);
    jobsQuery.refetch().finally(() => setRefreshing(false));
  };

  const statCards = useMemo(
    () => [
      { icon: 'grid' as IconName, num: stats.active, label: 'Active' },
      { icon: 'users' as IconName, num: stats.applicants, label: 'Applicants' },
      { icon: 'zap' as IconName, num: stats.newApplicants, label: 'New' },
    ],
    [stats],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header runs full-bleed behind the status bar. The white sheet below
          cuts its top corners away, revealing the green root spill so the
          corner radius reads clearly. */}
      <LinearGradient
        colors={[colors.green, colors.greenDark]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <View style={styles.greetingGroup}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.label}>My listings</Text>
                <Text style={styles.screenName} numberOfLines={1}>{screenName}</Text>
              </View>
            </View>
            <View style={styles.headerIcons}>
              <Pressable style={styles.iconBtn} onPress={() => { notify(); router.push('/jobs' as never); }}>
                <AppIcon name="search" size={17} color={colors.white} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => { notify(); router.push('/employer/post-job' as never); }}>
                <AppIcon name="plus" size={17} color={colors.white} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => { notify(); router.push('/inbox' as never); }}>
                <AppIcon name="bell" size={17} color={colors.white} />
                {count > 0 ? <View style={styles.notifDot} /> : null}
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Listings overview</Text>

          <View style={styles.statsRow}>
            {statCards.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <AppIcon name={s.icon} size={15} color={colors.green} />
                </View>
                <Text style={styles.statNum}>{s.num}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* White content sheet with a large top corner radius, sitting over the
          green root so the header green fills the rounded-corner notches. */}
      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
        >
          <View style={styles.tabsRow}>
            {tabs.map((t) => {
              const active = t === activeTab;
              return (
                <Pressable
                  key={t}
                  onPress={() => { haptic.light(); setActiveTab(t); }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.listHead}>
            <Text style={styles.listHeadTitle}>
              {filtered.length} {activeTab.toLowerCase()} listing{filtered.length === 1 ? '' : 's'}
            </Text>
            <Pressable style={styles.filterBtn} onPress={notify}>
              <AppIcon name="sliders" size={13} color={colors.ink} />
              <Text style={styles.filterBtnText}>Filters</Text>
            </Pressable>
          </View>

          {jobsQuery.isLoading && !jobs.length ? (
            <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
          ) : null}

          {filtered.map((job) => (
            <Pressable key={job.id} style={styles.jobCard} onPress={() => openJob(job)}>
              <View style={styles.jobRow1}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobMeta} numberOfLines={1}>{job.meta}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => { haptic.selection(); setMenuJob(job); }}>
                  <AppIcon name="dots" size={15} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.tagsRow}>
                <View style={styles.tagRate}>
                  <Text style={styles.tagRateText}>{job.tag}</Text>
                </View>
                {job.urgentTag ? (
                  <View style={styles.tagStatus}>
                    <Text style={styles.tagStatusText}>{job.urgentTag}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${job.total > 0 ? Math.min(100, (job.filled / job.total) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {job.filled}/{job.total} filled
                </Text>
              </View>

              <View style={styles.jobFooter}>
                <View style={styles.liveDotRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.jobFooterText}>
                    {job.status === 'live' ? 'Live' : job.status === 'draft' ? 'Draft' : 'Review'} · {job.postedAgo}
                  </Text>
                </View>
                <View style={styles.viewsRow}>
                  <AppIcon name="eye" size={12} color={colors.textSecondary} />
                  <Text style={styles.jobFooterText}>{job.views} views</Text>
                </View>
              </View>
            </Pressable>
          ))}

          {!jobsQuery.isLoading && filtered.length === 0 ? (
            <Text style={styles.empty}>Nothing here yet.</Text>
          ) : null}
        </ScrollView>

        <BottomTabBar activeKey="post" onSelect={selectTab} badgeCount={count} />
      </View>

      <Modal animationType="slide" transparent visible={menuJob !== null} onRequestClose={() => setMenuJob(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetDismiss} onPress={() => setMenuJob(null)} />
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{menuJob?.title}</Text>
            <Pressable style={styles.sheetRow} onPress={() => menuJob && boostJob(menuJob)}>
              <View style={styles.sheetRowIcon}><AppIcon name="star" size={17} color={colors.ink} /></View>
              <View style={styles.sheetRowCopy}>
                <Text style={styles.sheetRowTitle}>Boost listing</Text>
                <Text style={styles.sheetRowSub}>Promote this job to reach more applicants</Text>
              </View>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => menuJob && editJob(menuJob)}>
              <View style={styles.sheetRowIcon}><AppIcon name="edit" size={17} color={colors.ink} /></View>
              <View style={styles.sheetRowCopy}>
                <Text style={styles.sheetRowTitle}>Edit job info</Text>
                <Text style={styles.sheetRowSub}>Update title, salary, description and more</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Deep green root so the header colour spills into the corner notches of
  // the white sheet above (and matches the header gradient's end).
  root: { flex: 1, backgroundColor: colors.greenDark },

  header: { paddingHorizontal: 22, paddingBottom: 22 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  greetingGroup: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.mintTint,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.green },
  label: { fontFamily: fontFamily.medium, fontSize: 11, color: 'rgba(255,255,255,0.72)', marginBottom: 4 },
  screenName: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.white, flexShrink: 1 },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.greenDark,
  },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.white, marginTop: 22, marginBottom: 12 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 19,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNum: { fontFamily: fontFamily.extraBold, fontSize: 20, color: colors.text, lineHeight: 24 },
  statLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: colors.muted, marginTop: 5 },

  // White sheet: top corners rounded so the green root shows through them.
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
  },

  content: { paddingHorizontal: 18, paddingTop: 18 },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.track,
  },
  tabActive: { backgroundColor: colors.teal },
  tabText: { fontFamily: fontFamily.interMedium, fontSize: 13, color: colors.muted },
  tabTextActive: { fontFamily: fontFamily.semiBold, color: colors.white },

  listHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  listHeadTitle: { fontFamily: fontFamily.bold, fontSize: 15.5, color: colors.text },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.track,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterBtnText: { fontFamily: fontFamily.interMedium, fontSize: 12.5, color: colors.text },

  jobCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    padding: 12,
    marginBottom: 12,
  },
  jobRow1: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  jobTitle: { fontFamily: fontFamily.bold, fontSize: 15.5, color: colors.text, marginBottom: 3 },
  jobMeta: { fontFamily: fontFamily.interRegular, fontSize: 12, color: colors.muted, marginBottom: 9 },
  tagsRow: { flexDirection: 'row', gap: 6, marginBottom: 9, flexWrap: 'wrap' },
  tagRate: { backgroundColor: colors.tint, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20 },
  tagRateText: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: colors.teal },
  tagStatus: { backgroundColor: colors.clayTint, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20 },
  tagStatusText: { fontFamily: fontFamily.interSemiBold, fontSize: 11, color: colors.sun },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.teal },
  progressLabel: { fontFamily: fontFamily.interMedium, fontSize: 11, color: colors.muted },

  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobFooterText: { fontFamily: fontFamily.interRegular, fontSize: 11, color: colors.muted },

  empty: {
    fontFamily: fontFamily.interMedium,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 32,
  },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,59,66,0.45)' },
  sheetDismiss: { flex: 1 },
  actionSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text, marginBottom: 8, paddingHorizontal: 4 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetRowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  sheetRowCopy: { flex: 1 },
  sheetRowTitle: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text },
  sheetRowSub: { fontFamily: fontFamily.interRegular, fontSize: 12, color: colors.muted, marginTop: 2 },
});