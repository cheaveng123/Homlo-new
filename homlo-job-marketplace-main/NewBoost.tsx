// Boost plan screen, bound to the real pricing data (lib/boostData.ts).
// Visual layer: glass hero with the plan art, a list of plan rows (the chosen one
// opens to show what it includes), and a frosted bar with the Continue action.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { f } from './NewTheme';
import { Circ, CountUp, Boundary } from './NewUI';
import { R, go } from './NewRoutes';
import { BoostPlanImage } from '@/components/BoostPlanImage';
import { BOOST_PLANS, RECOMMENDED_INDEX } from '@/lib/boostData';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { SMOOTH } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import { AP, cardShadow, liftShadow } from '@/components/employer-job/applicants/tokens';

type Opt = { id: string; name: string; days: number; price: number; pro: number; tag: string; rec?: boolean; perks: string[] };
// Real pricing: plans, Pro prices, features and the recommended index all come from boostData.
const OPTS: Opt[] = BOOST_PLANS.map((p, i) => ({
  id: p.id,
  name: p.name,
  days: p.days,
  price: p.price,
  pro: p.proPrice,
  tag: p.tag,
  rec: i === RECOMMENDED_INDEX,
  perks: p.features,
}));
const NAVY = ['#21486A', '#14324A'] as const;

/* ───────── small pieces ───────── */

const Check = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
const Bolt = ({ size = 16, color = AP.amber }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M13.4 2.8 5.6 13.2h5.5l-1.3 8 7.9-10.6h-5.6Z" fill={color} /></Svg>
);
const Arrow = ({ color = '#fff' }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);

function StepBar({ on }: { on: boolean }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(on ? 1 : 0, { duration: 450, easing: SMOOTH }); }, [on, w]);
  const a = useAnimatedStyle(() => ({ flex: w.value }));
  return <View style={st.stepTrack}><Animated.View style={[{ backgroundColor: AP.navy, borderRadius: 3 }, a]} /></View>;
}

/** Soft orbit rings that breathe out from behind the plan art. */
function Orbit({ delay, color }: { delay: number; color: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: SMOOTH }), -1, false));
  }, [delay, p, reduced]);
  const a = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 0.55 + p.value * 0.75 }] }));
  return <Animated.View pointerEvents="none" style={[st.orbit, { borderColor: color }, a]} />;
}

/* ───────── plan row ───────── */

function PlanRow({ o, i, on, onPress }: { o: Opt; i: number; on: boolean; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 60).duration(420)} layout={LinearTransition.duration(280)}>
      <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${o.name}, ${o.days} days, $${o.price.toFixed(2)}`}
        style={[st.row, on ? st.rowOn : null, on ? liftShadow : cardShadow]}>
        {on && <LinearGradient pointerEvents="none" colors={['#FFF7EA', '#FFFFFF']} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
        <View style={st.rowTop}>
          <View style={[st.thumb, on && { backgroundColor: '#FFF1D6', borderColor: '#FBE3B5' }]}>
            <Image source={BOOST_PLANS[i].image} style={{ width: 40, height: 40 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.rowName}>{o.name}</Text>
              {o.rec && <View style={st.recTag}><Text style={st.recTagText}>Recommended</Text></View>}
            </View>
            <Text style={st.rowMeta}>{o.days} days{o.rec || o.tag.toLowerCase() === o.name.toLowerCase() ? '' : ` · ${o.tag.charAt(0) + o.tag.slice(1).toLowerCase()}`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={st.rowPrice}>${o.price.toFixed(2)}</Text>
            <Text style={st.rowPro}>Pro ${o.pro.toFixed(2)}</Text>
          </View>
          <View style={[st.radio, on && st.radioOn]}>{on && <Check size={12} />}</View>
        </View>
        {on && (
          <Animated.View entering={FadeIn.duration(260)} style={st.perks}>
            <View style={st.perkDivider} />
            {o.perks.map((p) => (
              <View key={p} style={st.perk}>
                <View style={st.perkTick}><Check size={11} color={AP.cyanDeep} /></View>
                <Text style={st.perkText}>{p}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </PressableScaleNew>
    </Animated.View>
  );
}

/* ───────── screen ───────── */

function Screen() {
  const { jobId = '', id = '', step = '1' } = useLocalSearchParams<{ jobId?: string; id?: string; step?: string }>();
  const ins = useSafeAreaInsets();
  const job = jobId || id;
  const [i, setI] = useState(Math.max(0, OPTS.findIndex((x) => x.rec)));
  const o = OPTS[i];
  const pick = (n: number) => { if (n !== i) { haptic.selection(); setI(n); } };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* warm light behind the top of the page */}
      <View pointerEvents="none" style={st.backdrop}>
        <LinearGradient colors={['#FFF3DF', '#F4FAFC', '#FFFFFF']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={[st.blob, { width: 240, height: 240, top: -80, right: -60, backgroundColor: '#FFC765', opacity: 0.45 }]} />
        <View style={[st.blob, { width: 200, height: 200, top: 120, left: -90, backgroundColor: '#7FD8EA', opacity: 0.35 }]} />
        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      </View>

      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Circ n="back" label="Back" onPress={() => router.back()} />
          <Text style={st.headTitle}>Boost this job</Text>
          <View style={st.stepPill}><Text style={st.stepText}>Step {step} of 3</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>{[1, 2, 3].map((n) => <StepBar key={n} on={n <= Number(step)} />)}</View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ins.bottom + 130 }}>
        {/* glass hero: plan art + live price */}
        <Animated.View entering={FadeInDown.duration(420)} style={[st.heroWrap, liftShadow]}>
          <View style={st.heroClip}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} style={st.heroSheen} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={st.kicker}><Bolt size={13} /><Text style={st.kickerText}>BOOST BUDGET</Text></View>
              <CountUp to={o.price} dec={2} pre="$" style={st.price} />
              <Text style={st.priceSub}><Text style={{ fontFamily: f.hb, color: AP.navy }}>{o.name}</Text> · {o.days} days</Text>
              <View style={st.proChip}><Text style={st.proChipText}>Pro members pay ${o.pro.toFixed(2)}</Text></View>
            </View>
            <View style={st.art}>
              <Orbit delay={0} color={AP.amber} />
              <Orbit delay={1200} color={AP.cyan} />
              <Orbit delay={2400} color={AP.amber} />
              <BoostPlanImage index={i} width={120} height={130} />
            </View>
          </View>
          <View pointerEvents="none" style={st.heroRim} />
        </Animated.View>

        <Text style={st.section}>Choose a plan</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {OPTS.map((x, n) => <PlanRow key={x.id} o={x} i={n} on={n === i} onPress={() => pick(n)} />)}
        </View>
      </ScrollView>

      {/* frosted action bar */}
      <View style={[st.bar, { paddingBottom: ins.bottom + 12 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.72)' }]} />
        <View style={st.barRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.barName}>{o.name} · {o.days} days</Text>
            <Text style={st.barPrice}>${o.price.toFixed(2)}</Text>
          </View>
          <PressableScaleNew onPress={() => { if (job) go(R.boost(job, Math.min(3, Number(step) + 1), o.id)); }} scaleTo={0.97} accessibilityLabel={`Continue, $${o.price.toFixed(2)}`} style={[st.cta, liftShadow]}>
            <LinearGradient colors={NAVY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
            <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
            <Text style={st.ctaText}>Continue</Text>
            <Arrow />
          </PressableScaleNew>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 420, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  headTitle: { flex: 1, fontFamily: f.h, fontSize: 17, color: AP.navy },
  stepPill: { paddingHorizontal: 10, height: 28, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: 'rgba(20,50,74,0.08)' },
  stepText: { fontFamily: f.hb, fontSize: 12, color: AP.navy },
  stepTrack: { flex: 1, height: 4, borderRadius: 3, backgroundColor: 'rgba(20,50,74,0.1)', overflow: 'hidden', flexDirection: 'row' },

  heroWrap: { marginHorizontal: 16, marginTop: 18, borderRadius: 26 },
  heroClip: { borderRadius: 26, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 18, gap: 8 },
  heroSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 60 },
  heroRim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.95)' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kickerText: { fontFamily: f.h, fontSize: 11, letterSpacing: 1.3, color: AP.amberDeep },
  price: { fontFamily: f.h, fontSize: 44, lineHeight: 52, letterSpacing: -1, color: AP.navy },
  priceSub: { fontFamily: f.m, fontSize: 14, color: AP.muted },
  proChip: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#FBE3B5' },
  proChipText: { fontFamily: f.hb, fontSize: 12, color: AP.amberDeep },
  art: { width: 130, height: 140, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5 },

  section: { fontFamily: f.h, fontSize: 19, color: AP.navy, paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  row: { borderRadius: 20, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: AP.line },
  rowOn: { borderWidth: 1.5, borderColor: AP.amber },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: AP.bg, borderWidth: 1, borderColor: AP.line },
  rowName: { fontFamily: f.h, fontSize: 16, color: AP.navy },
  recTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: AP.navy },
  recTagText: { fontFamily: f.hb, fontSize: 10.5, color: '#fff' },
  rowMeta: { fontFamily: f.m, fontSize: 13, color: AP.muted },
  rowPrice: { fontFamily: f.h, fontSize: 17, color: AP.navy },
  rowPro: { fontFamily: f.m, fontSize: 11.5, color: AP.faint },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#C9D6DB', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: AP.amber, borderColor: AP.amber },
  perks: { marginTop: 12, gap: 10 },
  perkDivider: { height: 1, backgroundColor: '#F6E3C2', marginBottom: 2 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkTick: { width: 22, height: 22, borderRadius: 8, backgroundColor: AP.tint, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, fontFamily: f.m, fontSize: 14, lineHeight: 19, color: AP.ink },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(20,50,74,0.12)', overflow: 'hidden' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  barName: { fontFamily: f.m, fontSize: 13, color: AP.muted },
  barPrice: { fontFamily: f.h, fontSize: 22, color: AP.navy },
  cta: { height: 54, paddingHorizontal: 26, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: f.h, fontSize: 16, color: '#fff' },
});

export default function NewBoost() {
  console.log('NEW Boost mounted');
  return <Boundary><Screen /></Boundary>;
}
