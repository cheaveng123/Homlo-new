/**
 * "New applicants" tile.
 *
 * This is the one employer screen that is allowed to show statistics: the tile
 * it belongs to is a count, so the screen has to explain where that count came
 * from. It answers three questions in order — how many, when, and which job.
 *
 * Read state comes from `viewed_at` (migration 042) via useEmployerApplications,
 * so opening an application anywhere in the app decrements the unread figure
 * here on the next refetch. The optimistic overlay in the hook makes that instant
 * within a single mounted screen.
 *
 * The charts are hand-rolled from react-native-svg rather than pulling in a
 * charting library, which would be the only new dependency in this whole feature.
 * Every figure animates in: sections stagger up on mount, the histogram sweeps
 * its bars, and switching range remounts the figures so they replay.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, type CircleProps } from 'react-native-svg';
import { AppIcon } from '@/components/ui/AppIcon';

import { ScalePressable } from '@/components/ui/scale-pressable';
import { JobListingSkeleton } from '@/components/job-listing-skeleton';
import { StaggerIn } from '@/components/StaggerIn';
import ApplicantTicketCard, {
  ticketStatus,
  type Applicant,
} from '@/components/employer-job/ApplicantTicketCard';
import { colors, fontFamily } from '@/components/home/theme';
import { formatRelativeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { trpc } from '@/lib/trpc';
import {
  APPLICATIONS_RANGES,
  useEmployerApplications,
  type ApplicationsPerJob,
  type ApplicationsRange,
  type EmployerApplication,
} from '@/hooks/use-employer-applications';

/** The prompt asked for the top 5 jobs by applicant volume; the full list lives on Applications. */
const TOP_JOBS = 5;

const RANGE_LABEL: Record<ApplicationsRange, string> = {
  '1w': 'Past week',
  '1m': 'Past month',
  '6m': 'Past 6 months',
  '1y': 'Past year',
};

/**
 * Days in each range. The hook buckets per day, so the screen needs the same
 * numbers to label histogram columns and to re-derive each column's start date.
 */
const RANGE_DAYS: Record<ApplicationsRange, number> = { '1w': 7, '1m': 30, '6m': 183, '1y': 365 };

/**
 * Column count per range.
 *
 * A year is 365 daily buckets — far too many to render as separate bars, and
 * honest to draw as an area anyway. Grouping to ~12 columns keeps every column
 * wide enough to read and keeps the bar count animation-cheap.
 */
const RANGE_COLUMNS: Record<ApplicationsRange, number> = { '1w': 7, '1m': 15, '6m': 12, '1y': 12 };

/** One colour per slice, ordered for maximum separation between neighbours. */
const SLICE_COLORS = [colors.mint, colors.greenDark, colors.mintBloom, colors.amber, colors.amberDark];

const HISTOGRAM_HEIGHT = 116;
const DONUT_SIZE = 150;
const DONUT_THICKNESS = 26;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_THICKNESS) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function NewApplicantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<ApplicationsRange>('1m');
  const { stats, applicationsPerJob, applicationsOverTime, unread, isLoading, isError, refetch } =
    useEmployerApplications(range);

  const topJobs = useMemo(() => applicationsPerJob.slice(0, TOP_JOBS), [applicationsPerJob]);

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // A status change rewrites the ticket's tag in place, so the row needs the
  // fresh server copy rather than the optimistic one it was rendered from.
  const onApplicantChanged = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <StaggerIn index={0}>
          <View style={styles.header}>
            <ScalePressable
              onPress={() => router.back()}
              hapticFeedback
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <AppIcon name="back" size={20} color={colors.ink} />
            </ScalePressable>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>New applicants</Text>
              <Text style={styles.headerSubtitle}>Across all your jobs</Text>
            </View>
          </View>
        </StaggerIn>

        {isLoading ? (
          <JobListingSkeleton count={4} />
        ) : isError ? (
          <StaggerIn index={1}>
            <View style={styles.center}>
              <Text style={styles.errorTitle}>Couldn&rsquo;t load your applicants</Text>
              <Text style={styles.errorBody}>Check your connection and try again.</Text>
              <ScalePressable
                onPress={onRetry}
                hapticFeedback
                style={styles.retry}
                containerStyle={styles.retryWrap}
                accessibilityRole="button"
                accessibilityLabel="Retry loading applicants"
              >
                <Text style={styles.retryText}>Retry</Text>
              </ScalePressable>
            </View>
          </StaggerIn>
        ) : (
          <>
            <StaggerIn index={1}>
              <StatStrip stats={stats} />
            </StaggerIn>

            <StaggerIn index={2} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Applications received</Text>
                <Text style={styles.sectionMeta}>{RANGE_LABEL[range]}</Text>
              </View>
              <RangeTabs value={range} onChange={setRange} />
              {/* Keyed on range so switching periods replays the bar sweep
                  instead of leaving the old bars standing. */}
              <Histogram
                key={`hist-${range}`}
                columns={toColumns(applicationsOverTime.buckets, range)}
              />
            </StaggerIn>

            {topJobs.length > 0 ? (
              <StaggerIn index={3} style={styles.section}>
                <Text style={styles.sectionTitle}>Most applicants</Text>
                <Text style={styles.sectionHint}>Top {topJobs.length} of your listings</Text>
                <JobPie key={`pie-${range}`} entries={topJobs} />
              </StaggerIn>
            ) : null}

            <StaggerIn index={4} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Waiting on you</Text>
                <Text style={styles.sectionMeta}>{unread.length} unread</Text>
              </View>
              {unread.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>You&rsquo;re all caught up</Text>
                  <Text style={styles.emptyBody}>
                    New applications will appear here the moment they arrive.
                  </Text>
                </View>
              ) : (
                unread.map((application, index) => (
                  <StaggerIn key={application.id} index={5 + index}>
                    <TicketRow application={application} onChanged={onApplicantChanged} />
                  </StaggerIn>
                ))
              )}
            </StaggerIn>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Adapts a cross-job application to the ticket card the per-job screen uses.
 *
 * The list spans every listing, so the row has to carry its own job title and
 * route back through `application/[id]` with the job id that detail screen needs
 * to resolve the listing for pay and status.
 */
function TicketRow({
  application,
  onChanged,
}: {
  application: EmployerApplication;
  onChanged: () => void;
}) {
  const router = useRouter();
  const changeStatus = trpc.homlo.applications.changeStatus.useMutation();

  const applicant: Applicant = {
    id: application.id,
    name: application.fullName,
    appliedAt: formatRelativeAgo(application.appliedAt),
    note: application.message ?? '',
    location: application.locationLabel ?? 'Location not provided',
    status: ticketStatus(application.status),
    isNew: application.isNew,
    jobTitle: application.jobTitle,
  };

  function confirmMove(next: 'accepted' | 'rejected') {
    const hiring = next === 'accepted';
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
              .mutateAsync({
                applicationId: application.id,
                status: hiring ? 'hired' : 'declined',
              })
              .then(() => {
                haptic.success();
                onChanged();
              })
              .catch(() => {
                haptic.selection();
                Alert.alert("Couldn't update the application", 'Try again in a moment.');
              });
          },
        },
      ],
    );
  }

  return (
    <ApplicantTicketCard
      applicant={applicant}
      onAccept={() => confirmMove('accepted')}
      onReject={() => confirmMove('rejected')}
      onMessage={() =>
        router.push({
          pathname: '/conversations/[id]',
          params: {
            id: 'conversation',
            applicationId: application.id,
            name: application.fullName,
            applicationStatus: application.status,
          },
        } as never)
      }
      onPress={() =>
        router.push({
          pathname: '/employer/application/[id]',
          params: { id: application.id, jobId: application.jobId },
        } as never)
      }
    />
  );
}

function StatStrip({
  stats,
}: {
  stats: { totalApplications: number; newApplicants: number; jobsWithNew: number };
}) {
  return (
    <View style={[styles.statStrip, shadows.card]}>
      <Stat value={stats.totalApplications} label="Received" />
      <Stat value={stats.newApplicants} label="Unread" emphasis />
      <Stat value={stats.jobsWithNew} label="Jobs with new" divider />
    </View>
  );
}

function Stat({
  value,
  label,
  emphasis,
  divider,
}: {
  value: number;
  label: string;
  emphasis?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <AnimatedCount value={value} emphasis={emphasis} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Counts tick up rather than snapping, so a change caused by a refetch reads as intentional. */
function AnimatedCount({ value, emphasis }: { value: number; emphasis?: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 480 });
  }, [progress, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * progress.value,
    transform: [{ scale: 0.92 + 0.08 * progress.value }],
  }));

  return (
    <Animated.Text
      style={[styles.statValue, emphasis && styles.statValueEmphasis, animatedStyle]}
      // The label is already announced by the screen; the number would double up.
      accessibilityLabel={`${value}`}
    >
      {value}
    </Animated.Text>
  );
}

function RangeTabs({
  value,
  onChange,
}: {
  value: ApplicationsRange;
  onChange: (range: ApplicationsRange) => void;
}) {
  return (
    <View style={styles.rangeRow}>
      {APPLICATIONS_RANGES.map((option) => {
        const active = option === value;
        return (
          <ScalePressable
            key={option}
            onPress={() => onChange(option)}
            hapticFeedback
            style={[styles.rangeTab, active && styles.rangeTabActive]}
            containerStyle={styles.rangeTabWrap}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${RANGE_LABEL[option].toLowerCase()}`}
          >
            <Text style={[styles.rangeTabText, active && styles.rangeTabTextActive]}>{option}</Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

function startOfDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Folds the hook's daily buckets into a readable number of histogram columns,
 * re-deriving each column's label from its start date so the axis stays honest
 * at every range.
 */
function toColumns(
  buckets: { label: string; count: number }[],
  range: ApplicationsRange,
): { label: string; count: number }[] {
  const days = RANGE_DAYS[range];
  const from = startOfDayMs(Date.now()) - (days - 1) * 86_400_000;
  const size = Math.max(1, Math.ceil(days / RANGE_COLUMNS[range]));

  const columns: { label: string; count: number }[] = [];
  for (let index = 0; index < buckets.length; index += size) {
    let count = 0;
    for (let cursor = index; cursor < Math.min(index + size, buckets.length); cursor += 1) {
      count += buckets[cursor]?.count ?? 0;
    }
    const date = new Date(from + index * 86_400_000);
    columns.push({
      label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      count,
    });
  }
  return columns;
}

/** Applications received per period, as bars rather than an area. */
function Histogram({ columns }: { columns: { label: string; count: number }[] }) {
  const peak = Math.max(1, ...columns.map((column) => column.count));
  const total = columns.reduce((sum, column) => sum + column.count, 0);
  // Skip alternating labels so they never collide on a narrow phone.
  const labelStride = columns.length > 10 ? 2 : 1;

  return (
    <View style={styles.chart}>
      <View style={styles.histogram} accessibilityLabel={`${total} applications in this period`}>
        {columns.map((column, index) => (
          <HistogramBar
            key={column.label}
            ratio={column.count / peak}
            index={index}
            empty={column.count === 0}
          />
        ))}
      </View>
      <View style={styles.axis}>
        {columns.map((column, index) => (
          <Text
            key={`${column.label}-${index}`}
            style={[styles.axisLabel, index % labelStride !== 0 && styles.axisLabelHidden]}
            numberOfLines={1}
          >
            {column.label}
          </Text>
        ))}
      </View>
      <Text style={styles.chartTotal}>
        {total} application{total === 1 ? '' : 's'} in this period
      </Text>
    </View>
  );
}

function HistogramBar({
  ratio,
  index,
  empty,
}: {
  ratio: number;
  index: number;
  empty: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(Math.min(index, 14) * 26, withTiming(1, { duration: 420 }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    // A zero-value column still gets a 2px stub so the baseline stays continuous.
    height: Math.max(2, ratio * HISTOGRAM_HEIGHT * progress.value),
    opacity: empty ? 0.25 * progress.value : progress.value,
  }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

/**
 * Share of applicants per listing.
 *
 * A doughnut rather than a pie so the total can sit in the middle. Each slice is
 * a stroked circle whose dash offset animates from empty to filled, which sweeps
 * the arc in — animating an SVG arc path's `d` would mean recomputing path data
 * on every frame from the UI thread.
 */
function JobPie({ entries }: { entries: ApplicationsPerJob[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.total, 0);

  const ratios = entries.map((entry) => (total > 0 ? entry.total / total : 0));
  const slices = entries.map((entry, index) => ({
    entry,
    ratio: ratios[index],
    // Prefix sum of everything before this slice, so each arc starts where the
    // previous one stopped. Computed without mutating a running total.
    startRatio: ratios.slice(0, index).reduce((sum, value) => sum + value, 0),
    color: SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  return (
    <View style={styles.pieWrap}>
      <View style={styles.pieBox}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
          {slices.map((slice, index) => (
            <DonutSlice
              key={slice.entry.jobId}
              ratio={slice.ratio}
              startRatio={slice.startRatio}
              color={slice.color}
              delay={index * 110}
            />
          ))}
        </Svg>
        <View pointerEvents="none" style={styles.pieCentre}>
          <Text style={styles.pieCentreValue}>{total}</Text>
          <Text style={styles.pieCentreLabel}>
            applicant{total === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.entry.jobId} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendTitle} numberOfLines={1}>
              {slice.entry.jobTitle}
            </Text>
            <Text style={styles.legendValue}>
              {slice.entry.total}
              <Text style={styles.legendShare}>
                {total > 0 ? ` · ${Math.round(slice.ratio * 100)}%` : ''}
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DonutSlice({
  ratio,
  startRatio,
  color,
  delay,
}: {
  ratio: number;
  startRatio: number;
  color: string;
  delay: number;
}) {
  const arcLength = ratio * DONUT_CIRCUMFERENCE;
  const dashOffset = useSharedValue(DONUT_CIRCUMFERENCE);

  useEffect(() => {
    dashOffset.value = DONUT_CIRCUMFERENCE;
    dashOffset.value = withDelay(delay, withTiming(DONUT_CIRCUMFERENCE - arcLength, { duration: 620 }));
  }, [arcLength, dashOffset, delay]);

  const animatedProps = useAnimatedProps<CircleProps>(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <AnimatedCircle
      cx={DONUT_SIZE / 2}
      cy={DONUT_SIZE / 2}
      r={DONUT_RADIUS}
      stroke={color}
      strokeWidth={DONUT_THICKNESS}
      fill="none"
      strokeDasharray={`${arcLength} ${DONUT_CIRCUMFERENCE}`}
      // -90deg puts the first slice at 12 o'clock instead of 3.
      rotation={-90 + startRatio * 360}
      originX={DONUT_SIZE / 2}
      originY={DONUT_SIZE / 2}
      animatedProps={animatedProps}
    />
  );
}

const shadows = {
  card: {
    shadowColor: '#0A2A20',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    color: colors.sub,
  },
  statStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  statValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  statValueEmphasis: { color: colors.mint },
  statLabel: {
    marginTop: 4,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.sub,
    textAlign: 'center',
  },
  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 17,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    color: colors.sub,
  },
  sectionHint: {
    marginTop: 3,
    fontFamily: fontFamily.interRegular,
    fontSize: 12,
    color: colors.sub,
  },
  rangeRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
  // The wrapper carries the margin so the press scale doesn't clip it.
  rangeTabWrap: { flex: 1 },
  rangeTab: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rangeTabActive: { backgroundColor: colors.green, borderColor: colors.green },
  rangeTabText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.sub,
  },
  rangeTabTextActive: { color: colors.white },
  chart: { marginTop: 16 },
  // alignItems:flex-end keeps every bar sitting on the same baseline so a short
  // bar reads as "few" rather than "floating".
  histogram: {
    height: HISTOGRAM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  axisLabel: {
    flex: 1,
    fontFamily: fontFamily.interRegular,
    fontSize: 10,
    color: colors.sub,
    textAlign: 'center',
  },
  // Labels alternate rather than disappearing: the column keeps its width.
  axisLabelHidden: { opacity: 0 },
  chartTotal: {
    marginTop: 10,
    fontFamily: fontFamily.interSemiBold,
    fontSize: 12,
    color: colors.sub,
  },
  pieWrap: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 18 },
  pieBox: { width: DONUT_SIZE, height: DONUT_SIZE },
  pieCentre: {
    // Explicit insets rather than StyleSheet.absoluteFillObject, whose type is
    // missing from this project's React Native typings.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCentreValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  pieCentreLabel: {
    marginTop: 1,
    fontFamily: fontFamily.interRegular,
    fontSize: 11,
    color: colors.sub,
  },
  legend: { flex: 1, gap: 9 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTitle: {
    flex: 1,
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  legendValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 13,
    color: colors.ink,
  },
  legendShare: {
    fontFamily: fontFamily.interRegular,
    fontSize: 11,
    color: colors.sub,
  },
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyTitle: { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.ink },
  emptyBody: {
    marginTop: 5,
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    color: colors.sub,
    textAlign: 'center',
  },
  center: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48 },
  errorTitle: { fontFamily: fontFamily.extraBold, fontSize: 17, color: colors.ink },
  errorBody: {
    marginTop: 6,
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    color: colors.sub,
    textAlign: 'center',
  },
  retryWrap: { marginTop: 18 },
  retry: {
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
  },
  retryText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 15,
    color: colors.white,
  },
});