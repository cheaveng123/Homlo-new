// Settings-list pieces for the Profile tab, laid out after the approved
// reference (grouped white cards, icon + label + round arrow, one featured
// card) in Homlo's fonts and tokens.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '@/src/design/motion';
import { palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { AppIcon } from '@/components/ui/AppIcon';
import { PlanEmblem } from '@/components/plans/PlanEmblems';

const LINE = '#E6EDEF';

/* ---------- glyphs not in AppIcon ---------- */
const g = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const PrivacyGlyph = ({ color = palette.slate }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" stroke={color} {...g}>
    <Path d="M12 3l7.5 2.8v5.4c0 4.6-3.2 8-7.5 9.8-4.3-1.8-7.5-5.2-7.5-9.8V5.8Z" />
    <Rect x={9.2} y={11} width={5.6} height={4.6} rx={1.2} />
    <Path d="M10.4 11V9.6a1.6 1.6 0 0 1 3.2 0V11" />
  </Svg>
);
export const TermsGlyph = ({ color = palette.slate }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" stroke={color} {...g}>
    <Path d="M6.5 3h8l3.5 3.5V19a2 2 0 0 1-2 2h-9.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <Path d="M14.5 3v3.5H18M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </Svg>
);
const ArrowGlyph = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" stroke={palette.navy} {...g} strokeWidth={2.2}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
const CrownGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" stroke={palette.navy} {...g}>
    <Path d="M3.5 8.5 8 12l4-6.5 4 6.5 4.5-3.5L18.5 18h-13Z" />
    <Circle cx={12} cy={5.2} r={0.9} fill={palette.amber} stroke={palette.amber} />
  </Svg>
);

/* ---------- group + row ---------- */
export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.group}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={s.sep} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

export function SettingsRow({ icon, label, right, danger, onPress }: {
  icon: React.ReactNode | Parameters<typeof AppIcon>[0]['name'];
  label: string;
  right?: React.ReactNode;
  danger?: boolean;
  onPress: () => void;
}) {
  const tint = danger ? palette.danger : palette.slate;
  return (
    <PressableScale scale={0.985} onPress={() => { haptic.selection(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} style={s.row}>
      <View style={s.icon}>{typeof icon === 'string' ? <AppIcon name={icon as never} size={20} color={tint} /> : icon}</View>
      <Text style={[s.label, danger && { color: palette.danger }]} numberOfLines={1}>{label}</Text>
      {right}
      {!danger ? <View style={s.arrow}><ArrowGlyph /></View> : null}
    </PressableScale>
  );
}

export function RowTag({ children }: { children: string }) {
  return (
    <View style={s.tag}><Text style={s.tagText}>{children}</Text></View>
  );
}

/* ---------- featured card (Account plan) ---------- */
export function PlanFeatureCard({ planId, planLabel, onPress }: { planId: string; planLabel: string; onPress: () => void }) {
  return (
    <PressableScale scale={0.985} onPress={() => { haptic.selection(); onPress(); }} accessibilityRole="button" accessibilityLabel={`Account plan, ${planLabel}`} style={s.feature}>
      <LinearGradient colors={[palette.surface, palette.cyanTint]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.featureArt} pointerEvents="none">
        <PlanEmblem id={planId} index={0} size={96} />
      </View>
      <View style={s.featureText}>
        <View style={s.featureHead}>
          <CrownGlyph />
          <Text style={s.featureTitle}>Account plan</Text>
        </View>
        <Text style={s.featureSub}>You&apos;re on {planLabel}. See what each plan includes.</Text>
        <View style={s.featureLink}>
          <Text style={s.featureLinkText}>View plans</Text>
          <ArrowGlyph />
        </View>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  group: { backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#DCE4E7', marginLeft: 50 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12 },
  icon: { width: 22, alignItems: 'center' },
  label: { flex: 1, fontFamily: F.m, fontSize: 15, color: palette.ink },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: palette.page, alignItems: 'center', justifyContent: 'center' },
  tag: { height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: palette.cyanTint, justifyContent: 'center' },
  tagText: { fontFamily: F.s, fontSize: 12, color: palette.cyanDeep },
  feature: { minHeight: 104, borderRadius: 20, borderWidth: 1, borderColor: LINE, overflow: 'hidden', padding: 16, justifyContent: 'center' },
  featureArt: { position: 'absolute', right: -6, bottom: -14, opacity: 0.95 },
  featureText: { maxWidth: '72%' },
  featureHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureTitle: { fontFamily: F.h, fontSize: 16, color: palette.navy },
  featureSub: { marginTop: 4, fontFamily: F.m, fontSize: 13, lineHeight: 18, color: palette.muted },
  featureLink: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureLinkText: { fontFamily: F.hb, fontSize: 13, color: palette.navy },
});
