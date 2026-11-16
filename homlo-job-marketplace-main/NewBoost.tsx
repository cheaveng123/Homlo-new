// Boost plan screen, bound to the real pricing data (lib/boostData.ts).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withDelay, withSequence, Easing, useReducedMotion } from 'react-native-reanimated';
import { c, f, sh } from './NewTheme';
import { Icon, Circ, Btn, CountUp, Boundary } from './NewUI';
import { R, go } from './NewRoutes';
import { BoostPlanImage } from '@/components/BoostPlanImage';
import { BOOST_PLANS, RECOMMENDED_INDEX } from '@/lib/boostData';

type Opt = { id: string; v: number; name: string; days: number; boosts: number; price: number; pro: number; rec?: boolean; perks: string[] };
// Real pricing: 6 plans, Pro prices, features, a "recommended" index. Nothing
// about plan counts or prices is hard-coded below.
const OPTS: Opt[] = BOOST_PLANS.map((p, i) => ({
  id: p.id,
  v: p.days,
  name: p.name,
  days: p.days,
  boosts: 1,
  price: p.price,
  pro: p.proPrice,
  rec: i === RECOMMENDED_INDEX,
  perks: p.features,
}));
const SW = 72;

function Ring({ d }: { d: number }) {
  const p = useSharedValue(0); const rm = useReducedMotion();
  useEffect(() => { if (!rm) p.value = withDelay(d, withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }), -1)) }, []);
  const a = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - p.value), transform: [{ scale: 0.45 + p.value * 1.05 }] }));
  return <Animated.View style={[{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: c.teal }, a]} />;
}
function StepBar({ on }: { on: boolean }) {
  const w = useSharedValue(0); useEffect(() => { w.value = withTiming(on ? 1 : 0, { duration: 450 }) }, [on]);
  const a = useAnimatedStyle(() => ({ flex: w.value }));
  return <View style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden', flexDirection: 'row' }}><Animated.View style={[{ backgroundColor: c.teal }, a]} /></View>;
}
function Ladder({ idx, set }: { idx: number; set: (i: number) => void }) {
  const x = useSharedValue(idx * SW); const sx = useSharedValue(1);
  useEffect(() => { x.value = withSpring(idx * SW, { damping: 16, stiffness: 180 }); sx.value = withSequence(withTiming(1.5, { duration: 110 }), withSpring(1, { damping: 10 })) }, [idx]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: sx.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value }));
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ width: OPTS.length * SW, height: 96 }}>
    <View style={{ position: 'absolute', left: SW / 2, width: (OPTS.length - 1) * SW, top: 50, height: 3, borderRadius: 3, backgroundColor: c.track }} />
    <Animated.View style={[{ position: 'absolute', left: SW / 2, top: 50, height: 3, borderRadius: 3, backgroundColor: c.teal }, fill]} />
    {OPTS.map((o, i) => <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: i === idx }} onPress={() => set(i)} style={{ position: 'absolute', left: i * SW, width: SW, height: 96, alignItems: 'center' }}>
      <Text style={{ marginTop: 6, fontFamily: i === idx ? f.h : f.s, fontSize: 14, color: i === idx ? c.deep : c.mu }}>{o.v}</Text>
      <View style={{ marginTop: 36, width: 10, height: 10, borderRadius: 5, backgroundColor: i <= idx ? c.teal : c.tint2 }} />
      {o.rec && <Text style={{ position: 'absolute', top: 76, fontFamily: f.s, fontSize: 12, color: c.clay }}>Recommended</Text>}</Pressable>)}
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: SW / 2 - 18, top: 34, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 3, borderColor: c.teal, alignItems: 'center', justifyContent: 'center' }, sh, thumb]}>
      <Icon n="chk" s={18} color={c.teal} /></Animated.View>
  </View></ScrollView>;
}
function Card({ o, w }: { o: Opt; w: number }) {
  return <View style={[{ width: w, borderRadius: 24, backgroundColor: c.cream, borderWidth: 1, borderColor: c.cream2, overflow: 'hidden' }, sh]}>
    {o.rec && <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: c.deep, paddingVertical: 6, paddingHorizontal: 14, borderBottomLeftRadius: 16 }}><Text style={{ fontFamily: f.s, fontSize: 12, color: '#fff' }}>Recommended</Text></View>}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingBottom: 16 }}>
      <View><Text style={{ fontFamily: f.h, fontSize: 20, color: c.deep }}>{o.name}</Text><Text style={{ fontFamily: f.b, fontSize: 13, color: c.ink }}>{o.days} days · {o.boosts} boost{o.boosts > 1 ? 's' : ''}</Text></View>
      <View style={{ alignItems: 'flex-end', marginTop: 20 }}><Text style={{ fontFamily: f.h, fontSize: 24, color: c.clay }}>${o.price.toFixed(2)}</Text><Text style={{ fontFamily: f.b, fontSize: 12, color: c.ink }}>Pro ${o.pro.toFixed(2)}</Text></View></View>
    <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: c.cream2, marginHorizontal: 20 }} />
    <View style={{ padding: 20, gap: 12 }}>{o.perks.map(p => <View key={p} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon n="chk" s={20} color={c.teal} /><Text style={{ flex: 1, fontFamily: f.b, fontSize: 14, color: c.tx }}>{p}</Text></View>)}</View></View>;
}
function Screen() {
  const { jobId = '', id = '', step = '1' } = useLocalSearchParams<{ jobId?: string; id?: string; step?: string }>(); const ins = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const job = jobId || id;
  const CW = width - 72, GAP = 12; const [i, setI] = useState(Math.max(0, OPTS.findIndex(o => o.rec))); const o = OPTS[i];
  const list = useRef<FlatList<Opt>>(null); const fromScroll = useRef(false);
  useEffect(() => { if (fromScroll.current) { fromScroll.current = false; return } list.current?.scrollToOffset({ offset: i * (CW + GAP), animated: true }) }, [i]);
  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 340, backgroundColor: c.tint }} />
    <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Circ n="back" label="Back" onPress={() => router.back()} />
      <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>{[1, 2, 3].map(n => <StepBar key={n} on={n <= Number(step)} />)}</View>
      <Text style={{ fontFamily: f.m, fontSize: 13, color: c.mu }}>{step}/3</Text></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: f.m, fontSize: 13, color: c.mu }}>Boost budget</Text>
          <CountUp to={o.price} dec={2} pre="$" style={{ fontFamily: f.h, fontSize: 48, lineHeight: 56, color: c.deep }} />
          <Text style={{ fontFamily: f.b, fontSize: 14, color: c.mu }}><Text style={{ fontFamily: f.s, color: c.deep }}>{o.name}</Text> · {o.days} days · Pro ${o.pro.toFixed(2)}</Text></View>
        <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}><Ring d={0} /><Ring d={1050} /><Ring d={2100} />
          <BoostPlanImage index={i} width={140} height={150} /></View></Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(420)} style={[{ margin: 16, padding: 12, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line }, sh]}><Ladder idx={i} set={setI} /></Animated.View>
      <FlatList ref={list} horizontal data={OPTS} keyExtractor={x => x.id} showsHorizontalScrollIndicator={false} snapToInterval={CW + GAP} decelerationRate="fast"
        contentOffset={{ x: i * (CW + GAP), y: 0 }} contentContainerStyle={{ paddingHorizontal: 36, gap: GAP }}
        onMomentumScrollEnd={e => { const n = Math.round(e.nativeEvent.contentOffset.x / (CW + GAP)); if (n !== i && n >= 0 && n < OPTS.length) { fromScroll.current = true; setI(n) } }}
        renderItem={({ item, index }) => <View style={{ opacity: index === i ? 1 : 0.6 }}><Card o={item} w={CW} /></View>} />
    </ScrollView>
    <View style={{ padding: 16, paddingBottom: ins.bottom + 16 }}>
      <Btn shim t={`Continue · $${o.price.toFixed(2)}`} onPress={() => { if (job) go(R.boost(job, Math.min(3, Number(step) + 1), o.id)); }} /></View></View>;
}
export default function NewBoost() {
  console.log('NEW Boost mounted');
  return <Boundary><Screen /></Boundary>;
}