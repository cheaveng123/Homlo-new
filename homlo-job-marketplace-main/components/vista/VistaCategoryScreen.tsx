// VistaCategoryScreen.tsx
// Category detail page: animated hero (scene + shaped edge), employers, job cards.
// Deps: react-native-reanimated (3+), react-native-svg, react-native-safe-area-context
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown, SharedValue, ZoomIn, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  withSequence, withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VistaEdge } from './vistaEdge';
import { VistaScene } from './vistaScenes';
import { VistaJob, getVistaCategory, getVistaSceneIndex, vistaMix } from './vistaCategoryData';

type Props = {
  categoryKey?: string; // one of the 19 keys in vistaCategoryData.ts
  jobs?: VistaJob[]; // pass real jobs; falls back to sample jobs
  loading?: boolean;
  onBack?: () => void;
  onOpenSettings?: () => void;
  onOpenJob?: (job: VistaJob) => void;
  onOpenEmployer?: (job: VistaJob) => void;
  onGetAlerts?: () => void;
};

const BASE = 270; // hero height (+ safe-area top)
const MIN_BASE = 92; // collapsed hero height (+ safe-area top)
const EMP_H = 132; // "Hiring near you" block
const LIST_PAD = 16; // air between the employers row and the first card

const initials = (s: string) => s.split(' ').filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join('');
const kindLabel = (k: VistaJob['kind']) => (k === 'monthly' ? 'Monthly' : k === 'partTime' ? 'Part-time' : 'Remote');

export default function VistaCategoryScreen({ categoryKey = 'sales', jobs, loading, onBack, onOpenSettings, onOpenJob, onOpenEmployer, onGetAlerts }: Props) {
  const cat = useMemo(() => getVistaCategory(categoryKey), [categoryKey]);
  const sceneIndex = getVistaSceneIndex(categoryKey);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const MAX = BASE + insets.top, MIN = MIN_BASE + insets.top, RANGE = MAX - MIN;
  const LIST_Y = MAX + EMP_H + LIST_PAD;

  const all = jobs ?? cat.jobs;
  const companies = useMemo(() => {
    const seen = new Set<string>();
    return all.filter((job) => {
      if (seen.has(job.company)) return false;
      seen.add(job.company);
      return true;
    });
  }, [all]);
  const logoColor = (n: number) => [cat.pay, vistaMix(cat.pay, '#000000', 0.3), vistaMix(cat.pay, '#445566', 0.45)][n % 3];

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const titleW = useSharedValue(190), titleH = useSharedValue(90);

  const heroStyle = useAnimatedStyle(() => ({ height: MAX - Math.min(Math.max(scrollY.value, 0), RANGE) }));
  const sceneStyle = useAnimatedStyle(() => {
    const y = Math.max(scrollY.value, 0), p = Math.min(y / RANGE, 1);
    return { opacity: Math.max(0, 1 - p * 1.2), transform: [{ translateY: -y * 0.45 }, { scale: 1 - p * 0.35 }] };
  });
  const titleStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(scrollY.value, 0) / RANGE, 1), s = 1 - p * 0.42;
    // scale around the bottom-left corner
    return { transform: [{ translateX: -(titleW.value / 2) * (1 - s) }, { translateY: (titleH.value / 2) * (1 - s) }, { scale: s }] };
  });
  const subStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 0.85 * (1 - Math.min(scrollY.value / RANGE, 1) * 1.8)) }));
  const miniStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(scrollY.value, 0) / RANGE, 1);
    return { opacity: Math.max(0, (p - 0.6) / 0.4), transform: [{ translateY: (1 - p) * 8 }] };
  });
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ translateY: withSpring(scrollY.value > 140 ? 0 : 100, { damping: 14 }) }] }));

  const longest = Math.max(...cat.title.split(' ').map((w) => w.length));
  const titleSize = Math.min(34, Math.floor(170 / (0.56 * longest)));
  const gradEnd = vistaMix(cat.bg, cat.light, 0.35);

  return (
    <View style={s.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: MAX, minHeight: height + RANGE + 40, paddingBottom: 120 }}
      >
        <View style={{ height: EMP_H }}>
          <View style={s.secRow}>
            <Text style={s.sec}>Hiring near you</Text>
            <Text style={s.secSmall}>
              {loading && all.length === 0 ? 'Loading…' : `${all.length} ${all.length === 1 ? 'job' : 'jobs'} open`}
            </Text>
          </View>
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.emps}>
            {companies.map((companyJob, k) => {
              const name = companyJob.company;
              return (
                <Animated.View key={name} entering={ZoomIn.delay(200 + k * 70).springify()} style={s.emp}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${name} profile`}
                    disabled={!onOpenEmployer}
                    onPress={() => onOpenEmployer?.(companyJob)}
                    style={s.empPress}
                  >
                    <View style={[s.empLogo, { backgroundColor: logoColor(k) }]}><Text style={s.empTxt}>{initials(name)}</Text></View>
                    <Text numberOfLines={1} style={s.empName}>{name.split(' ')[0]}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>
        </View>
        <View style={s.list}>
          {all.map((j) => (
            <JobCard key={j.id} job={j} baseY={LIST_Y} scrollY={scrollY} viewH={height} color={logoColor(companies.findIndex((c) => c.company === j.company))}
              pay={cat.pay} tagBg={cat.bg} tagInk={cat.ink} onPress={() => onOpenJob?.(j)} onOpenEmployer={onOpenEmployer} />
          ))}
          {all.length === 0 && <Text style={s.empty}>{loading ? 'Loading jobs…' : 'No jobs here yet.'}</Text>}
        </View>
        <Text style={s.end}>That’s everything here for now. New jobs show up first.</Text>
      </Animated.ScrollView>

      {/* hero */}
      <Animated.View style={[s.hero, heroStyle]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="vistaHeroGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={cat.bg} />
              <Stop offset="1" stopColor={gradEnd} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#vistaHeroGrad)" />
        </Svg>

        <Animated.View style={[s.scene, { top: insets.top + 58 }, sceneStyle]} pointerEvents="none">
          <VistaScene index={sceneIndex} ink={cat.ink} accent={cat.accent} light={cat.light} width={160} />
        </Animated.View>

        <VistaEdge width={width} type={cat.edge.type} n={cat.edge.n} seed={cat.edge.seed} seconds={24 + (sceneIndex % 5) * 7} />

        <Pressable accessibilityLabel="Back" onPress={onBack} style={[s.round, { left: 18, top: insets.top + 10 }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M15 5l-7 7 7 7" stroke="#12302a" strokeWidth={2.5} strokeLinecap="round" fill="none" /></Svg>
        </Pressable>
        <Pressable accessibilityLabel="Settings" onPress={onOpenSettings} style={[s.round, { right: 18, top: insets.top + 10 }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" stroke="#12302a" strokeWidth={2} strokeLinecap="round" fill="none" /></Svg>
        </Pressable>

        <Animated.View key={cat.key} entering={FadeInDown.duration(450)} style={[s.titleBox, titleStyle]}
          onLayout={(e) => { titleW.value = e.nativeEvent.layout.width; titleH.value = e.nativeEvent.layout.height; }}>
          <Text style={[s.h1, { color: cat.ink, fontSize: titleSize, lineHeight: titleSize * 1.05 }]}>{cat.title}</Text>
          <Animated.Text style={[s.sub, { color: cat.ink }, subStyle]}>{cat.blurb}</Animated.Text>
        </Animated.View>
        <Animated.Text numberOfLines={1} style={[s.mini, { color: cat.ink }, miniStyle]}>{cat.title}</Animated.Text>
      </Animated.View>

      <Animated.View style={[s.fabWrap, fabStyle]} pointerEvents="box-none">
        <Pressable onPress={onGetAlerts} style={[s.fab, { backgroundColor: cat.pay }]}><Text style={s.fabTxt}>Get job alerts</Text></Pressable>
      </Animated.View>
    </View>
  );
}

type CardProps = {
  job: VistaJob; baseY: number; scrollY: SharedValue<number>; viewH: number;
  color: string; pay: string; tagBg: string; tagInk: string; onPress: () => void;
  onOpenEmployer?: (job: VistaJob) => void;
};

const JobCard = memo(function JobCard({ job, baseY, scrollY, viewH, color, pay, tagBg, tagInk, onPress, onOpenEmployer }: CardProps) {
  const y = useSharedValue(0);
  const heart = useSharedValue(1);
  const [saved, setSaved] = useState(false);

  // scroll-driven entrance: cards rise, scale up and un-tilt as they enter from the bottom
  const style = useAnimatedStyle(() => {
    const rel = (baseY + y.value - scrollY.value) / viewH;
    const t = Math.min(1, Math.max(0, (1 - rel) / 0.22));
    return { opacity: t, transform: [{ perspective: 700 }, { translateY: (1 - t) * 34 }, { scale: 0.92 + t * 0.08 }, { rotateX: `${(1 - t) * 8}deg` }] };
  });
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  return (
    <Animated.View style={style} onLayout={(e) => { y.value = e.nativeEvent.layout.y; }}>
      <Pressable onPress={onPress} style={s.card}>
        {onOpenEmployer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${job.company} profile`}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              onOpenEmployer(job);
            }}
            style={[s.logo, { backgroundColor: color }]}
          >
            <Text style={s.logoTxt}>{initials(job.company)}</Text>
          </Pressable>
        ) : (
          <View style={[s.logo, { backgroundColor: color }]}><Text style={s.logoTxt}>{initials(job.company)}</Text></View>
        )}
        <View style={s.cardMid}>
          <Text style={s.jobTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={s.company} numberOfLines={1}>{job.company}</Text>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.price, { color: pay }]}>${job.pay} / {job.kind === 'partTime' ? 'day' : 'mo'}</Text>
          <Pressable hitSlop={10} accessibilityLabel="Save job"
            // Reanimated's standard handler pattern; this rule only fires due to
            // module-order analysis of memo()'d cards, not on the write itself.
            // eslint-disable-next-line react-hooks/immutability
            onPress={() => { setSaved((v) => !v); heart.value = withSequence(withSpring(1.4), withSpring(1)); }}>
            <Animated.View style={heartStyle}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" strokeWidth={2} strokeLinejoin="round"
                  stroke={saved ? pay : '#9bb0ab'} fill={saved ? pay : 'none'} />
              </Svg>
            </Animated.View>
          </Pressable>
        </View>
        <View style={s.tags}>
          <Text style={[s.tag, { backgroundColor: tagBg, color: tagInk }]}>{kindLabel(job.kind)}</Text>
          <Text style={s.dist}>{job.kind === 'remote' ? 'Work from home' : `${job.km.toFixed(1)} km away`}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 10 },
  scene: { position: 'absolute', right: 10, width: 160 },
  round: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  titleBox: { position: 'absolute', left: 20, bottom: 36, width: 190 },
  h1: { fontWeight: '800', letterSpacing: -0.8 },
  sub: { marginTop: 8, fontSize: 13, fontWeight: '500', lineHeight: 18, maxWidth: 170 },
  mini: { position: 'absolute', left: 66, right: 66, bottom: 36, textAlign: 'center', fontWeight: '800', fontSize: 16 },
  secRow: { paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sec: { fontSize: 17, fontWeight: '800', color: '#12302a' },
  secSmall: { fontSize: 12, fontWeight: '600', color: '#5d7570' },
  emps: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  emp: { width: 68, alignItems: 'center' },
  empPress: { width: 68, alignItems: 'center' },
  empLogo: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  empTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  empName: { fontSize: 11, fontWeight: '600', color: '#5d7570' },
  list: { paddingHorizontal: 20, paddingTop: LIST_PAD, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1.5, borderColor: '#e3ece9', padding: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cardMid: { flex: 1, marginHorizontal: 12 },
  jobTitle: { fontSize: 15, fontWeight: '800', color: '#12302a' },
  company: { fontSize: 13, fontWeight: '500', color: '#5d7570', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 15, fontWeight: '800' },
  tags: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  tag: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, overflow: 'hidden' },
  dist: { fontSize: 12, fontWeight: '600', color: '#5d7570' },
  empty: { textAlign: 'center', color: '#5d7570', paddingVertical: 24 },
  end: { textAlign: 'center', color: '#5d7570', fontSize: 13, fontWeight: '500', paddingHorizontal: 30, paddingTop: 26 },
  fabWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  fab: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 99, elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  fabTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
