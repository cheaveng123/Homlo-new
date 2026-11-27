// Account plans page, inspired by the approved pricing reference, in Homlo's
// fonts and tokens: centered header with a "Plans" pill, three highlights,
// a segmented plan switcher, and a swipeable card per plan (emblem, price,
// limits, features, dark pill CTA). The page's lower half takes a soft tint of
// the selected plan's color. Same props as PlnQzxPlansView: presentational only.
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle,
  useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import LinearGradient from '@/lib/native/linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { BackGlyph } from '@/components/vista/category/glyphs';
import type { PlnQzxPlansViewProps } from '@/components/plnQzx/plnQzx_PlansView';
import type { PlnQzxPlan } from '@/components/plnQzx/plnQzx_types';
import { PlanEmblem } from './PlanEmblems';

const LINE = '#E3E9EC';
const GAP = 12;
const MAX_FEATURES = 6;

/** Accent + background tint per plan, in plan order (Free, Pro, Enterprise). */
const ACCENTS = [
  { ink: palette.amberDeep, soft: '#FFE3B8', wash: '#FFF4E2' },
  { ink: palette.cyan, soft: '#BFE8F2', wash: '#E8F7FB' },
  { ink: palette.navy, soft: '#CCD8E4', wash: '#EDF2F6' },
] as const;
const accentFor = (id: string, i: number) => ACCENTS[id === 'free' ? 0 : id === 'pro' ? 1 : id === 'enterprise' ? 2 : i % 3];

const enter = (i: number) =>
  FadeInDown.delay(i * 70).duration(durations.enter).easing(SMOOTH).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- glyphs ---------- */
const stroke = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ApplicantsGlyph = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" stroke={palette.navy} {...stroke}>
    <Rect x={4} y={3.5} width={16} height={17} rx={3} fill={palette.cyanTint} stroke={palette.navy} />
    <Circle cx={12} cy={10} r={2.6} />
    <Path d="M7.5 17c.8-2.2 2.5-3.2 4.5-3.2s3.7 1 4.5 3.2" />
  </Svg>
);
const MessageGlyph = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" stroke={palette.navy} {...stroke}>
    <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5Z" fill={palette.cyanTint} />
    <Path d="M8.5 9h7M8.5 12h4.5" />
  </Svg>
);
const ChartGlyph = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" stroke={palette.navy} {...stroke}>
    <Rect x={4} y={4} width={16} height={16} rx={3.5} fill={palette.cyanTint} />
    <Path d="M8 15.5v-3M12 15.5v-7M16 15.5v-5" />
    <Circle cx={16} cy={8} r={1.2} fill={palette.amber} stroke={palette.amber} />
  </Svg>
);
const CheckDisc = ({ on = true }: { on?: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 20 20">
    <Circle cx={10} cy={10} r={9} fill={on ? palette.navy : '#C9D3D8'} />
    <Path d="m6.2 10.2 2.5 2.4 5-5.2" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const Diamond = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 14 14"><Path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" fill={color} /></Svg>
);

/* ---------- segmented switch ---------- */
function Segments({ plans, index, onPick }: { plans: PlnQzxPlan[]; index: number; onPick: (i: number) => void }) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const seg = w ? (w - 8) / plans.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(reduce ? index * seg : withTiming(index * seg, { duration: 260, easing: SMOOTH }));
  }, [index, seg, reduce, x]);
  const pill = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value }] }));
  return (
    <View style={s.segWrap} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg ? <Animated.View style={[s.segPill, pill]} /> : null}
      {plans.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => onPick(i)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          style={s.segBtn}
        >
          <Text style={[s.segText, i === index && s.segTextOn]}>{p.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- plan card ---------- */
function PlanCard({
  plan, index, width, snap, scrollX, selected, current, tag, fmt, copy, onPrimary, onFocus,
}: {
  plan: PlnQzxPlan; index: number; width: number; snap: number; scrollX: SharedValue<number>;
  selected: boolean; current: boolean; tag?: string; fmt: (n: number) => string;
  copy: PlnQzxPlansViewProps['copy']; onPrimary: () => void; onFocus: () => void;
}) {
  const reduce = useReducedMotion();
  const accent = accentFor(plan.id, index);
  const focus = useAnimatedStyle(() => {
    if (reduce) return {};
    const d = Math.abs(scrollX.value / snap - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.55], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  // The limits panel already shows jobs and posts, so skip those lines in the list.
  const listed = plan.features.filter((f) => !/active\s+jobs?|posts?\s*\/\s*month/i.test(f.label));
  const shown = listed.slice(0, MAX_FEATURES);
  const more = listed.length - shown.length;
  const price = plan.priceLabel ?? fmt(plan.price);
  const jobs = plan.activeJobsLabel ?? String(plan.activeJobs);
  const posts = plan.postsPerMonthLabel ?? String(plan.postsPerMonth);
  const cta = current ? copy.ctaCurrent : copy.ctaChange(plan.name);

  return (
    <Animated.View style={[{ width }, focus]}>
      <Pressable onPress={selected ? undefined : onFocus} accessible={!selected} accessibilityLabel={selected ? undefined : `Show ${plan.name} plan`} style={s.card}>
        <LinearGradient pointerEvents="none" colors={[accent.wash, 'rgba(255,255,255,0)']} locations={[0, 0.45]} style={StyleSheet.absoluteFill} />
        {tag ? (
          <View style={[s.tag, { borderColor: accent.soft }]}>
            <Text style={[s.tagText, { color: index === 0 ? palette.amberInk : index === 1 ? palette.cyanDeep : palette.navy }]}>{tag}</Text>
          </View>
        ) : null}
        <View style={s.emblem}><PlanEmblem id={plan.id} index={index} /></View>
        <Text style={s.name}>{plan.name}</Text>
        <Text style={s.price}>
          {price}
          <Text style={s.per}> {copy.perMonth}</Text>
        </Text>
        <Text style={s.tagline}>{plan.tagline}</Text>

        <View style={s.divider}>
          <LinearGradient colors={['rgba(255,255,255,0)', accent.soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.divLine} />
          <Diamond color={accent.ink} />
          <LinearGradient colors={[accent.soft, 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.divLine} />
        </View>

        <View style={s.limits}>
          <View style={s.limit}>
            <Text style={s.limitNum}>{jobs}</Text>
            <Text style={s.limitLabel}>{copy.activeJobs}</Text>
          </View>
          <View style={s.limitSep} />
          <View style={s.limit}>
            <Text style={s.limitNum}>{posts}</Text>
            <Text style={s.limitLabel}>{copy.postsPerMonth}</Text>
          </View>
        </View>

        <View style={s.features}>
          {shown.map((f) => (
            <View key={f.label} style={s.feature}>
              <CheckDisc on={f.included} />
              <Text style={[s.featureText, !f.included && s.featureOff]} numberOfLines={1}>{f.label}</Text>
            </View>
          ))}
          {more > 0 ? <Text style={s.more}>+{more} more included</Text> : null}
        </View>

        <View style={{ flex: 1 }} />
        {/* PressableScale styles its inner view, so the stretch lives on this wrapper. */}
        <View style={{ alignSelf: 'stretch' }}>
        <PressableScale
          scale={0.97}
          disabled={current}
          onPress={() => {
            haptic.selection();
            if (selected) onPrimary();
            else onFocus();
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: current }}
          accessibilityLabel={cta}
          style={[s.cta, current && s.ctaCurrent]}
        >
          {!current ? <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} style={s.ctaSheen} /> : null}
          <Text style={[s.ctaText, current && s.ctaTextCurrent]}>{cta}</Text>
        </PressableScale>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- page ---------- */
export function PlansShowcaseView(p: PlnQzxPlansViewProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width: W } = useWindowDimensions();
  const cardW = Math.min(360, W - 56);
  const snap = cardW + GAP;
  const side = (W - cardW) / 2;
  const listRef = useRef<FlatList<PlnQzxPlan>>(null);

  const index = Math.max(0, p.plans.findIndex((x) => x.id === p.selectedPlanId));
  const scrollX = useSharedValue(index * snap);
  const onScroll = useAnimatedScrollHandler((e) => { scrollX.set(e.contentOffset.x); });

  // Keep the carousel on the selected plan when it changes from outside (account load, "required" plan).
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * snap, animated: !reduce });
  }, [index, snap, reduce]);

  const pick = (i: number) => {
    const plan = p.plans[i];
    if (!plan || plan.id === p.selectedPlanId) return;
    haptic.selection();
    p.onSelectPlan(plan.id);
  };

  // Background tint follows the selected plan.
  const tint = useSharedValue(index);
  useEffect(() => {
    tint.set(reduce ? index : withTiming(index, { duration: 360, easing: SMOOTH }));
  }, [index, reduce, tint]);

  return (
    <View style={s.page}>
      {p.plans.map((plan, i) => (
        <TintLayer key={plan.id} i={i} tint={tint} color={accentFor(plan.id, i).soft} />
      ))}

      <Animated.ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable onPress={p.onBack} accessibilityRole="button" accessibilityLabel={p.copy.backLabel} style={({ pressed }) => [s.back, pressed && { opacity: 0.7 }]}>
            <BackGlyph size={22} color={palette.navy} />
          </Pressable>
        </View>

        {p.notice ? <View style={s.gutter}>{p.notice}</View> : null}

        <Animated.View entering={reduce ? undefined : enter(0)} style={s.head}>
          <View style={s.kicker}><Text style={s.kickerText}>Plans</Text></View>
          <Text style={s.title} accessibilityRole="header">{p.copy.title}</Text>
          <Text style={s.subtitle}>{p.copy.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={reduce ? undefined : enter(1)} style={s.highlights}>
          {[
            { icon: <ApplicantsGlyph />, label: 'Applicants' },
            { icon: <MessageGlyph />, label: 'Messaging' },
            { icon: <ChartGlyph />, label: 'Analytics' },
          ].map((h, i) => (
            <React.Fragment key={h.label}>
              {i > 0 ? <View style={s.hlSep} /> : null}
              <View style={s.hl}>
                {h.icon}
                <Text style={s.hlText}>{h.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        <Animated.View entering={reduce ? undefined : enter(2)} style={s.gutter}>
          <Segments plans={p.plans} index={index} onPick={(i) => { pick(i); }} />
        </Animated.View>

        <Animated.View entering={reduce ? undefined : enter(3)}>
          <Animated.FlatList
            ref={listRef as never}
            data={p.plans}
            keyExtractor={(x) => x.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snap}
            decelerationRate="fast"
            disableIntervalMomentum
            contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingTop: 16, paddingBottom: 8 }}
            getItemLayout={(_, i) => ({ length: snap, offset: snap * i, index: i })}
            initialScrollIndex={index}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => pick(Math.round(e.nativeEvent.contentOffset.x / snap))}
            renderItem={({ item, index: i }) => {
              const tag = item.id === p.requiredPlanId ? p.requiredTag
                : item.id === p.currentPlanId ? p.copy.currentTag
                : item.popular ? p.copy.popularTag : undefined;
              return (
                <PlanCard
                  plan={item}
                  index={i}
                  width={cardW}
                  snap={snap}
                  scrollX={scrollX}
                  selected={item.id === p.selectedPlanId}
                  current={item.id === p.currentPlanId}
                  tag={tag}
                  fmt={p.formatPrice}
                  copy={p.copy}
                  onPrimary={p.onPrimary}
                  onFocus={() => pick(i)}
                />
              );
            }}
          />
        </Animated.View>

        <Text style={s.note}>{p.copy.note}</Text>
      </Animated.ScrollView>
      {/* Keeps scrolled content from showing under the status bar / Dynamic Island. */}
      <LinearGradient
        pointerEvents="none"
        colors={[palette.surface, 'rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']}
        locations={[0, 0.7, 1]}
        style={[s.statusFade, { height: insets.top + 16 }]}
      />
    </View>
  );
}

function TintLayer({ i, tint, color }: { i: number; tint: SharedValue<number>; color: string }) {
  const st = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(tint.value - i), [0, 1], [1, 0], Extrapolation.CLAMP) }));
  return (
    <Animated.View pointerEvents="none" style={[s.tint, st]}>
      <LinearGradient colors={['rgba(255,255,255,0)', color]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.surface },
  tint: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  statusFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  gutter: { paddingHorizontal: 16 },
  top: { paddingHorizontal: 16, marginBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', paddingHorizontal: 24 },
  kicker: { height: 28, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, justifyContent: 'center' },
  kickerText: { fontFamily: F.s, fontSize: 12.5, color: palette.ink },
  title: { marginTop: 12, fontFamily: F.h, fontSize: 28, lineHeight: 33, letterSpacing: -0.45, color: palette.navy, textAlign: 'center' },
  subtitle: { marginTop: 8, fontFamily: F.b, fontSize: 14, lineHeight: 20, color: palette.muted, textAlign: 'center', maxWidth: 320 },
  highlights: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  hl: { width: 96, alignItems: 'center', gap: 6 },
  hlText: { fontFamily: F.m, fontSize: 12.5, color: palette.ink },
  hlSep: { width: 1, height: 36, backgroundColor: LINE },
  segWrap: { flexDirection: 'row', backgroundColor: palette.page, borderRadius: 16, padding: 4 },
  segPill: {
    position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: palette.surface,
    shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  segBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: F.s, fontSize: 13.5, color: palette.muted },
  segTextOn: { color: palette.navy },
  card: {
    minHeight: 560, borderRadius: 28, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: '#EDF1F3',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, alignItems: 'center', overflow: 'hidden',
  },
  tag: { position: 'absolute', top: 14, right: 14, height: 26, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, backgroundColor: palette.surface, justifyContent: 'center' },
  tagText: { fontFamily: F.hb, fontSize: 11.5 },
  emblem: { marginTop: 10 },
  name: { marginTop: 12, fontFamily: F.h, fontSize: 26, color: palette.navy },
  price: { marginTop: 4, fontFamily: F.h, fontSize: 22, color: palette.navy },
  per: { fontFamily: F.m, fontSize: 13, color: palette.muted },
  tagline: { marginTop: 6, fontFamily: F.b, fontSize: 14, color: palette.muted, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 16 },
  divLine: { flex: 1, height: 1.5 },
  limits: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 14, borderRadius: 14, backgroundColor: palette.page, paddingVertical: 10 },
  limit: { flex: 1, alignItems: 'center' },
  limitNum: { fontFamily: F.h, fontSize: 18, color: palette.navy },
  limitLabel: { fontFamily: F.m, fontSize: 11.5, color: palette.muted },
  limitSep: { width: 1, backgroundColor: LINE },
  features: { alignSelf: 'stretch', marginTop: 16, gap: 11 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { flex: 1, fontFamily: F.m, fontSize: 14, color: palette.ink },
  featureOff: { color: palette.muted },
  more: { marginLeft: 30, fontFamily: F.m, fontSize: 13, color: palette.muted },
  cta: { marginTop: 18, height: 52, borderRadius: 26, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ctaSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '60%' },
  ctaCurrent: { backgroundColor: palette.surface, borderWidth: 1.5, borderColor: LINE },
  ctaText: { fontFamily: F.h, fontSize: 15, color: '#FFFFFF' },
  ctaTextCurrent: { color: palette.muted },
  note: { marginTop: 14, paddingHorizontal: 28, fontFamily: F.b, fontSize: 12.5, lineHeight: 18, color: palette.muted, textAlign: 'center' },
});
