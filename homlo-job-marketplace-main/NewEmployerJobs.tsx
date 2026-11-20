// "View all jobs" for one employer (visitor view). Data comes from the employer
// repository (live public feed first, curated fallback), unchanged.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { f } from './NewTheme';
import { Circ, Boundary } from './NewUI';
import { R, go } from './NewRoutes';
import { getEmployerById, getEmployerJobs } from '@/app/employer/[employerId]/employerRepository';
import type { Employer, EmploymentType, JobListing } from '@/app/employer/[employerId]/types';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { Skeleton } from '@/src/design/primitives';
import { haptic } from '@/lib/haptics';
import { AP } from '@/components/employer-job/applicants/tokens';

type Filter = 'all' | EmploymentType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'full-time', label: 'Full-time' },
  { key: 'part-time', label: 'Part-time' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'remote', label: 'Remote' },
];
const TYPE_LABEL: Record<EmploymentType, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', weekends: 'Weekends', remote: 'Remote' };
const LINE = '#E3E9EC';

/* ───────── glyphs ───────── */

const G = { fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function TypeGlyph({ t, color = AP.muted, size = 14 }: { t: EmploymentType; color?: string; size?: number }) {
  const p = { ...G, width: size, height: size, viewBox: '0 0 24 24', stroke: color, strokeWidth: 2 };
  if (t === 'part-time') return <Svg {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></Svg>;
  if (t === 'weekends') return <Svg {...p}><Rect x={4} y={5.5} width={16} height={14} rx={2.5} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Svg>;
  if (t === 'remote') return <Svg {...p}><Rect x={3.5} y={5} width={17} height={11} rx={2} /><Path d="M8 20h8M12 16v4" /></Svg>;
  return <Svg {...p}><Rect x={3.5} y={8} width={17} height={11.5} rx={2.5} /><Path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3.5 13h17" /></Svg>;
}
const PinGlyph = () => (
  <Svg {...G} width={14} height={14} viewBox="0 0 24 24" stroke={AP.faint} strokeWidth={2}><Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><Circle cx={12} cy={10} r={2.3} /></Svg>
);
const SeatGlyph = () => (
  <Svg {...G} width={14} height={14} viewBox="0 0 24 24" stroke={AP.faint} strokeWidth={2}><Circle cx={12} cy={8} r={3.5} /><Path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Svg>
);
const SortGlyph = () => (
  <Svg {...G} width={16} height={16} viewBox="0 0 24 24" stroke={AP.navy} strokeWidth={2}><Path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></Svg>
);
const VerifiedGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="m12 2.5 2.4 1.7 2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.5l-2.4-1.7-2.9.2-.9-2.8L3.4 15.5l.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2Z" fill={AP.cyan} /><Path d="m8.5 12.2 2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
);
const ChevronGlyph = () => (
  <Svg {...G} width={16} height={16} viewBox="0 0 24 24" stroke="#B6C3C9" strokeWidth={2.2}><Path d="m9 6 6 6-6 6" /></Svg>
);

/** Empty state art: an open folder with a magnifier finding nothing. Line art, no background. */
function NoJobsArt() {
  return (
    <Svg width={132} height={112} viewBox="0 0 132 112" fill="none">
      {/* folder back + tab */}
      <Path d="M18 34a6 6 0 0 1 6-6h22l7 8h45a6 6 0 0 1 6 6v44a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6Z" stroke={AP.navy} strokeWidth={2.4} strokeLinejoin="round" />
      {/* empty sheet sticking out */}
      <Path d="M32 44V30a3 3 0 0 1 3-3h36a3 3 0 0 1 3 3v14" stroke="#B6C3C9" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M40 35h20M40 41h12" stroke="#CDD7DC" strokeWidth={2.2} strokeLinecap="round" />
      {/* folder front, tilted open */}
      <Path d="M14 52a5 5 0 0 1 5-5h86a5 5 0 0 1 4.9 6l-6.4 30.2a6 6 0 0 1-5.9 4.8H24.3a6 6 0 0 1-5.9-4.9Z" stroke={AP.navy} strokeWidth={2.4} strokeLinejoin="round" fill="#FFFFFF" />
      <Path d="M30 64h28" stroke="#CDD7DC" strokeWidth={2.2} strokeLinecap="round" />
      {/* magnifier */}
      <Circle cx={94} cy={66} r={13} stroke={AP.amber} strokeWidth={3} fill="#FFFFFF" />
      <Path d="M103.5 75.5 114 86" stroke={AP.amber} strokeWidth={4} strokeLinecap="round" />
      <Path d="M89 66h10" stroke={AP.amber} strokeWidth={2.6} strokeLinecap="round" />
      {/* sparkles */}
      <Path d="M112 22v8M108 26h8" stroke={AP.cyan} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={22} cy={16} r={2.4} fill={AP.cyan} />
      <Circle cx={120} cy={48} r={1.8} fill="#B6C3C9" />
    </Svg>
  );
}

/** Job photo or a quiet placeholder with the job-type glyph. */
function Thumb({ job }: { job: JobListing }) {
  if (job.photoUrl) return <Image source={{ uri: job.photoUrl }} style={st.thumb} />;
  return <View style={[st.thumb, st.thumbEmpty]}><TypeGlyph t={job.employmentType} color={AP.cyanDeep} size={24} /></View>;
}

function dayGroup(postedAt: string) {
  const p = postedAt.toLowerCase();
  if (/just now|minute|hour|h ago|today/.test(p)) return 'Today';
  if (/yesterday/.test(p)) return 'Yesterday';
  if (/day/.test(p)) return 'This week';
  return 'Earlier';
}

function JobCard({ job, i, onPress }: { job: JobListing; i: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(360)} layout={LinearTransition.duration(260)}>
      <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${job.title}, ${TYPE_LABEL[job.employmentType]}, $${job.price} per ${job.priceUnit}`} style={st.card}>
        <Thumb job={job} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text numberOfLines={2} style={st.cardTitle}>{job.title}</Text>
          <View style={st.metaRow}><PinGlyph /><Text numberOfLines={1} style={st.metaText}>{job.location}</Text></View>
          <View style={st.tagRow}>
            <View style={st.tag}><TypeGlyph t={job.employmentType} color={AP.navy} size={13} /><Text style={st.tagText}>{TYPE_LABEL[job.employmentType]}</Text></View>
            {!!job.spotsLabel && <View style={st.metaRow}><SeatGlyph /><Text style={st.metaText}>{job.spotsLabel}</Text></View>}
          </View>
        </View>
        <View style={st.payCol}>
          <Text style={st.pay}>${job.price}</Text>
          <Text style={st.payUnit}>/{job.priceUnit}</Text>
          <View style={{ marginTop: 'auto' }}><ChevronGlyph /></View>
        </View>
      </PressableScaleNew>
    </Animated.View>
  );
}

/* ───────── screen ───────── */

function Screen() {
  const { employerId, id = '' } = useLocalSearchParams<{ employerId?: string; id: string }>();
  const ins = useSafeAreaInsets();
  const [flt, setFlt] = useState<Filter>('all');
  const [newest, setNewest] = useState(true);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      const eid = employerId || id;
      if (!eid) { setLoading(false); return; }
      const [e, j] = await Promise.all([getEmployerById(eid).catch(() => null), getEmployerJobs(eid).catch(() => [])]);
      if (!on) return;
      setEmployer(e);
      setJobs(j);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [employerId, id]);

  const name = employer?.name ?? (loading ? '' : 'This employer');
  const counts = useMemo(() => {
    const m = new Map<Filter, number>([['all', jobs.length]]);
    for (const j of jobs) m.set(j.employmentType, (m.get(j.employmentType) ?? 0) + 1);
    return m;
  }, [jobs]);
  // Only show type filters that have jobs (plus All), so no chip leads to nothing.
  const filters = FILTERS.filter((x) => x.key === 'all' || (counts.get(x.key) ?? 0) > 0);

  const rows = useMemo(() => {
    const l = jobs.filter((j) => flt === 'all' || j.employmentType === flt);
    return newest ? l : [...l].reverse();
  }, [jobs, flt, newest]);
  const groups = useMemo(() => {
    const out: { key: string; items: JobListing[] }[] = [];
    for (const j of rows) {
      const k = dayGroup(j.postedAt);
      const g = out.find((x) => x.key === k);
      if (g) g.items.push(j); else out.push({ key: k, items: [j] });
    }
    return out;
  }, [rows]);

  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const barTitle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [50, 90], [0, 1], Extrapolation.CLAMP) }));
  const barLine = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [10, 40], [0, 1], Extrapolation.CLAMP) }));

  const initials = (name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const filterLabel = FILTERS.find((x) => x.key === flt)?.label ?? 'All';

  return (
    <View style={st.root}>
      {/* top bar */}
      <View style={[st.bar, { paddingTop: ins.top + 8 }]}>
        <Circ n="back" label="Back" onPress={() => router.back()} />
        <Animated.Text numberOfLines={1} style={[st.barTitle, barTitle]}>{name}</Animated.Text>
        <View style={{ width: 44 }} />
        <Animated.View pointerEvents="none" style={[st.barLine, barLine]} />
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingTop: ins.top + 60, paddingBottom: ins.bottom + 32 }}
      >
        {/* employer header */}
        <View style={st.head}>
          {loading && !employer ? (
            <View style={{ gap: 10 }}>
              <Skeleton width={56} height={56} radius={16} />
              <Skeleton width="60%" height={24} radius={8} />
              <Skeleton width="40%" height={14} radius={6} />
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={{ gap: 12 }}>
              {employer?.avatarUrl ? (
                <Image source={{ uri: employer.avatarUrl }} style={st.logo} />
              ) : (
                <View style={[st.logo, st.logoEmpty]}><Text style={st.logoText}>{initials}</Text></View>
              )}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={2} style={st.name}>{name}</Text>
                  {employer?.verified ? <VerifiedGlyph /> : null}
                </View>
                <Text style={st.sub}>
                  {jobs.length === 1 ? '1 open job' : `${jobs.length} open jobs`}
                  {employer?.location ? ` · ${employer.location}` : ''}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* sticky filters */}
        <View style={st.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterRow}>
            {filters.map((x) => {
              const on = x.key === flt;
              return (
                <PressableScaleNew key={x.key} onPress={() => { if (!on) { haptic.selection(); setFlt(x.key); } }} scaleTo={0.95}
                  accessibilityLabel={`${x.label}, ${counts.get(x.key) ?? 0} jobs`} style={[st.chip, on && st.chipOn]}>
                  {x.key !== 'all' && <TypeGlyph t={x.key} color={on ? '#fff' : AP.muted} size={14} />}
                  <Text style={[st.chipText, on && { color: '#fff' }]}>{x.label}</Text>
                  <Text style={[st.chipCount, on && { color: 'rgba(255,255,255,0.7)' }]}>{counts.get(x.key) ?? 0}</Text>
                </PressableScaleNew>
              );
            })}
          </ScrollView>
          <View style={st.listHead}>
            <Text style={st.count}><Text style={{ fontFamily: f.h, color: AP.navy }}>{rows.length}</Text> {rows.length === 1 ? 'job' : 'jobs'}</Text>
            <PressableScaleNew onPress={() => { haptic.selection(); setNewest(!newest); }} scaleTo={0.95} accessibilityLabel={`Sort: ${newest ? 'newest first' : 'oldest first'}`} style={st.sort}>
              <SortGlyph />
              <Text style={st.sortText}>{newest ? 'Newest' : 'Oldest'}</Text>
            </PressableScaleNew>
          </View>
        </View>

        {/* list */}
        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              {[0, 1, 2, 3].map((k) => (
                <View key={k} style={[st.card, { borderColor: LINE }]}>
                  <Skeleton width={64} height={64} radius={14} />
                  <View style={{ flex: 1, gap: 8 }}><Skeleton width="70%" height={16} /><Skeleton width="45%" height={12} /><Skeleton width="35%" height={22} radius={8} /></View>
                </View>
              ))}
            </View>
          ) : rows.length === 0 ? (
            <Animated.View entering={FadeIn.duration(320)} style={st.empty}>
              <NoJobsArt />
              <Text style={st.emptyTitle}>{jobs.length === 0 ? 'No open jobs right now' : `No ${filterLabel.toLowerCase()} jobs`}</Text>
              <Text style={st.emptyBody}>
                {jobs.length === 0 ? `${name || 'This employer'} isn’t hiring at the moment. Check back soon for new listings.` : 'Try another job type to see what else is open.'}
              </Text>
              {jobs.length > 0 && (
                <PressableScaleNew onPress={() => setFlt('all')} scaleTo={0.96} accessibilityLabel="Show all jobs" style={st.emptyBtn}>
                  <Text style={st.emptyBtnText}>Show all jobs</Text>
                </PressableScaleNew>
              )}
            </Animated.View>
          ) : (
            groups.map((g) => (
              <Animated.View key={g.key} layout={LinearTransition.duration(260)}>
                <Text style={st.group}>{g.key}</Text>
                <View style={{ gap: 10 }}>
                  {g.items.map((j, i) => <JobCard key={j.id} job={j} i={i} onPress={() => go(R.job(j.id))} />)}
                </View>
              </Animated.View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: f.h, fontSize: 16, color: AP.navy, marginHorizontal: 8 },
  barLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#D5DEE2' },

  head: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  logo: { width: 56, height: 56, borderRadius: 16 },
  logoEmpty: { backgroundColor: AP.navy, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: f.h, fontSize: 20, color: '#FFFFFF' },
  name: { flexShrink: 1, fontFamily: f.h, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: AP.navy },
  sub: { marginTop: 4, fontFamily: f.m, fontSize: 14, color: AP.muted },

  filters: { backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5DEE2' },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: AP.navy, borderColor: AP.navy },
  chipText: { fontFamily: f.hb, fontSize: 13.5, color: AP.ink },
  chipCount: { fontFamily: f.m, fontSize: 12.5, color: AP.faint },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  count: { fontFamily: f.m, fontSize: 13, color: AP.muted },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 4 },
  sortText: { fontFamily: f.hb, fontSize: 13, color: AP.navy },

  group: { fontFamily: f.hb, fontSize: 13, color: AP.muted, marginTop: 18, marginBottom: 8 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  thumbEmpty: { backgroundColor: '#F3F7F8', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: f.h, fontSize: 15.5, lineHeight: 20, color: AP.navy },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { flexShrink: 1, fontFamily: f.m, fontSize: 12.5, color: AP.muted },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 24, borderRadius: 8, borderWidth: 1, borderColor: LINE },
  tagText: { fontFamily: f.hb, fontSize: 12, color: AP.navy },
  payCol: { alignItems: 'flex-end' },
  pay: { fontFamily: f.h, fontSize: 16, color: AP.navy },
  payUnit: { fontFamily: f.m, fontSize: 12, color: AP.faint },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { marginTop: 12, fontFamily: f.h, fontSize: 18, color: AP.navy, textAlign: 'center' },
  emptyBody: { fontFamily: f.m, fontSize: 14, lineHeight: 20, color: AP.muted, textAlign: 'center', maxWidth: 280 },
  emptyBtn: { marginTop: 12, height: 44, paddingHorizontal: 22, borderRadius: 12, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { fontFamily: f.hb, fontSize: 14, color: AP.navy },
});

export default function NewEmployerJobs() {
  console.log('NEW EmployerJobs mounted');
  return <Boundary><Screen /></Boundary>;
}
