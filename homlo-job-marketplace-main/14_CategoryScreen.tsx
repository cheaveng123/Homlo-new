// → app/jobs/category/[slug].tsx   (slug = cafe | hotel | retail | delivery | office)
// Page 4 of 4: the JOB FIELD page (Category detail). Opens when the user taps a job category anywhere in the app:
//   router.push(`/jobs/category/${category.id}`)
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '../../../components/ui/AppIcon';
import {
  SunriseHeader, OverlapCard, RoleChip, MiniSegmented, SectionTitle, JobCard, LogoSquare, Gauge,
} from '../../../components/jobs/JobsUI';
import { JOBS, CATEGORIES, CategoryId, hourlyEq, payText, typeLabel, useSavedJobs } from '../../../lib/jobsData';
import { J, S, TS } from '../../../lib/jobsTheme';
import { F } from '../../../lib/profileTheme';

const SORTS = ['Best match', 'Nearest', 'Pay'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function CategoryScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const id = (slug as CategoryId) in CATEGORIES ? (slug as CategoryId) : 'cafe';
  const meta = CATEGORIES[id];
  const { saved, toggle } = useSavedJobs();
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState(0);

  const all = useMemo(() => JOBS.filter((j) => j.cat === id), [id]);
  const roles = useMemo(() => Array.from(new Set(all.map((j) => j.role).filter(Boolean))) as string[], [all]);
  const eq = all.map(hourlyEq);
  const min = Math.min(...eq), max = Math.max(...eq), avg = eq.reduce((a, b) => a + b, 0) / eq.length;
  const markerPct = max === min ? 50 : ((avg - min) / (max - min)) * 100;

  const list = useMemo(() => {
    const a = all.filter((j) => role === 'all' || j.role === role);
    return [...a].sort((x, y) => (sort === 0 ? y.match - x.match : sort === 1 ? (x.km ?? 99) - (y.km ?? 99) : hourlyEq(y) - hourlyEq(x)));
  }, [all, role, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.xxl }}>
        <SunriseHeader title="Category" onBack={() => router.back()} onFilter={() => { /* TODO: filters sheet */ }}>
          <View style={c.lead}>
            <View style={c.bigIcon}><AppIcon name={meta.icon} size={30} color={J.sun} /></View>
            <View style={{ flex: 1 }}>
              <Text style={c.leadT}>{meta.title}</Text>
              <Text style={c.leadS}>{meta.open} jobs hiring now</Text>
            </View>
          </View>
        </SunriseHeader>

        <OverlapCard>
          <View style={c.stats}>
            <Stat value={`${meta.open}`} label="Open jobs" />
            <Stat value={`$${avg.toFixed(1)}/hr`} label="Average pay" bordered />
            <Stat value={`${meta.urgent}`} label="Urgent" bordered />
          </View>
          <View style={c.ladder}>
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 5, overflow: 'hidden' }]}>
              <LinearGradient colors={['#BFE3E1', J.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </View>
            <View style={[c.marker, { left: `${markerPct}%` }]} />
          </View>
          <View style={c.ladderLabels}>
            <Text style={c.small}>${min.toFixed(1)}</Text><Text style={c.small}>Typical hourly pay</Text><Text style={c.small}>${max.toFixed(1)}</Text>
          </View>
        </OverlapCard>

        {roles.length > 0 && (
          <View style={{ marginTop: S.xl }}>
            <Text style={[c.h3, { marginHorizontal: S.lg }]}>Roles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm }}>
              <RoleChip label="All" selected={role === 'all'} onPress={() => setRole('all')} />
              {roles.map((r) => <RoleChip key={r} label={cap(r)} selected={role === r} onPress={() => setRole(r)} />)}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: S.lg }}><MiniSegmented items={SORTS} index={sort} onChange={setSort} /></View>

        <View style={{ paddingHorizontal: S.lg, gap: S.md, marginTop: S.lg }}>
          {list.map((j) => (
            <JobCard
              key={j.id} lead={<LogoSquare letter={j.company[0]} tint={j.tint} />}
              title={j.title} subtitle={`${j.company} · ${j.area}`}
              chips={[payText(j), typeLabel(j), ...(j.km != null ? [`${j.km} km`] : [])]}
              right={<Gauge value={j.match} />} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const Stat = ({ value, label, bordered }: { value: string; label: string; bordered?: boolean }) => (
  <View style={[c.stat, bordered && { borderLeftWidth: 1, borderLeftColor: J.border }]}>
    <Text style={c.statV}>{value}</Text><Text style={c.small}>{label}</Text>
  </View>
);

const c = StyleSheet.create({
  lead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: S.lg, paddingTop: S.lg, maxWidth: 300 },
  bigIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: J.sun, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  leadT: { fontFamily: F.h800, fontSize: TS.hero, color: '#fff' },
  leadS: { fontFamily: F.b400, fontSize: TS.body, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontFamily: F.h800, fontSize: TS.header, color: J.deep },
  small: { fontFamily: F.b400, fontSize: TS.caption, color: J.muted },
  ladder: { height: 10, borderRadius: 5, marginTop: 22, marginHorizontal: S.xs, marginBottom: S.sm, overflow: 'visible' },
  marker: { position: 'absolute', top: -6, width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: J.sun, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  ladderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  h3: { fontFamily: F.h700, fontSize: TS.title, color: J.fg, marginBottom: S.md },
});
