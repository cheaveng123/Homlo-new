// Visual parts for the Recommended page, in the current Homlo style:
// navy titles in Plus Jakarta Sans, Inter body, 16pt gutters, white cards with
// a 1pt hairline and a faint shadow, custom line glyphs, calm SMOOTH motion.
// Page-local on purpose: components/jobs/JobsUI is still shared by Near-you and Popular.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { LogoMark } from '@/components/vista/category/LogoMark';
import { BriefcaseGlyph, CheckGlyph, ClockGlyph } from '@/components/vista/category/glyphs';
import { MegaphoneIcon } from '@/components/jobs-v2/jobtype/glyphs';

const LINE = '#E3E9EC';
const NAVY_TINT = '#E8EEF3';

/** Standard entrance: opacity 0→1, rise 20pt, 600ms SMOOTH, staggered by `i`. */
export const enter = (i: number) =>
  FadeInDown.delay(i * 70)
    .duration(durations.enter)
    .easing(SMOOTH)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- match gauge: half ring, grey track, cyan arc ---------- */
export function MatchGauge({ value, size = 52 }: { value: number; size?: number }) {
  const stroke = size > 60 ? 7 : 5;
  const r = size / 2 - stroke;
  const h = Math.round(size / 2 + stroke);
  const d = `M${stroke} ${size / 2} A${r} ${r} 0 0 1 ${size - stroke} ${size / 2}`;
  const c = Math.PI * r;
  const big = size > 60;
  return (
    <View style={{ width: size, alignItems: 'center' }} accessibilityLabel={`${value}% match`}>
      <Svg width={size} height={h}>
        <Path d={d} fill="none" stroke="#E3EEF1" strokeWidth={stroke} strokeLinecap="round" />
        <Path d={d} fill="none" stroke={palette.cyan} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={[c, c]} strokeDashoffset={c * (1 - value / 100)} />
      </Svg>
      <Text style={[g.num, big && g.numBig]}>{value}%</Text>
      {big ? <Text style={g.caption}>match</Text> : null}
    </View>
  );
}

const g = StyleSheet.create({
  num: { marginTop: -10, fontFamily: F.h, fontSize: 13, color: palette.navy },
  numBig: { marginTop: -20, fontSize: 22 },
  caption: { fontFamily: F.m, fontSize: 11.5, color: palette.muted, marginTop: -2 },
});

/* ---------- small pieces ---------- */
export const GridGlyph = ({ size = 26, color = palette.navy }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round">
    <Rect x={4} y={4} width={6.5} height={6.5} rx={2} />
    <Rect x={13.5} y={4} width={6.5} height={6.5} rx={2} />
    <Rect x={4} y={13.5} width={6.5} height={6.5} rx={2} />
    <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={2} fill={palette.amber} stroke={palette.amber} />
  </Svg>
);

export const DotsGlyph = ({ size = 26, color = palette.navy }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Circle cx={5.5} cy={12} r={1.9} />
    <Circle cx={12} cy={12} r={1.9} />
    <Circle cx={18.5} cy={12} r={1.9} fill={palette.amber} />
  </Svg>
);

/* ---------- Category row: round, icon-only, like the Job type picker; fits on screen (no scroll) ---------- */
export function CategoryRow({ items, selected, onSelect }: {
  items: { id: string; label: string; icon: React.ReactNode }[]; selected: string; onSelect: (id: string) => void;
}) {
  return (
    <View style={r.row}>
      {items.map((it) => {
        const on = it.id === selected;
        return (
          <PressableScale
            key={it.id}
            scale={0.97}
            onPress={() => { if (!on) { haptic.selection(); onSelect(it.id); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={r.item}
          >
            <View>
              {on ? <View style={r.ring} /> : null}
              <View style={[r.circle, { borderColor: on ? 'transparent' : LINE }]}>{it.icon}</View>
              {on ? (
                <View style={r.badge}><CheckGlyph size={11} color="#FFFFFF" /></View>
              ) : null}
            </View>
            <Text style={[r.label, on && r.labelOn]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{it.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const r = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  item: { alignItems: 'center', width: 70 },
  circle: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -4.5, left: -4.5, right: -4.5, bottom: -4.5, borderRadius: 34, borderWidth: 2, borderColor: palette.cyanDeep },
  badge: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: palette.cyanDeep,
    borderWidth: 2, borderColor: palette.surface, alignItems: 'center', justifyContent: 'center',
  },
  label: { marginTop: 8, fontFamily: F.m, fontSize: 12.5, lineHeight: 16, color: palette.ink, textAlign: 'center' },
  labelOn: { fontFamily: F.hb, color: palette.cyanDeep },
});

/* ---------- Section header: title, muted count, fading hairline ---------- */
export function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <View style={h.row}>
      <Text style={h.title} accessibilityRole="header">{title}</Text>
      {count ? <Text style={h.count}>{count}</Text> : null}
      <LinearGradient colors={[LINE, 'rgba(227,233,236,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={h.line} />
    </View>
  );
}

const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  title: { fontFamily: F.h, fontSize: 18, color: palette.navy },
  count: { fontFamily: F.m, fontSize: 13, color: palette.muted },
  line: { flex: 1, height: 1 },
});

/* ---------- Matched job card ---------- */
function TypeChip({ label }: { label: string }) {
  const part = /part/i.test(label);
  return (
    <View style={[c.chip, { backgroundColor: part ? palette.cyanTint : NAVY_TINT }]}>
      {part ? <ClockGlyph size={13} color={palette.cyanDeep} /> : <BriefcaseGlyph size={13} color={palette.navy} />}
      <Text style={[c.chipText, { color: part ? palette.cyanDeep : palette.navy }]}>{label}</Text>
    </View>
  );
}

export function MatchJobCard({ title, company, place, pay, type, match, boosted, onPress }: {
  title: string; company: string; place: string; pay: string; type: string; match: number; boosted?: boolean; onPress: () => void;
}) {
  const [amount, unit] = pay.split('/').map((x) => x.trim());
  return (
    <PressableScale scale={0.97} onPress={() => { haptic.selection(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${title} at ${company}`} style={c.card}>
      <View style={c.row}>
        <LogoMark company={company} size={46} radius={12} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {boosted ? (
            <View style={c.ad}>
              <MegaphoneIcon size={12} />
              <Text style={c.adText}>Ad</Text>
            </View>
          ) : null}
          <Text style={c.title} numberOfLines={2}>{title}</Text>
          <Text style={c.meta} numberOfLines={1}>{company} · {place}</Text>
        </View>
        <MatchGauge value={match} />
      </View>
      <View style={c.body}>
        <Text style={c.pay}>
          {amount}
          {/* fixed pay has no suffix in the data; it is monthly everywhere else in the app */}
          <Text style={c.unit}> /{!unit ? 'mo' : unit === 'hour' ? 'hr' : unit}</Text>
        </Text>
        <View style={c.tags}><TypeChip label={type} /></View>
      </View>
    </PressableScale>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: LINE,
    paddingVertical: 14, paddingLeft: 16, paddingRight: 14,
    shadowColor: palette.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  adText: { fontFamily: F.hb, fontSize: 12, color: palette.amberInk },
  title: { fontFamily: F.h, fontSize: 16, lineHeight: 20, color: palette.navy },
  meta: { marginTop: 2, fontFamily: F.m, fontSize: 13, color: palette.muted },
  body: { marginLeft: 58, marginTop: 10 },
  pay: { fontFamily: F.h, fontSize: 17, color: palette.navy },
  unit: { fontFamily: F.m, fontSize: 12, color: palette.muted },
  tags: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: { height: 26, borderRadius: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontFamily: F.s, fontSize: 12 },
});

/* ---------- Outline button (Load more) ---------- */
export function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [o.btn, pressed && { opacity: 0.7 }]}>
      <Text style={o.text}>{label}</Text>
    </Pressable>
  );
}

const o = StyleSheet.create({
  btn: { alignSelf: 'center', marginTop: 6, height: 44, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: LINE, justifyContent: 'center' },
  text: { fontFamily: F.hb, fontSize: 14, color: palette.navy },
});
