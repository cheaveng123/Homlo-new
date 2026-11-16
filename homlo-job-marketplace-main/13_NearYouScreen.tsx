// → app/jobs/near-you.tsx
// Page 3 of 4: Jobs near you. Map with price pins, 1 / 3 / 5 km radius circles, hill edge into the list.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/ui/AppIcon';
import { JobsMap } from '../../components/jobs/JobsMap';
import { SelectorCircle, SelectorText, SectionTitle, JobCard, LogoSquare, DistanceBadge } from '../../components/jobs/JobsUI';
import { JOBS, payText, typeLabel, travelText, useSavedJobs } from '../../lib/jobsData';
import { J, S, TS, shadowMd } from '../../lib/jobsTheme';
import { F } from '../../lib/profileTheme';

const RADII = [1, 3, 5];

export default function NearYouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggle } = useSavedJobs();
  const [radius, setRadius] = useState(3);
  // TODO: replace with real distance-sorted results from the user's location
  const jobs = useMemo(() => JOBS.filter((j) => j.km != null && j.km <= radius).sort((a, b) => a.km! - b.km!), [radius]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.xxl }}>
        <View>
          <JobsMap radiusKm={radius} jobs={jobs} height={400} />

          <View style={[n.topRow, { top: insets.top + S.sm }]}>
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={n.circleBtn}>
              <AppIcon name="back" size={22} color={J.fg} />
            </Pressable>
            <View style={n.search}>
              <AppIcon name="search" size={20} color={J.muted} />
              <Text style={n.searchT}>Within <Text style={{ fontFamily: F.h700, color: J.fg }}>{radius} km</Text> of BKK1</Text>
            </View>
          </View>

          <View style={n.radii}>
            {RADII.map((r) => (
              <SelectorCircle key={r} size={52} selected={radius === r} onPress={() => setRadius(r)} tint={J.bg}>
                <SelectorText>{`${r} km`}</SelectorText>
              </SelectorCircle>
            ))}
          </View>

          <View style={n.hill} pointerEvents="none">
            <Svg width="100%" height={34} viewBox="0 0 390 34" preserveAspectRatio="none"><Path d="M0 30Q195 -10 390 30V34H0z" fill="#fff" /></Svg>
          </View>
        </View>

        <View style={{ marginTop: S.sm }}><SectionTitle>{`${jobs.length} jobs within ${radius} km`}</SectionTitle></View>
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {jobs.map((j) => (
            <JobCard
              key={j.id} lead={<LogoSquare letter={j.company[0]} tint={j.tint} />}
              title={j.title} subtitle={`${j.company} · ${j.area}`} chips={[payText(j), typeLabel(j)]}
              right={<DistanceBadge km={j.km!} note={travelText(j.km!)} />}
              saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const n = StyleSheet.create({
  topRow: { position: 'absolute', left: S.lg, right: S.lg, flexDirection: 'row', gap: S.sm },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4 },
  search: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4 },
  searchT: { fontFamily: F.b400, fontSize: TS.body, color: J.muted },
  radii: { position: 'absolute', left: S.lg, bottom: 48, flexDirection: 'row', gap: S.sm, backgroundColor: 'rgba(255,255,255,0.94)', padding: 10, borderRadius: 999, ...shadowMd, shadowOpacity: 0.14 },
  hill: { position: 'absolute', left: 0, right: 0, bottom: -1 },
});
