// → app/jobs/recommended.tsx
// Page 1 of 4: Recommended. Hero "Top match", category selector circles, match-gauge list.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon, IconName } from '../../components/ui/AppIcon';
import { Button } from '../../components/profile/ProfileUI';
import {
  SunriseHeader, HeaderLead, OverlapCard, Gauge, SelectorCircle, SectionTitle, JobCard, LogoSquare, Chips,
} from '../../components/jobs/JobsUI';
import { JOBS, payText, typeLabel, useSavedJobs } from '../../lib/jobsData';
import { J, S, TS, TINTS } from '../../lib/jobsTheme';
import { F } from '../../lib/profileTheme';

const CATS: { id: string; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'grid' }, { id: 'cafe', label: 'Café', icon: 'cup' }, { id: 'hotel', label: 'Hotel', icon: 'hotel' },
  { id: 'retail', label: 'Retail', icon: 'bag' }, { id: 'delivery', label: 'Delivery', icon: 'bike' }, { id: 'office', label: 'Office', icon: 'laptop' },
];

export default function RecommendedScreen() {
  const router = useRouter();
  const { saved, toggle } = useSavedJobs();
  const [cat, setCat] = useState('all');
  const top = JOBS[0]; // TODO: highest match from the recommendations endpoint
  const list = useMemo(
    () => JOBS.filter((j) => cat === 'all' || j.cat === cat).sort((a, b) => b.match - a.match),
    [cat],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.xxl }}>
        <SunriseHeader title="Recommended" onBack={() => router.back()} onFilter={() => { /* TODO: filters sheet */ }}>
          <HeaderLead title="Hi Meng, 9 new matches today" sub="Based on your skills and availability" />
        </SunriseHeader>

        <OverlapCard>
          <View style={s.eyebrow}>
            <AppIcon name="bolt" size={14} color={J.eyebrowInk} />
            <Text style={s.eyebrowT}>Top match</Text>
          </View>
          <View style={s.heroRow}>
            <Gauge value={top.match} size={96} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle} numberOfLines={1}>{top.title}</Text>
              <Text style={s.heroSub} numberOfLines={1}>{top.company} · {top.area} · {top.km} km</Text>
            </View>
          </View>
          <Chips items={['✓ Coffee skills', '✓ Weekends', '✓ Khmer + English']} tone="tint" />
          <View style={s.actions}>
            <Button label="Quick apply" icon="bolt" shine style={{ flex: 1 }} onPress={() => { /* TODO: quick-apply flow */ }} />
            <Pressable style={s.saveSq} accessibilityLabel="Save top match" onPress={() => toggle(top.id)}>
              <AppIcon name={saved.has(top.id) ? 'check' : 'plus'} size={22} color={J.deep} />
            </Pressable>
          </View>
        </OverlapCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: S.xl }} contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: 4, paddingBottom: 4, gap: S.md }}>
          {CATS.map((c, i) => (
            <SelectorCircle key={c.id} label={c.label} selected={cat === c.id} tint={TINTS[i % 4][0]} onPress={() => setCat(c.id)}>
              <AppIcon name={c.icon} size={26} color={J.deep} />
            </SelectorCircle>
          ))}
        </ScrollView>

        <SectionTitle>Matched to your skills</SectionTitle>
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {list.map((j) => (
            <JobCard
              key={j.id} lead={<LogoSquare letter={j.company[0]} tint={j.tint} />}
              title={j.title} subtitle={`${j.company} · ${j.area}`} chips={[payText(j), typeLabel(j)]}
              right={<Gauge value={j.match} />} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
              onPress={undefined /* TODO: open the existing job detail screen */}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: J.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  eyebrowT: { fontFamily: F.b600, fontSize: TS.caption, color: J.eyebrowInk },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: S.lg, marginVertical: S.md },
  heroTitle: { fontFamily: F.h700, fontSize: 18, color: J.fg },
  heroSub: { fontFamily: F.b400, fontSize: TS.meta, color: J.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: 14 },
  saveSq: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: J.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
