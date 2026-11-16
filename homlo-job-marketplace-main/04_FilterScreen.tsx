import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { C, F, ImageSlot } from './01_exploreShared';

const PERIODS = ['Hourly', 'Daily', 'Monthly'] as const;
const MAXPAY = [20, 100, 1000];
const TYPES: { k: string; I: IconName }[] = [{ k: 'Part-time', I: 'clock' }, { k: 'Full-time', I: 'brief' }, { k: 'Weekends', I: 'calendar' }, { k: 'Remote', I: 'laptop' }];
const CATS = ['Hospitality', 'Retail', 'Delivery', 'Tutoring', 'Construction', 'Office'];
const ARR = ['On-site', 'Hybrid', 'Any', 'Remote'];
const POSTED = ['Any time', '24 h', '3 days', '7 days'];
const THUMB = 28;

/** Touch-driven range slider (two thumbs, or one with `single`). Values are 0..1 fractions. */
function RangeSlider({ lo, hi, single, onChange }: { lo: number; hi: number; single?: boolean; onChange: (lo: number, hi: number) => void }) {
  const w = useSharedValue(1);
  const a = useSharedValue(single ? 0 : lo);
  const b = useSharedValue(hi);
  const sa = useSharedValue(0), sb = useSharedValue(0);
  const emit = (x: number, y: number) => onChange(x, y);

  const gLo = Gesture.Pan().onBegin(() => { sa.value = a.value; }).onUpdate((e) => {
    a.value = Math.max(0, Math.min(sa.value + e.translationX / w.value, b.value - 0.05));
    runOnJS(emit)(a.value, b.value);
  });
  const gHi = Gesture.Pan().onBegin(() => { sb.value = b.value; }).onUpdate((e) => {
    b.value = Math.min(1, Math.max(sb.value + e.translationX / w.value, single ? 0.02 : a.value + 0.05));
    runOnJS(emit)(a.value, b.value);
  });

  const fill = useAnimatedStyle(() => ({ left: a.value * w.value, width: (b.value - a.value) * w.value }));
  const tLo = useAnimatedStyle(() => ({ transform: [{ translateX: a.value * w.value - THUMB / 2 }] }));
  const tHi = useAnimatedStyle(() => ({ transform: [{ translateX: b.value * w.value - THUMB / 2 }] }));

  return (
    <View style={{ height: 36, justifyContent: 'center', marginTop: 14 }} onLayout={(e: LayoutChangeEvent) => { w.value = e.nativeEvent.layout.width; }}>
      <View style={st.track} />
      <Animated.View style={[st.fill, fill]} />
      {!single && <GestureDetector gesture={gLo}><Animated.View style={[st.thumb, tLo]} hitSlop={10} /></GestureDetector>}
      <GestureDetector gesture={gHi}><Animated.View style={[st.thumb, tHi]} hitSlop={10} /></GestureDetector>
    </View>
  );
}

function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.chip, on && st.chipOn, pressed && { transform: [{ scale: 0.95 }] }]}>{children}</Pressable>
  );
}
function Seg({ items, value, onChange }: { items: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <View style={st.seg}>
      {items.map((t, i) => (
        <Pressable key={t} onPress={() => onChange(i)} style={[st.segI, value === i && { backgroundColor: C.mint }]}>
          <Text style={{ fontFamily: F.b600, fontSize: 13, color: value === i ? '#fff' : C.muted }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export type Filters = { types: string[]; cats: string[]; period: string; pay: [number, number]; km: number; arrangement: string; posted: string; urgent: boolean; verified: boolean };

export default function FilterScreen({ resultCount, onApply }: { resultCount?: number; onApply?: (f: Filters) => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [types, setTypes] = useState<string[]>(['Part-time', 'Weekends']);
  const [cats, setCats] = useState<string[]>(['Tutoring']);
  const [per, setPer] = useState(0);
  const [pay, setPay] = useState<[number, number]>([0.15, 0.7]);
  const [km, setKm] = useState(10);
  const [arr, setArr] = useState(2);
  const [posted, setPosted] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const [verified, setVerified] = useState(true);
  const [sliderKey, setSliderKey] = useState(0); // remount sliders on reset

  const tog = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const price = (f: number) => `$${Math.round(f * MAXPAY[per])}`;
  const reset = () => { setTypes([]); setCats([]); setPay([0, 1]); setKm(30); setArr(2); setPosted(0); setUrgent(false); setVerified(false); setSliderKey((k) => k + 1); };
  const apply = () => {
    onApply?.({ types, cats, period: PERIODS[per], pay: [Math.round(pay[0] * MAXPAY[per]), Math.round(pay[1] * MAXPAY[per])], km, arrangement: ARR[arr], posted: POSTED[posted], urgent, verified });
    router.back();
  };
  const sec = (i: number) => FadeInDown.delay(80 + i * 60).duration(500);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} style={st.back}><AppIcon name="back" size={22} color={C.text} /></Pressable>
        <Text style={{ fontFamily: F.h800, fontSize: 20, color: C.text }}>Filters</Text>
        <Pressable onPress={reset} style={st.reset}><Text style={{ fontFamily: F.b600, fontSize: 13, color: C.mint }}>Reset</Text></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
        <Animated.View entering={sec(0)} style={st.sec}>
          <Text style={st.h3}>Job type</Text>
          <View style={st.chips}>
            {TYPES.map(({ k, I }) => { const on = types.includes(k); return (
              <Chip key={k} on={on} onPress={() => tog(types, setTypes, k)}><AppIcon name={I} size={17} color={on ? '#7EE2AE' : C.mint} /><Text style={[st.chipT, on && { color: '#fff' }]}>{k}</Text></Chip>
            ); })}
          </View>
        </Animated.View>

        <Animated.View entering={sec(1)} style={st.sec}>
          <View style={st.hrow}>
            <Text style={st.h3}>Pay range</Text>
            <Pressable onPress={() => setPer((per + 1) % 3)} style={st.per}><Text style={{ fontFamily: F.b600, fontSize: 13, color: C.mint }}>{PERIODS[per]} ▾</Text></Pressable>
          </View>
          <View style={st.card}>
            <Text style={{ fontFamily: F.h800, fontSize: 28, color: C.forest }}>{price(pay[0])} – {price(pay[1])}</Text>
            <RangeSlider key={'p' + sliderKey} lo={pay[0]} hi={pay[1]} onChange={(l, h) => setPay([l, h])} />
          </View>
        </Animated.View>

        <Animated.View entering={sec(2)} style={st.sec}>
          <View style={st.hrow}><Text style={st.h3}>Distance</Text><Text style={{ fontFamily: F.b600, fontSize: 13, color: C.mint }}>{km} km</Text></View>
          <View style={st.card}>
            <RangeSlider key={'d' + sliderKey} single lo={0} hi={(km - 1) / 29} onChange={(_l, h) => setKm(Math.round(1 + h * 29))} />
          </View>
        </Animated.View>

        <Animated.View entering={sec(3)} style={st.sec}><Text style={st.h3}>Work arrangement</Text><Seg items={ARR} value={arr} onChange={setArr} /></Animated.View>

        <Animated.View entering={sec(4)} style={st.sec}>
          <Text style={st.h3}>Category</Text>
          <View style={st.chips}>
            {CATS.map((c) => { const on = cats.includes(c); return (
              <Chip key={c} on={on} onPress={() => tog(cats, setCats, c)}>
                <ImageSlot label="" radius={7} style={{ width: 20, height: 20 }} />{/* category icon, ~60px export */}
                <Text style={[st.chipT, on && { color: '#fff' }]}>{c}</Text>
              </Chip>
            ); })}
            <Chip on={false} onPress={() => {}}><AppIcon name="plus" size={17} color={C.mint} /><Text style={st.chipT}>More</Text></Chip>
          </View>
        </Animated.View>

        <Animated.View entering={sec(5)} style={st.sec}><Text style={st.h3}>Posted</Text><Seg items={POSTED} value={posted} onChange={setPosted} /></Animated.View>

        <Animated.View entering={sec(6)} style={[st.card, { marginTop: 24 }]}>
          <View style={st.sw}><View style={{ flex: 1 }}><Text style={st.swT}>Urgent hiring only</Text><Text style={st.swS}>Roles that need someone now</Text></View>
            <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: C.mint, false: '#D5DDD8' }} thumbColor="#fff" /></View>
          <View style={[st.sw, { marginTop: 8 }]}><View style={{ flex: 1 }}><Text style={st.swT}>Verified employers</Text><Text style={st.swS}>Checked by Homlo</Text></View>
            <Switch value={verified} onValueChange={setVerified} trackColor={{ true: C.mint, false: '#D5DDD8' }} thumbColor="#fff" /></View>
        </Animated.View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Pressable onPress={apply} style={({ pressed }) => [st.btn, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={{ fontFamily: F.h700, fontSize: 16, color: '#fff' }}>{resultCount != null ? `Show ${resultCount} jobs` : 'Show jobs'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  reset: { backgroundColor: C.mint50, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  sec: { marginTop: 24 }, h3: { fontFamily: F.h700, fontSize: 16, color: C.text, marginBottom: 12 },
  hrow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.line },
  chipOn: { backgroundColor: C.forest, borderColor: C.forest }, chipT: { fontFamily: F.b500, fontSize: 14, color: C.text },
  card: { backgroundColor: C.bg, borderRadius: 28, padding: 18 },
  per: { backgroundColor: C.mint50, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12 },
  track: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 9, backgroundColor: C.mint100 },
  fill: { position: 'absolute', height: 6, borderRadius: 9, backgroundColor: C.mint },
  thumb: { position: 'absolute', left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff', borderWidth: 7, borderColor: C.mint, shadowColor: '#173C25', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  seg: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 999, padding: 5 },
  segI: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },
  sw: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  swT: { fontFamily: F.b500, fontSize: 14, color: C.text }, swS: { fontFamily: F.b400, fontSize: 12, color: C.muted, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 24, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.96)' },
  btn: { height: 58, borderRadius: 999, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' },
});
