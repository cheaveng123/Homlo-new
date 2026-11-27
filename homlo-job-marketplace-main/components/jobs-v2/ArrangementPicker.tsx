// Work-arrangement picker for Post a job (step 2). Three option rows; only the
// selected one drops down to reveal its custom illustration and a one-line
// description. The others stay collapsed. Smooth expand, reduced-motion safe.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SMOOTH } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import { Press, Txt } from './ui';
import { colors, font } from './theme';

export type ArrangementKey = 'on-site' | 'hybrid' | 'remote';

const NAVY = '#14324A';
const CYAN = '#0891B2';
const TINT = '#DCF1F6';
const AMBER = '#F5A524';
const WHITE = '#FFFFFF';

/* ---------- custom illustrations (88x64) ---------- */
function OnSiteArt() {
  return (
    <Svg width={88} height={64} viewBox="0 0 88 64">
      <Path d="M10 58h68" stroke={NAVY} strokeWidth={2.4} strokeLinecap="round" />
      <Rect x={26} y={20} width={36} height={38} rx={3} fill={TINT} stroke={NAVY} strokeWidth={2.4} />
      <Rect x={18} y={36} width={12} height={22} rx={2} fill={WHITE} stroke={NAVY} strokeWidth={2.4} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <Rect key={`${r}${c}`} x={32 + c * 9} y={26 + r * 8} width={5} height={4.5} rx={1} fill={CYAN} opacity={r === 0 && c === 1 ? 1 : 0.55} />
      )))}
      <Rect x={39.5} y={49} width={9} height={9} rx={1.5} fill={NAVY} />
      <Path d="M44 17s7-5.6 7-10.6a7 7 0 1 0-14 0c0 5 7 10.6 7 10.6Z" fill={AMBER} />
      <Circle cx={44} cy={6.6} r={2.6} fill={WHITE} />
    </Svg>
  );
}

function HybridArt() {
  return (
    <Svg width={88} height={64} viewBox="0 0 88 64">
      <Path d="M6 58h76" stroke={NAVY} strokeWidth={2.4} strokeLinecap="round" />
      {/* home */}
      <Path d="M8 38 22 26l14 12" fill="none" stroke={NAVY} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={12} y={36} width={20} height={22} rx={2} fill={TINT} stroke={NAVY} strokeWidth={2.4} />
      <Rect x={19} y={46} width={6} height={12} rx={1} fill={NAVY} />
      {/* office */}
      <Rect x={54} y={22} width={26} height={36} rx={3} fill={TINT} stroke={NAVY} strokeWidth={2.4} />
      {[0, 1, 2].map((r) => [0, 1].map((c) => (
        <Rect key={`${r}${c}`} x={59 + c * 10} y={28 + r * 8} width={6} height={4.5} rx={1} fill={CYAN} opacity={0.6} />
      )))}
      {/* back-and-forth arrows */}
      <Path d="M38 30c4-5 10-5 14 0M48 26l4 4-5 2" fill="none" stroke={AMBER} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M52 42c-4 5-10 5-14 0M42 46l-4-4 5-2" fill="none" stroke={AMBER} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RemoteArt() {
  return (
    <Svg width={88} height={64} viewBox="0 0 88 64">
      {/* home roofline behind */}
      <Path d="M14 30 44 8l30 22" fill="none" stroke={NAVY} strokeOpacity={0.25} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {/* laptop */}
      <Rect x={24} y={30} width={40} height={24} rx={3} fill={NAVY} />
      <Rect x={28} y={34} width={32} height={16} rx={1.5} fill={CYAN} />
      <Path d="M16 56h56" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={44} cy={42} r={2.6} fill={WHITE} />
      {/* wifi */}
      <Path d="M37 22a10 10 0 0 1 14 0" fill="none" stroke={AMBER} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M32 17a17 17 0 0 1 24 0" fill="none" stroke={AMBER} strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={44} cy={26} r={1.8} fill={AMBER} />
    </Svg>
  );
}

const OPTIONS: { key: ArrangementKey; label: string; hint: string; Art: () => React.ReactElement }[] = [
  { key: 'on-site', label: 'On-site', hint: 'People work at your place every day.', Art: OnSiteArt },
  { key: 'hybrid', label: 'Hybrid', hint: 'Some days at your place, some from home.', Art: HybridArt },
  { key: 'remote', label: 'Remote', hint: 'People can work from anywhere.', Art: RemoteArt },
];

export function ArrangementPicker({ options, value, onChange }: {
  /** Labels from the wizard (keeps its copy); keys must be on-site / hybrid / remote. */
  options: { key: ArrangementKey; label: string }[];
  value: ArrangementKey | null;
  onChange: (k: ArrangementKey) => void;
}) {
  const reduce = useReducedMotion();
  const layout = reduce ? undefined : LinearTransition.duration(280).easing(SMOOTH);
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {options.map((o) => {
        const meta = OPTIONS.find((x) => x.key === o.key);
        const on = value === o.key;
        return (
          <Animated.View key={o.key} layout={layout} style={[s.card, on && s.cardOn]}>
            <Press
              onPress={() => { if (!on) { haptic.selection(); onChange(o.key); } }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, expanded: on }}
              accessibilityLabel={o.label}
              style={s.row}
            >
              <Txt style={[s.label, on && { color: colors.deepTeal }]}>{o.label}</Txt>
              <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
            </Press>
            {on && meta ? (
              <Animated.View
                entering={reduce ? undefined : FadeIn.duration(260).easing(SMOOTH)}
                exiting={reduce ? undefined : FadeOut.duration(160)}
                style={s.drop}
              >
                <View style={s.art}><meta.Art /></View>
                <Txt style={s.hint}>{meta.hint}</Txt>
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  cardOn: { borderColor: colors.teal, borderWidth: 2 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  label: { fontFamily: font.semi, fontSize: 15, color: colors.text },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9D3D8', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  art: { width: 96, height: 72, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hint: { flex: 1, fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: colors.muted },
});
