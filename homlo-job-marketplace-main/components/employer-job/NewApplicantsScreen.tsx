/**
 * "New applicants" tile — employer dashboard style.
 *
 * Answers three questions in order: how many (hero ring + counts), when (lit bar
 * chart with a range switch), and which job (donut + per-job containers), then
 * lists the applications still waiting on the employer.
 *
 * Read state comes from `viewed_at` via useEmployerApplications, so opening an
 * application anywhere decrements the unread figure here on the next refetch.
 * Data, routes and status changes are unchanged from the previous screen; only
 * the presentation is new.
 */
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from '@/lib/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { Skeleton } from '@/src/design/primitives';
import { SMOOTH } from '@/src/design/motion';
import { useCountUpNew } from '@/src/new/theme/motionNew';
import { RevealOnScroll, ScrollRevealProvider } from '@/src/new/components/home/ScrollRevealNew';
import { formatRelativeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { trpc } from '@/lib/trpc';
import {
  APPLICATIONS_RANGES,
  useEmployerApplications,
  type ApplicationsRange,
  type EmployerApplication,
} from '@/hooks/use-employer-applications';

import { ApplicationsChart, RANGE_LABEL } from './applicants/ApplicationsChart';
import { JobBreakdown } from './applicants/JobBreakdown';
import { ApplicantCardNew } from './applicants/ApplicantCardNew';
import {
  AllCaughtUpArt,
  BackGlyph,
  ChartGlyph,
  JobsNewGlyph,
  ReceivedGlyph,
  StackGlyph,
  UnreadGlyph,
  WaitingGlyph,
} from './applicants/ApplicantGlyphs';
import { AP, cardShadow } from './applicants/tokens';

/** Top 5 jobs by applicant volume; the full list lives on Applications. */
const TOP_JOBS = 5;
const SHEET_OVERLAP = 26;

const ACircle = Animated.createAnimatedComponent(Circle);
const RING = 92;
const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;

export function NewApplicantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: viewportH } = useWindowDimensions();
  const [range, setRange] = useState<ApplicationsRange>('1m');
  const { stats, applicationsPerJob, applicationsOverTime, unread, isLoading, isError, refetch } =
    useEmployerApplications(range);

  const topJobs = useMemo(() => applicationsPerJob.slice(0, TOP_JOBS), [applicationsPerJob]);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  // Status-bar backdrop fades in once the hero has scrolled away.
  const statusBar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [200, 280], [0, 1], Extrapolation.CLAMP) }));

  const onRetry = useCallback(() => { void refetch(); }, [refetch]);
  // A status change rewrites the card, so it needs the fresh server copy.
  const onApplicantChanged = useCallback(() => { void refetch(); }, [refetch]);

  return (
    <View style={st.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <ScrollRevealProvider scrollY={y} viewportH={viewportH}>
          <Hero
            topInset={insets.top}
            scrollY={y}
            loading={isLoading}
            received={stats.totalApplications}
            unread={stats.newApplicants}
            jobsWithNew={stats.jobsWithNew}
            onBack={() => router.back()}
          />

          <View style={[st.sheet, { paddingBottom: insets.bottom + 32 }]}>
            {isLoading ? (
              <LoadingSheet />
            ) : isError ? (
              <ErrorCard onRetry={onRetry} />
            ) : (
              <>
                <Section
                  index={0}
                  glyph={<ChartGlyph />}
                  title="Applications received"
                  meta={RANGE_LABEL[range]}
                >
                  <ApplicationsChart ranges={APPLICATIONS_RANGES} range={range} onRange={setRange} buckets={applicationsOverTime.buckets} />
                </Section>

                {topJobs.length > 0 && (
                  <Section
                    index={1}
                    glyph={<StackGlyph />}
                    title="By job"
                    meta={`Top ${topJobs.length} listings`}
                    action={applicationsPerJob.length > TOP_JOBS ? { label: 'See all', onPress: () => router.push('/employer/applications' as never) } : undefined}
                  >
                    <JobBreakdown key={range} entries={topJobs} onOpenJob={(id) => router.push(`/employer/job/${id}` as never)} />
                  </Section>
                )}

                <RevealOnScroll style={st.waitHead}>
                  <View style={st.headGlyph}><WaitingGlyph /></View>
                  <TextNew variant="section" heading weight="extrabold" color={AP.navy} style={st.sectionTitle}>Waiting on you</TextNew>
                  <View style={st.countPill}>
                    <TextNew variant="caption" heading weight="extrabold" color={AP.white}>{unread.length}</TextNew>
                  </View>
                </RevealOnScroll>

                {unread.length === 0 ? (
                  <RevealOnScroll style={[st.card, cardShadow, st.empty]}>
                                  <AllCaughtUpArt />
                    <TextNew variant="section" heading weight="extrabold" color={AP.navy} align="center" style={{ marginTop: 14 }}>You&rsquo;re all caught up</TextNew>
                    <TextNew variant="body" color={AP.muted} align="center" style={{ marginTop: 4 }}>
                      New applications will appear here the moment they arrive.
                    </TextNew>
                  </RevealOnScroll>
                ) : (
                  <View style={{ gap: 14 }}>
                    {unread.map((application, i) => (
                      <RevealOnScroll key={application.id} index={i % 3}>
                        <ApplicantRow application={application} onChanged={onApplicantChanged} />
                      </RevealOnScroll>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollRevealProvider>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[st.statusStrip, { height: insets.top + 14 }, statusBar]}>
        <LinearGradient colors={[AP.white, AP.white, 'rgba(255,255,255,0)']} locations={[0, 0.7, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

/* ───────── hero ───────── */

function UnreadRing({ unread, received, loading }: { unread: number; received: number; loading: boolean }) {
  const reduced = useReducedMotion();
  const ratio = received > 0 ? Math.min(1, unread / received) : 0;
  const target = RING_C * (1 - ratio);
  const off = useSharedValue(RING_C);
  useEffect(() => {
    if (loading) return;
    off.value = reduced ? target : withDelay(200, withTiming(target, { duration: 1100, easing: SMOOTH }));
  }, [target, loading, reduced, off]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  const n = useCountUpNew(loading ? 0 : unread, 900);
  return (
    <View style={st.ringWrap}>
      <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="#E8EEF1" strokeWidth={8} fill="none" />
        <ACircle
          animatedProps={arc}
          cx={RING / 2} cy={RING / 2} r={RING_R} stroke={AP.amber} strokeWidth={8} strokeLinecap="round" fill="none"
          strokeDasharray={`${RING_C} ${RING_C}`} transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={st.ringCenter} pointerEvents="none">
        <TextNew variant="hero" heading weight="extrabold" color={AP.navy} style={st.ringNum}>{loading ? '–' : n}</TextNew>
        <TextNew variant="caption" weight="medium" color={AP.muted} style={{ fontSize: 11, lineHeight: 14 }}>unread</TextNew>
      </View>
    </View>
  );
}

function HeroStat({ glyph, label, value, index, loading, last }: { glyph: ReactNode; label: string; value: number; index: number; loading: boolean; last?: boolean }) {
  const n = useCountUpNew(loading ? 0 : value, 900);
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(200 + index * 90).duration(450)} style={[st.statRow, !last && st.statLine]}>
      <View style={st.statGlyph}>{glyph}</View>
      <TextNew variant="body" weight="medium" color={AP.muted} numberOfLines={1} style={{ flex: 1 }}>{label}</TextNew>
      <TextNew variant="header" heading weight="extrabold" color={AP.navy} style={st.statNum}>{loading ? '–' : n}</TextNew>
    </Animated.View>
  );
}

function Hero({ topInset, scrollY, loading, received, unread, jobsWithNew, onBack }: {
  topInset: number; scrollY: SharedValue<number>; loading: boolean; received: number; unread: number; jobsWithNew: number; onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const bg = useAnimatedStyle(() => {
    const v = scrollY.value;
    if (reduced) return {};
    if (v < 0) return { transform: [{ translateY: v / 2 }, { scaleY: 1 + -v / 320 }] };
    return { transform: [{ translateY: v * 0.4 }] };
  });
  const content = useAnimatedStyle(() => {
    const v = Math.max(0, scrollY.value);
    return {
      opacity: interpolate(v, [0, 180], [1, 0], Extrapolation.CLAMP),
      transform: reduced ? [] : [{ translateY: v * 0.3 }, { scale: interpolate(v, [0, 200], [1, 0.96], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={[st.hero, { paddingTop: topInset + 8 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bg]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: AP.white }]} />
      </Animated.View>

      <Animated.View style={content}>
        <View style={st.topRow}>
          <PressableScaleNew onPress={onBack} scaleTo={0.92} accessibilityLabel="Go back" style={st.glassBtn}>
            <BackGlyph color={AP.navy} />
          </PressableScaleNew>
        </View>
        <TextNew variant="hero" heading weight="extrabold" color={AP.navy} style={st.title}>New applicants</TextNew>
        <TextNew variant="body" weight="medium" color={AP.muted}>Across all your jobs</TextNew>

        <View style={st.summary}>
          <UnreadRing unread={unread} received={received} loading={loading} />
          <View style={{ flex: 1 }}>
            <HeroStat index={0} loading={loading} glyph={<ReceivedGlyph size={22} color={AP.navy} />} label="Received" value={received} />
            <HeroStat index={1} loading={loading} glyph={<UnreadGlyph size={22} color={AP.navy} />} label="Unread" value={unread} />
            <HeroStat index={2} loading={loading} glyph={<JobsNewGlyph size={22} color={AP.navy} />} label="Jobs with new" value={jobsWithNew} last />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ───────── sections ───────── */

function Section({ index, glyph, title, meta, action, children }: {
  index: number; glyph: ReactNode; title: string; meta?: string; action?: { label: string; onPress: () => void }; children: ReactNode;
}) {
  return (
    <RevealOnScroll index={index} style={[st.card, cardShadow, st.section]}>
      <View style={st.sectionHead}>
        <View style={st.headGlyph}>{glyph}</View>
        <View style={{ flex: 1 }}>
          <TextNew variant="section" heading weight="extrabold" color={AP.navy} style={st.sectionTitle}>{title}</TextNew>
          {!!meta && <TextNew variant="caption" color={AP.muted}>{meta}</TextNew>}
        </View>
        {action && (
          <PressableScaleNew onPress={action.onPress} accessibilityLabel={action.label} style={st.sectionAction}>
            <TextNew variant="meta" heading weight="bold" color={AP.cyan}>{action.label}</TextNew>
          </PressableScaleNew>
        )}
      </View>
      {children}
    </RevealOnScroll>
  );
}

function LoadingSheet() {
  return (
    <View style={{ gap: 16 }}>
      <View style={[st.card, cardShadow, st.section, { gap: 14 }]}>
        <Skeleton width="55%" height={18} />
        <Skeleton height={36} radius={14} />
        <Skeleton height={148} radius={14} />
      </View>
      <View style={[st.card, cardShadow, st.section, { gap: 12 }]}>
        <Skeleton width="40%" height={18} />
        {[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={18} />)}
      </View>
    </View>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={[st.card, cardShadow, st.empty]}>
      <TextNew variant="section" heading weight="extrabold" color={AP.navy} align="center">Couldn&rsquo;t load your applicants</TextNew>
      <TextNew variant="body" color={AP.muted} align="center" style={{ marginTop: 4 }}>Check your connection and try again.</TextNew>
      <PressableScaleNew onPress={onRetry} accessibilityLabel="Retry loading applicants" style={st.retry}>
        <TextNew variant="body" heading weight="bold" color={AP.white}>Try again</TextNew>
      </PressableScaleNew>
    </View>
  );
}

/* ───────── applicant row: maps data + owns status changes and navigation ───────── */

function ApplicantRow({ application, onChanged }: { application: EmployerApplication; onChanged: () => void }) {
  const router = useRouter();
  const changeStatus = trpc.homlo.applications.changeStatus.useMutation();

  function confirmMove(hiring: boolean) {
    Alert.alert(
      hiring ? 'Accept this applicant?' : 'Reject this applicant?',
      hiring
        ? `${application.fullName} will be notified that they were hired for ${application.jobTitle}.`
        : `${application.fullName} will be notified they were not selected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hiring ? 'Accept' : 'Reject',
          style: hiring ? 'default' : 'destructive',
          onPress: () => {
            haptic.selection();
            changeStatus
              .mutateAsync({ applicationId: application.id, status: hiring ? 'hired' : 'declined' })
              .then(() => { haptic.success(); onChanged(); })
              .catch((err) => {
                haptic.selection();
                Alert.alert("Couldn't update the application", err instanceof Error ? err.message : 'Try again in a moment.');
              });
          },
        },
      ],
    );
  }

  return (
    <ApplicantCardNew
      busy={changeStatus.isPending}
      data={{
        name: application.fullName,
        avatarUrl: application.avatarUrl,
        jobTitle: application.jobTitle,
        appliedAgo: formatRelativeAgo(application.appliedAt),
        location: application.locationLabel ?? 'Location not provided',
        message: application.message,
        isNew: application.isNew,
      }}
      onAccept={() => confirmMove(true)}
      onReject={() => confirmMove(false)}
      onMessage={() =>
        router.push({
          pathname: '/conversations/[id]',
          params: { id: 'conversation', applicationId: application.id, name: application.fullName, applicationStatus: application.status },
        } as never)
      }
      onPress={() =>
        router.push({ pathname: '/employer/application/[id]', params: { id: application.id, jobId: application.jobId } } as never)
      }
    />
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: AP.white },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  hero: { paddingHorizontal: 16, paddingBottom: 26 + SHEET_OVERLAP, overflow: 'visible' },
  topRow: { flexDirection: 'row', marginBottom: 14 },
  glassBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: AP.white, borderWidth: 1, borderColor: AP.line,
  },
  title: { fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum: { fontSize: 26, lineHeight: 30 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  statLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E3E7' },
  statGlyph: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 19, lineHeight: 24 },
  sheet: {
    flexGrow: 1, marginTop: -SHEET_OVERLAP, paddingTop: 20, paddingHorizontal: 16, gap: 18, backgroundColor: AP.white,
    borderTopLeftRadius: SHEET_OVERLAP, borderTopRightRadius: SHEET_OVERLAP,
  },
  card: { backgroundColor: AP.white, borderRadius: 22, borderWidth: 1, borderColor: AP.line },
  section: { padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headGlyph: { width: 38, height: 38, borderRadius: 12, backgroundColor: AP.tint, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, lineHeight: 23 },
  sectionAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  waitHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  countPill: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: AP.amber, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  retry: { marginTop: 18, height: 46, paddingHorizontal: 28, borderRadius: 23, backgroundColor: AP.cyan, alignItems: 'center', justifyContent: 'center' },
});
