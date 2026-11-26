import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Image, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from '@/lib/router';
import LinearGradient from '@/lib/native/linear-gradient';
import { AppIcon } from "@/components/ui/AppIcon";
import Animated, { Easing, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { C, F, Reveal, ScrollYCtx, shadow } from './01_exploreShared';
import { JobsMapHero } from './02_JobsMapHero';
import type { JobCardData } from '@/components/jobs/jobCardTypes';

const TOP_BG = require('@/assets/images/background new.png');
type Job = JobCardData;
const imgUri = (src: ImageSourcePropType): string => Image.resolveAssetSource(src)?.uri ?? '';
const MOCK: Job[] = [
  { id: '1', title: 'Plumbing technician', employerName: 'Everest Electric', payLabel: '$100 / day', workArrangement: 'onsite', locationLabel: 'Phnom Penh', imageUrl: imgUri(require('@/assets/images/parttimenew.png')) },
  { id: '2', title: 'Café barista', employerName: 'Café Fresh', payLabel: '$280 / month', workArrangement: 'onsite', locationLabel: 'Toul Kork', imageUrl: imgUri(require('@/assets/images/fulltimenew.png')) },
  { id: '3', title: 'Weekend tutor', employerName: 'Soka Kids', payLabel: '$8 / hour', workArrangement: 'onsite', locationLabel: 'Boeng Keng Kang', imageUrl: imgUri(require('@/assets/images/weekendnew.png')) },
  { id: '4', title: 'Remote support agent', employerName: 'HelpDesk Remote', payLabel: '$6 / hour', workArrangement: 'remote', imageUrl: imgUri(require('@/assets/images/remotenew.png')) },
];

const SEARCH_H = 56, GAP = 14;

type Props = {
  /** Existing animated search field (typewriter placeholder etc.). Keep its animation; give it borderRadius 999. */
  field?: React.ReactNode;
  jobs?: Job[];
  /** The app's real JobCard, passed from the route so job containers stay identical to home's. */
  renderJob: (j: Job) => React.ReactNode;
  onOpenFilters?: () => void; onOpenMap?: () => void; onOpenNearby?: () => void;
};

export default function ExploreScreen({ field, jobs = MOCK, renderJob, onOpenFilters, onOpenMap, onOpenNearby }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const [heroW, setHeroW] = useState(0);

  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(withTiming(-8, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [floatY]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const openFilters = onOpenFilters ?? (() => router.push('/explore/filters'));

  return (
    <ScrollYCtx.Provider value={scrollY}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* Header: top image + location/bell + title */}
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 6 }}>
            <View onLayout={(e) => setHeroW(e.nativeEvent.layout.width)} style={[StyleSheet.absoluteFill, { top: 0, left: 0, right: 0, bottom: -160, overflow: 'hidden', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }]} pointerEvents="none">
              {heroW > 0 && (
                <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: heroW, height: heroW }, floatStyle]}>
                  <Image source={TOP_BG} resizeMode="contain" style={{ width: heroW, height: heroW }} />
                  <LinearGradient colors={['rgba(246,248,247,0)', 'rgba(246,248,247,0.85)', '#F6F8F7']} locations={[0, 0.5, 0.8]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroW * 0.25 }} pointerEvents="none" />
                </Animated.View>
              )}
            </View>
            <View style={styles.row}>
              <View style={[styles.pill, shadow]}><AppIcon name="pin" size={16} color={C.mint} /><Text style={styles.pillTx}>Phnom Penh</Text></View>
              <Pressable style={[styles.rbtn, shadow]}><AppIcon name="bell" size={20} color={C.text} /><View style={styles.dot} /></Pressable>
            </View>
            <Text style={styles.title}>{'Explore\nsmarter'}</Text>
            <Text style={styles.tsub}>Flexible jobs, matched to your area</Text>
          </View>

          {/* Search bar sits in normal flow so it scrolls away with the page */}
          <View style={{ paddingHorizontal: 20, marginTop: GAP, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.fieldWrap, shadow]}>
                {field ?? (
                  <View style={styles.field}><AppIcon name="search" size={20} color={C.muted} /><TextInput placeholder="Search for a job" placeholderTextColor={C.muted} style={{ flex: 1, fontFamily: F.b400, fontSize: 15 }} /></View>
                )}
              </View>
              <Pressable onPress={openFilters} style={({ pressed }) => [styles.filter, shadow, pressed && { transform: [{ scale: 0.92 }] }]}>
                <AppIcon name="sliders" size={21} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <Reveal><JobsMapHero onPress={onOpenMap} /></Reveal>

            <Reveal delay={100} style={{ marginTop: 12 }}>
              <Pressable onPress={onOpenNearby} style={styles.nearby}>
                <View style={styles.nearbyIcon}><AppIcon name="map" size={26} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.h700, fontSize: 16, color: '#fff' }}>Explore nearby</Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 12, color: '#fff', opacity: 0.7, marginTop: 2 }}>Browse by neighbourhood</Text>
                </View>
                <View style={styles.go}><AppIcon name="chevron" size={20} color="#fff" /></View>
              </Pressable>
            </Reveal>

            <View style={styles.sec}>
              <View><Text style={styles.h3}>Jobs near you</Text><Text style={{ fontFamily: F.b400, fontSize: 13, color: C.muted, marginTop: 2 }}>Fresh opportunities in your area</Text></View>
              <View style={[styles.sort, shadow]}><AppIcon name="sort" size={16} color={C.text} /><Text style={{ fontFamily: F.b600, fontSize: 13, color: C.text }}>Sort</Text></View>
            </View>
            <View style={styles.grid}>
              {jobs.map((j, i) => (
                <Reveal key={j.id} from="left" delay={i * 60} style={{ width: '48%', flexGrow: 1 }}>
                  {renderJob(j)}
                </Reveal>
              ))}
            </View>
            {jobs.length === 0 && <Text style={styles.empty}>No jobs near you yet</Text>}
          </View>
        </Animated.ScrollView>
      </View>
    </ScrollYCtx.Provider>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingVertical: 9, paddingLeft: 10, paddingRight: 14 },
  pillTx: { fontFamily: F.b500, fontSize: 13, color: C.text },
  rbtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: C.orange, borderWidth: 2, borderColor: '#fff' },
  title: { fontFamily: F.h800, fontSize: 40, lineHeight: 41, letterSpacing: -1, color: C.forest, marginTop: 20 },
  tsub: { fontFamily: F.b400, fontSize: 15, color: C.forest, opacity: 0.8, marginTop: 8 },
  fieldWrap: { flex: 1, height: SEARCH_H, borderRadius: 999, backgroundColor: '#F3F4F2' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, borderRadius: 999 },
  filter: { width: SEARCH_H, height: SEARCH_H, borderRadius: 999, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.forest, borderRadius: 26, padding: 12 },
  nearbyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  go: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  sec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  h3: { fontFamily: F.h700, fontSize: 19, color: C.text },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { fontFamily: F.b400, fontSize: 13, color: C.muted, paddingVertical: 8 },
});
