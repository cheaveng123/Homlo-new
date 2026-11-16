import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconName } from './AppIcon';
import { Dot, LogoTile, Pill, Press, Reveal, RoundButton, ScreenScroll, Txt, ts } from './ui';
import { accents, colors, font } from './theme';

export type PopularJob = {
  id: string; title: string; company: string; pay: string; positionsLeft: number; positionsTotal?: number; initials: string; color: string;
};
export type Period = 'week' | 'month' | 'all';

/** Wire these to your i18n keys (text only; keys stay yours). */
const defaultStrings = {
  title: 'Popular',
  subtitle: 'Most applied to',
  week: 'This week',
  month: 'This month',
  all: 'All time',
  positions: (left: number, total?: number) => {
    const open = Math.max(0, left);
    const all = Number(total ?? 0);
    if (all <= 0) return `${open} position${open === 1 ? '' : 's'}`;
    const accepted = Math.max(0, Math.min(all, all - open));
    return `${accepted}/${all} position${all === 1 ? '' : 's'}`;
  },
};

type Props = {
  jobs: PopularJob[];
  period?: Period;
  onPeriodChange?: (p: Period) => void;
  onJobPress: (id: string) => void;
  onBack?: () => void;
  strings?: Partial<typeof defaultStrings>;
};

type Spec = {
  key: Period; icon: IconName; disc: string; iconColor: string; border: string; bg: string; ink: string; flame?: boolean;
};

const SPECS: Spec[] = [
  { key: 'week', icon: 'flame', disc: colors.clay, iconColor: colors.white, border: colors.clay, bg: accents.clay.bg, ink: accents.clay.ink, flame: true },
  { key: 'month', icon: 'cal', disc: colors.sun, iconColor: colors.creamInk, border: colors.sun, bg: colors.cream, ink: colors.creamInk },
  { key: 'all', icon: 'star', disc: colors.clay, iconColor: colors.white, border: colors.clay, bg: accents.clay.bg, ink: accents.clay.ink },
];

/** Row size tiers: rank 1 is the biggest, then smaller through rank 3; rank 4+ are all one smaller size. */
type Tier = { pad: number; tile: number; badge: number; title: number };
const TOP_TIERS: Tier[] = [
  { pad: 20, tile: 64, badge: 40, title: 18 },
  { pad: 16, tile: 52, badge: 34, title: 16 },
  { pad: 13, tile: 44, badge: 30, title: 15 },
];
const REST_TIER: Tier = { pad: 12, tile: 40, badge: 28, title: 14 };
const tierFor = (index: number): Tier => TOP_TIERS[index] ?? REST_TIER;

/** Selected chip: filled with its own color, icon disc pulses a glow ring, the flame flickers. */
function PeriodChip({ spec, label, selected, onPress }: { spec: Spec; label: string; selected: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  const flick = useSharedValue(0);

  useEffect(() => {
    if (selected && !reduce) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
      flick.value = 0;
      flick.value = withRepeat(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(pulse);
      cancelAnimation(flick);
      pulse.value = 0;
      flick.value = 0;
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(flick);
    };
  }, [selected, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const halo = useAnimatedStyle(() => ({
    opacity: selected ? 0.55 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));
  const flame = useAnimatedStyle(() => {
    const on = selected && spec.flame ? 1 : 0;
    return {
      transform: [
        { scaleX: 1 + flick.value * 0.12 * on },
        { scaleY: 1 + flick.value * 0.28 * on },
        { rotate: `${(flick.value * 2 - 1) * 4 * on}deg` },
      ],
    };
  });

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { borderColor: selected ? spec.border : colors.border, backgroundColor: selected ? spec.bg : colors.white },
        selected && { shadowColor: spec.border, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <View style={styles.disc}>
        <Animated.View style={[styles.halo, { backgroundColor: spec.disc }, halo]} />
        <View style={[styles.discFill, { backgroundColor: spec.disc }]}>
          <Animated.View style={flame}>
            <AppIcon name={spec.icon} size={14} color={spec.iconColor} />
          </Animated.View>
        </View>
      </View>
      <Txt style={{ fontFamily: font.semi, fontSize: 12, lineHeight: 16, color: selected ? spec.ink : colors.text }}>{label}</Txt>
    </Press>
  );
}

export default function PopularScreen({ jobs, period, onPeriodChange, onJobPress, onBack, strings }: Props) {
  const s = { ...defaultStrings, ...strings };
  const insets = useSafeAreaInsets();
  const [inner, setInner] = useState<Period>(period ?? 'week');
  const current = period ?? inner;
  const pick = (p: Period) => {
    setInner(p);
    onPeriodChange?.(p);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <StatusBar style="dark" />
      <ScreenScroll>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          {onBack ? (
            <View style={{ marginBottom: 8 }}>
              <RoundButton icon="back" label="Back" onPress={onBack} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Txt style={ts.hero} accessibilityRole="header">{s.title}</Txt>
            <Dot />
          </View>
          <Txt style={[ts.caption, { marginTop: 2 }]}>{s.subtitle}</Txt>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: 12, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {SPECS.map((sp) => (
            <PeriodChip key={sp.key} spec={sp} label={s[sp.key]} selected={current === sp.key} onPress={() => pick(sp.key)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16 }}>
          {jobs.map((j, i) => {
            const tier = tierFor(i);
            return (
            <Reveal key={j.id}>
              <Press onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`} style={[styles.row, { paddingVertical: tier.pad, gap: i === 0 ? 14 : 12 }]}>
                <View
                  style={[
                    styles.rank,
                    { width: tier.badge, height: tier.badge, borderRadius: tier.badge / 2 },
                    i === 0 && { backgroundColor: colors.sun },
                    i > 0 && i < 3 && { backgroundColor: colors.tint },
                  ]}
                >
                  <Txt style={[styles.rankText, { fontSize: tier.badge * 0.45, lineHeight: Math.round(tier.badge * 0.58) }]}>{i + 1}</Txt>
                </View>
                <LogoTile initials={j.initials} color={j.color} size={tier.tile} fontSize={Math.round(tier.tile * 0.36)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={[ts.title, { fontSize: tier.title, lineHeight: Math.round(tier.title * 1.35) }]} numberOfLines={1}>{j.title}</Txt>
                  <Txt style={[ts.caption, i < 3 && { fontSize: Math.max(12, tier.title - 2), lineHeight: Math.round((Math.max(12, tier.title - 2)) * 1.4) }]} numberOfLines={1}>{j.company}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Txt style={[ts.tag, i === 0 && { fontSize: 14, lineHeight: 18 }]}>{j.pay}</Txt>
                  <View style={{ alignSelf: 'flex-end' }}>
                    <Pill label={s.positions(j.positionsLeft, j.positionsTotal)} bg={accents.clay.bg} ink={accents.clay.ink} />
                  </View>
                </View>
              </Press>
            </Reveal>
            );
          })}
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14,
    borderRadius: 14, borderWidth: 1.5,
  },
  disc: { width: 24, height: 24 },
  halo: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  discFill: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  rankText: { fontFamily: font.head, fontSize: 14, lineHeight: 18, color: colors.deepTeal, fontVariant: ['tabular-nums'], textAlign: 'center' },
});
