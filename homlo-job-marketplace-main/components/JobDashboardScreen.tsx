// components/JobDashboardScreen.tsx
//
// Employer "Post a job" dashboard, built on a three-layer hero so the green
// header can travel with the scroll and then LOCK while the content below keeps
// moving. All three layers are siblings inside one relative root:
//
//   Layer 0 — hero background (absolute, zIndex 0): flat green, rounded bottom,
//     height 210, translateY = scrollY.interpolate([0, 30] -> [0, -30],
//     clamp). Travels up 30px with the scroll, then locks and never moves again.
//   Layer 1 — scrollable content (absolute, fills the screen, zIndex 1): a
//     native Animated.ScrollView with the stat card, tabs and job list. It
//     scrolls independently and continuously regardless of the hero's lock
//     state — that separation is what makes the background "stop" while the
//     content keeps going.
//   Layer 2 — hero foreground (absolute, zIndex 2, topmost): logo, search pill,
//     bell, avatar, title and the "Add New Job" button. They share the same
//     clamped translateY as the background, the whole top row (logo through
//     avatar) additionally fades + lifts and the title/button slide off
//     sideways, all within that same 0–30px range so the transition completes
//     exactly when the lock happens. The avatar used to be absolute and exempt
//     from the fade, but that put it exactly over the bell and let it obscure
//     the top-right stat tile while scrolling, so it now rides in the row.
//
// Snapping: if a release or momentum stop lands between 0 and 30 — i.e. inside
// the transition — the scroll position is animated to whichever end (0 or 30) is
// closer, so the hero is never left visually stuck partway. Once past 30 the
// snap is left alone entirely, which keeps fast flicks untouched.
//
// Only transform/opacity are driven by the native driver; nothing that would
// require a layout animation is attached to scrollY.
//
// Data is real: trpc -> edge function -> Postgres via homlo.employer.jobs and
// homlo.employer.applications. No direct Supabase calls from this screen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '@/components/ui/AppIcon';

import { BottomTabBar } from '@/components/home/BottomTabBar';
import { JobCard as JobCardView } from '@/components/jobs/JobCard';
import { colors, fontFamily } from '@/components/home/theme';
import { ShimmerIcon } from '@/components/shared/ShimmerIcon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { useAuth } from '@/hooks/use-auth';
import { useEmployerApplications, type EmployerApplication } from '@/hooks/use-employer-applications';
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

// Hero geometry. The lock distance is the whole point of the design: everything
// above travels this far with the scroll and then freezes.
const HERO_MAX_HEIGHT = 210;
const HERO_LOCK_DISTANCE = 30;
const HERO_OVERLAP = 48; // how far the stat card reaches up into the hero

// BottomTabBar is a flow child measured at ~57pt plus the safe-area inset it
// adds itself; the scroll content clears it by this much plus breathing room.
const NAV_CLEARANCE = 64;

const HERO_RADIUS = 30;
const PILL = 999;

// Stat card geometry. The dividers are derived from these rather than hand-tuned
// so they can never drift out of alignment with the tiles they separate — see
// the note on `statCardDividerV`.
const STAT_CARD_PADDING = 18;
const STAT_TILE_PADDING_X = 10;
const STAT_TILE_PADDING_Y = 12;
// Extra clearance between the "Add New Job" pill floating in the hero layer and
// the top of the stat card, so the two don't crowd each other.
const STAT_CARD_MARGIN_TOP = 10;

// Where each of the four stat tiles leads. Each tile opens the screen that
// explains its own number, rather than one shared destination.
const STAT_ROUTES: Record<StatKey, string> = {
  applications: '/employer/applications',
  jobsPosted: '/employer/jobs-posted',
  liveNow: '/employer/live-now',
  newApplicants: '/employer/new-applicants',
};

// ---- Real-data model -------------------------------------------------------

type TabKey = 'Live' | 'Draft' | 'Review';

type JobStatus = 'live' | 'draft' | 'review';

type Job = {
  id: string;
  title: string;
  filled: number;
  total: number;
  closingSoon: boolean;
  postedOn: string;
  applied: number;
  initials: string[];
  status: JobStatus;
};

type GatewayJob = {
  id: string;
  title: string | null;
  workers_needed: number | null;
  workers_hired: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function listingStatus(job: GatewayJob): JobStatus {
  if (job.status === 'open') return 'live';
  if (job.status === 'draft') return 'draft';
  return 'review';
}

function postedOn(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** Two avatars then a "+N" chip, matching the prototype's stack. */
function avatarStack(rows: EmployerApplication[]): string[] {
  const letters = rows.slice(0, 2).map((row) => initialsOf(row.fullName));
  const rest = rows.length - letters.length;
  return rest > 0 ? [...letters, `+${rest}`] : letters;
}

const TABS: TabKey[] = ['Live', 'Draft', 'Review'];

export default function JobDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const { user } = useAuth();
  const { count } = useMessagingUnread();

  const [menuJob, setMenuJob] = useState<Job | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lockUntilRef = useRef(0);

  // Light line embedded in the "Add New Job" pill's border: one looped timing
  // on the native driver spins a narrow gradient band; the ring clip reveals it
  // only through the 2px window between the clip edge and the button, so it
  // reads as a line running along the border. Stopped with the screen.
  const [orbitSpin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(orbitSpin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [orbitSpin]);
  const orbitRotate = orbitSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // app/employer/post-job.tsx links back with ?tab=live (lower case), the old
  // screen only accepted "Live" — accept either.
  const requested = (Array.isArray(tab) ? tab[0] : tab)?.trim().toLowerCase();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (requested === 'draft' || requested === 'review' || requested === 'live') {
      return (requested.charAt(0).toUpperCase() + requested.slice(1)) as TabKey;
    }
    return 'Live';
  });

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });

  const gatewayJobs: GatewayJob[] = useMemo(
    () => (jobsQuery.data as { jobs?: GatewayJob[] } | undefined)?.jobs ?? [],
    [jobsQuery.data],
  );

  // Applicant rows and all four tile counts now come from one hook, so this page,
  // the three list screens and the stats block cannot disagree. It fans out over
  // ALL jobs rather than live ones, because a closed listing still holds the
  // applicants who applied while it was open.
  const { applicationsByJob, stats, isLoading: statsLoading } = useEmployerApplications();

  // The whole dashboard waits for both its sources: the jobs list (tabs/rows)
  // and the applicant fan-out (the four numbers). While either is pending a
  // shimmer skeleton stands in for the stat card, the tab chips and the rows —
  // the numbers never render as raw zeros.
  const loading = jobsQuery.isLoading || statsLoading;

  const jobs: Job[] = useMemo(
    () =>
      gatewayJobs.map((job) => {
        const total = Math.max(Number(job.workers_needed ?? 0), 0);
        const filled = Math.max(Number(job.workers_hired ?? 0), 0);
        const rows = applicationsByJob.get(job.id) ?? [];
        return {
          id: job.id,
          title: job.title?.trim() || 'Untitled job',
          filled,
          total,
          closingSoon: listingStatus(job) === 'live' && total > 0 && filled / total >= 0.75,
          postedOn: postedOn(job.created_at),
          applied: rows.length,
          initials: avatarStack(rows),
          status: listingStatus(job),
        };
      }),
    [applicationsByJob, gatewayJobs],
  );

  const filtered = useMemo(
    () => jobs.filter((job) => job.status === activeTab.toLowerCase()),
    [jobs, activeTab],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { Live: 0, Draft: 0, Review: 0 };
    for (const job of jobs) {
      if (job.status === 'live') counts.Live += 1;
      if (job.status === 'draft') counts.Draft += 1;
      if (job.status === 'review') counts.Review += 1;
    }
    return counts;
  }, [jobs]);

  const ownerInitials = useMemo(() => initialsOf(user?.name) || 'ME', [user?.name]);

  // ---- Hero animation ------------------------------------------------------

  // Stable driver for every hero interpolation. Held in state rather than a
  // ref so its identity is created exactly once and it is never a ref read
  // during render.
  const [scrollY] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView | null>(null);
  const heroTop = insets.top + 6;

  // Background + hero foreground travel together, then clamp at -30 ("lock").
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -HERO_LOCK_DISTANCE],
    extrapolate: 'clamp',
  });

  // The logo/search/bell row fades + lifts, finishing exactly at the lock point.
  const rowOpacity = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const rowTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -22],
    extrapolate: 'clamp',
  });
  const titleTranslateX = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -160],
    extrapolate: 'clamp',
  });
  const addBtnTranslateX = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, 160],
    extrapolate: 'clamp',
  });

  // Never leave the transition mid-way. The strict (0, 30) window makes this
  // idempotent — a second event at an already-snapped 0 or 30 is a no-op, so a
  // fast flick that carries past the zone is left completely alone.
  const maybeSnap = useCallback((offsetY: number) => {
    if (offsetY > 0 && offsetY < HERO_LOCK_DISTANCE) {
      scrollRef.current?.scrollTo({
        y: offsetY < HERO_LOCK_DISTANCE / 2 ? 0 : HERO_LOCK_DISTANCE,
        animated: true,
      });
    }
  }, []);

  const onScrollEndDrag = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) =>
      maybeSnap(event.nativeEvent.contentOffset.y),
    [maybeSnap],
  );

  const onMomentumScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) =>
      maybeSnap(event.nativeEvent.contentOffset.y),
    [maybeSnap],
  );

  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );

  // ---- Navigation ----------------------------------------------------------

  const selectTab = useCallback(
    (key: string) => {
      const now = Date.now();
      if (now < lockUntilRef.current) return;
      lockUntilRef.current = now + 400;
      haptic.light();
      router.push(ROUTES[key] as never);
    },
    [router],
  );

  const notify = useCallback(() => haptic.light(), []);

  const go = useCallback(
    (target: string) => {
      notify();
      router.push(target as never);
    },
    [notify, router],
  );

  // Tiles use `go` rather than `selectTab`: they are navigation, not a filter
  // change, so they bypass the tab press-lock.
  const openStat = useCallback(
    (key: StatKey) => {
      go(STAT_ROUTES[key]);
    },
    [go],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    jobsQuery.refetch().finally(() => setRefreshing(false));
  }, [jobsQuery]);

  const contentStyle = useMemo(
    () => ({
      // Must be explicit — some RN/theme combos default ScrollView to an opaque
      // surface, which hides the hero background behind the overlap.
      backgroundColor: 'transparent',
      paddingTop: HERO_MAX_HEIGHT - HERO_OVERLAP,
      paddingBottom: NAV_CLEARANCE + insets.bottom + 24,
    }),
    [insets.bottom],
  );

  return (
    // Android view-flattening can merge these transparent absolutely-positioned
    // siblings into one opaque surface — collapsable={false} stops that.
    <View style={styles.screen} collapsable={false}>
      <StatusBar barStyle="light-content" />

      {/* LAYER 0 — hero background. Locks after 30px, always behind everything. */}
      <Animated.View
        pointerEvents="none"
        /* Forces Android to composite this layer on its own GPU texture instead of
           flattening it into its parent, preserving the transform + transparency. */
        renderToHardwareTextureAndroid
        /* Prevents Android's default alpha blending from double-compositing the
           transform + opacity animation into a visible seam/flash. */
        needsOffscreenAlphaCompositing
        style={[styles.heroBackground, { transform: [{ translateY: heroTranslateY }] }]}
      />

      {/* LAYER 1 — scrollable content. Always above the background, keeps
          scrolling even once the hero has locked. */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollLayer}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mint}
            colors={[colors.mint]}
          />
        }
      >
        {loading && !refreshing ? (
          <DashboardSkeleton />
        ) : (
          <>
            <StatCard stats={stats} onOpen={openStat} />
            <Tabs active={activeTab} counts={tabCounts} onSelect={setActiveTab} />
            <JobList
              jobs={filtered}
              tab={activeTab}
              onOpen={(job) => go(`/employer/job/${job.id}`)}
              onMenu={(job) => {
                haptic.selection();
                setMenuJob(job);
              }}
            />
          </>
        )}
      </Animated.ScrollView>

      {/* LAYER 2 — hero foreground controls. Topmost, so they stay visible and
          tappable; box-none lets everything not covered by a control fall
          through to the scroll layer underneath. */}
      <Animated.View
        pointerEvents="box-none"
        /* Same reason as the screen root — see the note there. */
        collapsable={false}
        style={[styles.heroForeground, { paddingTop: heroTop, transform: [{ translateY: heroTranslateY }] }]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.heroTopRow,
            { opacity: rowOpacity, transform: [{ translateY: rowTranslateY }] },
          ]}
        >
          <View style={styles.logoBox}>
            <AppIcon name="brief" size={16} color={colors.white} />
          </View>
          <Pressable style={styles.searchPill} onPress={() => go('/jobs')} accessibilityRole="search">
            <AppIcon name="search" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.searchText} numberOfLines={1}>
              Search jobs
            </Text>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => go('/inbox')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <AppIcon name="bell" size={16} color={colors.white} />
            {count > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
          {/* Rides in the fading row (no absolute positioning), so it can never
              sit on top of the bell or hide a scrolled stat tile. */}
          <Pressable
            style={styles.avatarBtn}
            onPress={() => go('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <Text style={styles.avatarBtnText}>{ownerInitials}</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.heroHeadingRow} pointerEvents="box-none">
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.heroTitle,
              { opacity: rowOpacity, transform: [{ translateX: titleTranslateX }] },
            ]}
          >
            Dashboard
          </Animated.Text>
          <Animated.View
            style={{ opacity: rowOpacity, transform: [{ translateX: addBtnTranslateX }] }}
          >
            <View style={styles.addBtnWrap}>
              {/* Soft static light hugging the pill (halo fill + boxShadow). */}
              <View style={styles.addBtnHalo} pointerEvents="none" />
              {/* Border window: the rotating gradient band below is only
                  visible through the 2px gap between this clip's edge and the
                  button — i.e. as a light line embedded in the border. */}
              <View style={styles.addBtnRing} pointerEvents="none">
                <Animated.View
                  style={[styles.addBtnRingSpin, { transform: [{ rotate: orbitRotate }] }]}
                >
                  <LinearGradient
                    colors={[
                      'rgba(255,255,255,0)',
                      'rgba(255,255,255,0.95)',
                      'rgba(255,255,255,0)',
                    ]}
                    locations={[0.47, 0.5, 0.53]}
                    style={styles.addBtnRingGradient}
                  />
                </Animated.View>
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => go('/employer/post-job')}
                accessibilityRole="button"
              >
                <AppIcon name="plus" size={12} color={colors.ink} />
                <Text style={styles.addBtnText}>Add New Job</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Bottom nav — own layer above the scroll content so the hero
          foreground's zIndex can never cover it. */}
      <View style={styles.navLayer} pointerEvents="box-none">
        <BottomTabBar activeKey="post" onSelect={selectTab} badgeCount={count} />
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={menuJob !== null}
        onRequestClose={() => setMenuJob(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetDismiss} onPress={() => setMenuJob(null)} />
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {menuJob?.title}
            </Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                if (!menuJob) return;
                const target = `/boost/plan`;
                setMenuJob(null);
                notify();
                router.push({ pathname: target, params: { jobId: menuJob.id } } as never);
              }}
            >
              <View style={styles.sheetRowIcon}>
                <AppIcon name="star" size={17} color={colors.ink} />
              </View>
              <View style={styles.sheetRowCopy}>
                <Text style={styles.sheetRowTitle}>Boost listing</Text>
                <Text style={styles.sheetRowSub}>Promote this job to reach more applicants</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                if (!menuJob) return;
                const target = `/employer/job/${menuJob.id}/edit`;
                setMenuJob(null);
                notify();
                router.push(target as never);
              }}
            >
              <View style={styles.sheetRowIcon}>
                <AppIcon name="edit" size={17} color={colors.ink} />
              </View>
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

// ---------------------------------------------------------------------------
// Stat card — four equal quadrants split by an inset cross. The cross stops
// short of the card's rounded corners, and the tiles still carry their own
// padding, so the gutter survives the value text growing a digit. All four are
// structurally identical so the 50% dividers stay aligned.
// ---------------------------------------------------------------------------

// Cutout illustrations rather than glyphs, so they carry their own colour and
// `color`/`strokeWidth` no longer apply. Kept in one map next to the labels
// below so a tile and its artwork can't drift apart. They're all wider than
// they are tall (roughly 1.2-1.5:1), so they're rendered `contain` in a square —
// a scaled-to-fit box would letterbox them to slivers.
const STAT_ICON_SIZE = 44;

const STAT_ICONS = {
  applications: require('../assets/images/applications.png'),
  jobsPosted: require('../assets/images/job-posted.png'),
  liveNow: require('../assets/images/live-jobs.png'),
  newApplicants: require('../assets/images/new applicants.png'),
} as const;

// Custom status artwork: a listing's bucket on this dashboard maps to the
// matching cutout icon — `review` (any job that is closed/filled/expired)
// reuses the "close" artwork.
const STATUS_ICONS: Record<JobStatus, ImageSourcePropType> = {
  live: require('../assets/images/open.png'),
  draft: require('../assets/images/draft.png'),
  review: require('../assets/images/close.png'),
};

const TAB_ICONS: Record<TabKey, ImageSourcePropType> = {
  Live: STATUS_ICONS.live,
  Draft: STATUS_ICONS.draft,
  Review: STATUS_ICONS.review,
};

type Stats = {
  totalApplications: number;
  jobsPosted: number;
  liveNow: number;
  newApplicants: number;
};

function StatCard({ stats, onOpen }: { stats: Stats; onOpen: (key: StatKey) => void }) {
  // Each tile opens the screen that explains its own number. The dividers stay
  // `pointerEvents="none"` siblings so they never swallow a tap, and the tile
  // padding constants they are tuned against are unchanged.
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardDividerV} pointerEvents="none" />
      <View style={styles.statCardDividerH} pointerEvents="none" />

      <Stat
        icon={STAT_ICONS.applications}
        label="Applications"
        value={stats.totalApplications}
        onPress={() => onOpen('applications')}
      />
      <Stat
        icon={STAT_ICONS.jobsPosted}
        label="Jobs posted"
        value={stats.jobsPosted}
        onPress={() => onOpen('jobsPosted')}
      />
      <Stat
        icon={STAT_ICONS.liveNow}
        label="Live now"
        value={stats.liveNow}
        onPress={() => onOpen('liveNow')}
      />
      <Stat
        icon={STAT_ICONS.newApplicants}
        label="New applicants"
        value={stats.newApplicants}
        onPress={() => onOpen('newApplicants')}
      />
    </View>
  );
}

type StatKey = 'applications' | 'jobsPosted' | 'liveNow' | 'newApplicants';

function Stat({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ImageSourcePropType;
  label: string;
  value: number;
  onPress: () => void;
}) {
  return (
    <ScalePressable
      onPress={onPress}
      hapticFeedback
      containerStyle={styles.stat}
      style={styles.statPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}. Opens the ${label.toLowerCase()} list`}
    >
      <View style={styles.statHead}>
        <Image source={icon} style={styles.statIcon} resizeMode="contain" />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </ScalePressable>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function Tabs({
  active,
  counts,
  onSelect,
}: {
  active: TabKey;
  counts: Record<TabKey, number>;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.tabs}>
      {TABS.map((tab) => (
        <Tab
          key={tab}
          active={active === tab}
          count={counts[tab]}
          icon={TAB_ICONS[tab]}
          label={tab}
          onPress={() => onSelect(tab)}
        />
      ))}
    </View>
  );
}

function Tab({
  active,
  count,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  icon: ImageSourcePropType;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Image source={icon} style={styles.tabIcon} resizeMode="contain" />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      <View style={[styles.tabCount, !active && styles.tabCountInactive]}>
        <Text style={[styles.tabCountText, !active && styles.tabCountTextInactive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Job list
// ---------------------------------------------------------------------------

function JobList({
  jobs,
  onMenu,
  onOpen,
  tab,
}: {
  jobs: Job[];
  onMenu: (job: Job) => void;
  onOpen: (job: Job) => void;
  tab: TabKey;
}) {
  if (jobs.length === 0) {
    return (
      <View style={styles.list}>
        <Text style={styles.status}>
          {tab === 'Live' ? 'No live listings yet.' : `No ${tab.toLowerCase()} listings yet.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onMenu={onMenu} onOpen={onOpen} />
      ))}
    </View>
  );
}

/**
 * Employer listings use the shared job container in its `row` variant with the
 * save heart hidden. The employer-only details this screen used to draw inline
 * — the filled/total progress bar, applicant avatar stack and posted date — are
 * not part of the shared container, so they are gone here.
 */
function JobCard({
  job,
  onMenu,
  onOpen,
}: {
  job: Job;
  onMenu: (job: Job) => void;
  onOpen: (job: Job) => void;
}) {
  const left = Math.max(job.total - job.filled, 0);
  const statusLabel = job.status === 'live' ? 'Live' : job.status === 'draft' ? 'Draft' : 'Review';

  return (
    <View style={styles.employerColumn}>
      <View style={styles.rowStatusBar}>
        <Image source={STATUS_ICONS[job.status]} style={styles.rowStatusIcon} resizeMode="contain" />
        <Text style={styles.rowStatusTx}>{statusLabel}</Text>
        <Text style={styles.rowStatusDate}>{job.postedOn}</Text>
      </View>
      <View style={styles.employerJobRow}>
        <JobCardView
          job={{
            id: job.id,
            title: job.title,
            employerName: 'Your listing',
            employerColor: colors.mint,
            payLabel: `${job.total} ${job.total === 1 ? 'position' : 'positions'}`,
            workArrangement: 'onsite',
            locationLabel: null,
            positionsLeft: left,
            positionsTotal: job.total,
          }}
          variant="row"
          hideSave
          onPress={() => onOpen(job)}
        />
        <Pressable
          hitSlop={10}
          onPress={() => onMenu(job)}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${job.title}`}
          style={styles.employerJobMenu}
        >
          <AppIcon name="dots" size={16} color={colors.sub} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dashboard skeleton — a shimmer stand-in for the stat card, the tab chips and
// the rows. Shown while either the jobs list or the applicant fan-out is
// pending, so the four numbers never render as raw zeros. It reuses the same
// staggered ShimmerIcon treatment as the job-list skeleton elsewhere.
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <View>
      <StatCardSkeleton />
      <TabsSkeleton />
      <ListSkeleton />
    </View>
  );
}

function StatCardSkeleton() {
  return (
    <View style={styles.skelStatCard}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.skelStatTile}>
          <ShimmerIcon delay={index * 140} pause={700} radius={12} style={styles.skelStatHead}>
            <View style={styles.skelStatIcon} />
            <View style={styles.skelStatLabel} />
          </ShimmerIcon>
          {/* The headline stat number gets its own tall bar — the point of the
              skeleton is that the counts aren't torn, so it can't be a thin line. */}
          <ShimmerIcon delay={index * 140} pause={700} radius={8} style={styles.skelStatNum}>
            <View style={styles.skelStatNumBar} />
          </ShimmerIcon>
        </View>
      ))}
    </View>
  );
}

function TabsSkeleton() {
  return (
    <View style={styles.skelTabs}>
      {[0, 1, 2].map((index) => (
        <ShimmerIcon key={index} delay={index * 140} pause={700} radius={999} style={styles.skelTab}>
          <View style={styles.skelTabLabel} />
          <View style={styles.skelTabCount} />
        </ShimmerIcon>
      ))}
    </View>
  );
}

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.skelList}>
      {Array.from({ length: count }, (_, index) => (
        <ShimmerIcon key={index} delay={index * 140} pause={700} radius={18} style={styles.skelRow}>
          <View style={styles.skelRowThumb} />
          <View style={styles.skelRowBody}>
            <View style={styles.skelRowTitle} />
            <View style={styles.skelRowMeta} />
          </View>
          <View style={styles.skelRowDot} />
        </ShimmerIcon>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Light page behind everything; the hero's rounded bottom corners notch into
  // this colour.
  screen: { flex: 1, backgroundColor: colors.pageBg, position: 'relative' },

  // Employer listing row: shared container plus the overflow menu beside it.
  // The status line sits above as its own row so it can never cover card text.
  employerColumn: { marginBottom: 14 },
  rowStatusBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  rowStatusIcon: { width: 14, height: 14, marginRight: 6 },
  rowStatusTx: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.mint },
  rowStatusDate: {
    fontFamily: fontFamily.interRegular,
    fontSize: 11,
    color: colors.sub,
    marginLeft: 8,
  },
  employerJobRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  employerJobMenu: { paddingHorizontal: 8, paddingVertical: 12 },

  // Layer 0 — background only
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_MAX_HEIGHT,
    backgroundColor: colors.green,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    zIndex: 0,
    elevation: 0,
  },

  // Layer 1 — scrollable content
  scrollLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    elevation: 1,
    // Same as contentStyle: the ScrollView's own surface must be transparent too,
    // not just its content container.
    backgroundColor: 'transparent',
  },

  // Layer 2 — hero foreground controls
  heroForeground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 2,
    elevation: 2,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: PILL,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  searchText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamily.interMedium,
    fontSize: 13,
    marginLeft: 8,
    flexShrink: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarBtnText: {
    color: colors.white,
    fontFamily: fontFamily.extraBold,
    fontSize: 13,
  },
  heroHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  heroTitle: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    marginRight: 12,
  },
  addBtnWrap: {
    // in-flow box around the pill; halo/orbit layers position against it.
    position: 'relative',
  },
  addBtnHalo: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: PILL,
    backgroundColor: 'rgba(255,255,255,0.26)',
    boxShadow: '0px 0px 20px 0px rgba(255,255,255,0.55)',
  },
  addBtnRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: PILL,
    overflow: 'hidden',
  },
  addBtnRingSpin: {
    position: 'absolute',
    width: 400,
    height: 400,
    top: '50%',
    left: '50%',
    marginLeft: -200,
    marginTop: -200,
  },
  addBtnRingGradient: {
    width: '100%',
    height: '100%',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBloom,
    borderRadius: PILL,
    paddingVertical: 10,
    paddingHorizontal: 16,
    // Opens the 2px window the border-embedded light line shines through.
    margin: 2,
    boxShadow: '0px 0px 14px 0px rgba(228,255,242,0.9)',
  },
  addBtnText: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    marginLeft: 6,
  },

  // Stat card
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 22,
    marginHorizontal: 20,
    marginTop: STAT_CARD_MARGIN_TOP,
    padding: STAT_CARD_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    shadowColor: colors.greenDark,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  // An inset cross, drawn level with the tile content so it stops short of the
  // card's rounded corners instead of running into them. The insets are
  // `STAT_CARD_PADDING` (to clear the card padding) plus the tile's own padding
  // (to stop where the icons and values begin) — deriving them means nudging a
  // tile's padding can never leave the cross hanging past the artwork.
  //
  // The 50% anchors split the card's *content* box, which is where the two tiles
  // meet — the start of the gap, not its middle. Each arm is therefore nudged
  // forward by half the tile padding (12 vertical, 10 horizontal) to sit centred
  // in the gutter. Half is exactly right: the gutter is two paddings wide, and
  // `50%` already lands on its first edge.
  statCardDividerV: {
    position: 'absolute',
    top: STAT_CARD_PADDING + STAT_TILE_PADDING_Y,
    bottom: STAT_CARD_PADDING + STAT_TILE_PADDING_Y,
    left: '50%',
    transform: [{ translateX: STAT_TILE_PADDING_X }],
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  statCardDividerH: {
    position: 'absolute',
    left: STAT_CARD_PADDING + STAT_TILE_PADDING_X,
    right: STAT_CARD_PADDING + STAT_TILE_PADDING_X,
    top: '50%',
    transform: [{ translateY: STAT_TILE_PADDING_Y }],
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  // The tiles are separated by their own padding, so the gutter survives the
  // value text growing a digit.
  stat: { width: '50%', paddingHorizontal: STAT_TILE_PADDING_X, paddingVertical: STAT_TILE_PADDING_Y },
  // The tile's width and padding live on the ScalePressable's container (the outer
  // animated view) so the 2x2 grid still measures correctly. This style then only
  // needs to make the touchable itself span that container, so the whole quadrant
  // is a 44pt-plus target rather than just the artwork.
  statPress: { alignSelf: 'stretch' },
  statHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  // A flat square for the illustration. No circle behind it: the artwork is a
  // cutout with its own background, and a disc would box it in.
  statIcon: {
    width: STAT_ICON_SIZE,
    height: STAT_ICON_SIZE,
    marginRight: 8,
  },
  statLabel: {
    flexShrink: 1,
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    color: colors.sub,
  },
  statValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 26,
    color: colors.ink,
  },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: PILL,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cardBg,
  },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabIcon: { width: 14, height: 14, marginRight: 6 },
  tabText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink },
  tabTextActive: { color: colors.pageBg },
  tabCount: {
    backgroundColor: colors.mintTint,
    borderRadius: PILL,
    paddingVertical: 1,
    paddingHorizontal: 7,
    marginLeft: 6,
  },
  tabCountInactive: { backgroundColor: colors.chipBg },
  tabCountText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.ink,
  },
  tabCountTextInactive: { color: colors.mint },

  // Job list
  list: { paddingHorizontal: 20, paddingTop: 14 },
  status: {
    fontFamily: fontFamily.interMedium,
    fontSize: 13,
    color: colors.sub,
    textAlign: 'center',
    paddingVertical: 28,
  },

  // Skeleton — mirrors the stat card, tabs and rows it stands in for. The card
  // chrome copies the shared row card (white, hairline border, soft shadow) and
  // the bars use the same low-contrast tone as the job-list skeleton.
  skelStatCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 22,
    marginHorizontal: 20,
    marginTop: STAT_CARD_MARGIN_TOP,
    padding: STAT_CARD_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skelStatTile: { width: '50%', paddingHorizontal: STAT_TILE_PADDING_X, paddingVertical: STAT_TILE_PADDING_Y },
  skelStatHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skelStatIcon: { width: STAT_ICON_SIZE, height: STAT_ICON_SIZE, borderRadius: 10, backgroundColor: '#E8F0EC', marginRight: 8 },
  skelStatLabel: { width: 64, height: 11, borderRadius: 5, backgroundColor: '#D8E1DC' },
  skelStatNum: { alignSelf: 'flex-start' },
  skelStatNumBar: { width: 84, height: 28, borderRadius: 8, backgroundColor: '#CAD5CF' },
  skelTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18 },
  skelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  skelTabLabel: { width: 44, height: 10, borderRadius: 5, backgroundColor: '#CAD5CF' },
  skelTabCount: { width: 22, height: 14, borderRadius: 7, marginLeft: 8, backgroundColor: '#D8E1DC' },
  skelList: { paddingHorizontal: 20, paddingTop: 14 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 14,
    backgroundColor: colors.cardBg,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 10,
  },
  skelRowThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#E8F0EC' },
  skelRowBody: { flex: 1, gap: 8 },
  skelRowTitle: { height: 15, borderRadius: 4, backgroundColor: '#CAD5CF', width: '70%' },
  skelRowMeta: { height: 11, borderRadius: 4, backgroundColor: '#D8E1DC', width: '45%' },
  skelRowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E1E8E3' },
  job: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  jobHighlight: { backgroundColor: colors.mint, borderColor: colors.mint },
  jobTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  jobTitleWrap: { flexShrink: 1, paddingRight: 8 },
  jobTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.ink },
  closingTag: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    marginTop: 4,
  },
  progressRow: { marginTop: 12, marginBottom: 4 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelText: { fontFamily: fontFamily.interSemiBold, fontSize: 11.5 },
  progressBar: {
    height: 7,
    borderRadius: PILL,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressBarHighlight: { backgroundColor: 'rgba(18,33,29,0.18)' },
  progressFill: { height: '100%', borderRadius: PILL, backgroundColor: colors.mint },
  progressFillHighlight: { backgroundColor: colors.ink },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  metaText: { fontFamily: fontFamily.interRegular, fontSize: 12.5, marginLeft: 5 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.cardBg,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: { marginLeft: -8 },
  avatarHighlight: { borderColor: colors.mint, backgroundColor: colors.ink },
  avatarLetter: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 10 },

  // Bottom nav layer — above the scroll content so the hero foreground's
  // zIndex can never cover it.
  navLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    elevation: 3,
    backgroundColor: colors.cardBg,
  },

  // Job action sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,84,67,0.45)' },
  sheetDismiss: { flex: 1 },
  actionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sheetRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sheetRowCopy: { flex: 1 },
  sheetRowTitle: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.ink },
  sheetRowSub: {
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
});
