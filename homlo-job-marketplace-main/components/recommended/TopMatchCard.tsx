// Top match "spotlight" card for the Recommended page.
//   photo strip (the job's real image) with a "Top match" label and save
//   → white match ring overlapping the photo edge, title + company · area
//   → a row of real facts (pay, job type, spots left)
//   → "why it fits" chips → one full-width Quick apply.
// Motion: the ring fills to its value once (~1s, SMOOTH); the photo settles
// from 1.04 to 1. Reduced motion shows the end state. Tap the card to open the job.
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { BookmarkGlyph, BriefcaseGlyph, CheckGlyph, ClockGlyph } from '@/components/vista/category/glyphs';
import { PersonIcon } from '@/components/jobs-v2/jobtype/glyphs';
import { Placeholder } from '@/components/jobs-v2/jobtype/EmployerCard';

const LINE = '#E3E9EC';
const PHOTO_H = 116;
const RING = 60;
const STROKE = 5;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const Bolt = ({ size = 13, color = palette.amber }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.6} strokeLinejoin="round">
    <Path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />
  </Svg>
);

const Chevron = ({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);

/** White disc with a cyan ring that fills to `value` once. */
function MatchRing({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const r = (RING - STROKE) / 2 - 3;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(reduce ? value / 100 : 0);
  useEffect(() => {
    p.set(reduce ? value / 100 : withTiming(value / 100, { duration: durations.fill, easing: SMOOTH }));
  }, [value, reduce, p]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={m.ring} accessibilityLabel={`${value}% match`}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="#E3EEF1" strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={RING / 2} cy={RING / 2} r={r} stroke={palette.cyan} strokeWidth={STROKE} fill="none" strokeLinecap="round"
          strokeDasharray={[c, c]} animatedProps={arc} transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={m.ringNum}>{value}<Text style={m.ringPct}>%</Text></Text>
    </View>
  );
}

function Fact({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <View style={m.fact}>
      {icon}
      <View style={{ flexShrink: 1 }}>
        <Text style={m.factLabel} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={m.factSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

type Props = {
  title: string;
  company: string;
  place: string;
  pay: string; // "$100 / day", "$300"
  type: string; // "Part-time" | "Full-time"
  image?: string;
  spotsLeft?: number;
  spotsTotal?: number;
  match: number;
  skills: string[];
  saved: boolean;
  onOpen: () => void;
  onApply: () => void;
  onToggleSave: () => void;
};

export function TopMatchCard({
  title, company, place, pay, type, image, spotsLeft, spotsTotal, match, skills, saved, onOpen, onApply, onToggleSave,
}: Props) {
  const reduce = useReducedMotion();
  const settle = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) settle.set(withTiming(1, { duration: durations.enter + 200, easing: SMOOTH }));
  }, [reduce, settle]);
  const photo = useAnimatedStyle(() => ({ transform: [{ scale: 1.04 - 0.04 * settle.value }] }));

  const [amount, unitWord] = pay.split('/').map((x) => x.trim());
  const unit = !unitWord ? 'mo' : unitWord === 'hour' ? 'hr' : unitWord;
  const part = /part/i.test(type);
  const spots = typeof spotsLeft === 'number' && spotsTotal ? `${spotsLeft} of ${spotsTotal}` : undefined;

  return (
    // Shadow on the wrapper: the card itself clips the photo to its corners.
    <View style={m.shadow}>
    <PressableScale scale={0.985} onPress={() => { haptic.selection(); onOpen(); }} accessibilityRole="button" accessibilityLabel={`Top match: ${title} at ${company}`} style={m.card}>
      {/* photo strip */}
      <View style={m.photoWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, photo]}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          ) : (
            <Placeholder label="Photo" style={StyleSheet.absoluteFill} />
          )}
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={['rgba(18,48,60,0.35)', 'rgba(18,48,60,0)', 'rgba(18,48,60,0.25)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={m.badge}>
          <Bolt />
          <Text style={m.badgeText}>Top match</Text>
        </View>
        <PressableScale
          scale={0.94}
          onPress={() => { haptic.selection(); onToggleSave(); }}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove top match from saved' : 'Save top match'}
          accessibilityState={{ selected: saved }}
          style={m.save}
        >
          <BookmarkGlyph size={20} color={saved ? palette.navy : palette.ink} filled={saved} />
        </PressableScale>
      </View>

      <View style={m.body}>
        {/* ring overlaps the photo edge */}
        <View style={m.headRow}>
          <View style={m.ringSlot}><MatchRing value={match} /></View>
          <View style={m.heading}>
            <Text style={m.title} numberOfLines={2}>{title}</Text>
            <Text style={m.meta} numberOfLines={1}>{company} · {place}</Text>
          </View>
        </View>

        {/* real facts from the job */}
        <View style={m.facts}>
          <View style={m.payBox}>
            <Text style={m.pay} numberOfLines={1}>{amount}<Text style={m.payUnit}> /{unit}</Text></Text>
            <Text style={m.factSub}>Pay</Text>
          </View>
          <View style={m.divider} />
          <Fact
            icon={part ? <ClockGlyph size={18} color={palette.cyanDeep} /> : <BriefcaseGlyph size={18} color={palette.navy} />}
            label={type}
            sub="Job type"
          />
          {spots ? (
            <>
              <View style={m.divider} />
              <Fact icon={<PersonIcon size={20} />} label={spots} sub="Spots left" />
            </>
          ) : null}
        </View>

        {/* why it fits */}
        <View style={m.why}>
          {skills.map((s) => (
            <View key={s} style={m.skill}>
              <CheckGlyph size={12} color={palette.cyanDeep} />
              <Text style={m.skillText}>{s}</Text>
            </View>
          ))}
        </View>

        <PressableScale scale={0.97} onPress={() => { haptic.selection(); onApply(); }} accessibilityRole="button" accessibilityLabel="Quick apply" style={m.apply}>
          <Bolt size={15} color={palette.amber} />
          <Text style={m.applyText}>Quick apply</Text>
          <View style={{ flex: 1 }} />
          <Chevron />
        </PressableScale>
      </View>
    </PressableScale>
    </View>
  );
}

const m = StyleSheet.create({
  shadow: {
    marginHorizontal: 16, marginTop: -30, borderRadius: 22, backgroundColor: palette.surface,
    shadowColor: '#06425A', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  card: { borderRadius: 22, backgroundColor: palette.surface, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  photoWrap: { height: PHOTO_H, overflow: 'hidden', backgroundColor: palette.placeholderA },
  badge: {
    position: 'absolute', top: 12, left: 12, height: 28, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  badgeText: { fontFamily: F.hb, fontSize: 12.5, color: palette.navy },
  save: {
    position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  headRow: { flexDirection: 'row', gap: 12 },
  ringSlot: { marginTop: -RING / 2, width: RING },
  ring: {
    width: RING, height: RING, borderRadius: RING / 2, backgroundColor: palette.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#06425A', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  ringNum: { fontFamily: F.h, fontSize: 16, color: palette.navy },
  ringPct: { fontFamily: F.hb, fontSize: 11, color: palette.muted },
  heading: { flex: 1, minWidth: 0, paddingTop: 10 },
  title: { fontFamily: F.h, fontSize: 17, lineHeight: 22, color: palette.navy },
  meta: { marginTop: 2, fontFamily: F.m, fontSize: 13, color: palette.muted },
  facts: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: palette.page, gap: 10,
  },
  payBox: { flexShrink: 1 },
  pay: { fontFamily: F.h, fontSize: 16, color: palette.navy },
  payUnit: { fontFamily: F.m, fontSize: 11.5, color: palette.muted },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: LINE },
  fact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  factLabel: { fontFamily: F.hb, fontSize: 13, color: palette.navy },
  factSub: { fontFamily: F.m, fontSize: 11.5, color: palette.muted },
  why: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  skill: { height: 24, borderRadius: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.cyanTint },
  skillText: { fontFamily: F.m, fontSize: 12, color: palette.cyanDeep },
  apply: {
    marginTop: 14, height: 48, borderRadius: 14, backgroundColor: palette.navy,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16,
  },
  applyText: { fontFamily: F.hb, fontSize: 15, color: '#FFFFFF' },
});
