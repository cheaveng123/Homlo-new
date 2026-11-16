import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Parallax, Press, Reveal, RoundButton, ScreenScroll, Txt, ts, useLoop } from './ui';
import { accents, colors, font } from './theme';
import { WeekendsListSkeleton } from './JobTypeSkeletons';

export type WeekendJob = {
  id: string; day: string; hours: string; title: string; company: string; pay: string;
};

type Props = {
  jobs: WeekendJob[];
  tabs?: string[]; // default Sat / Sun / Both
  tab?: number;
  onTabChange?: (index: number) => void;
  onBack?: () => void;
  onJobPress: (id: string) => void;
  loading?: boolean;
  strings?: { title?: string };
};

/** 24 wedges, 7° wide every 15°, faded outward by a radial gradient. */
const WEDGES = Array.from({ length: 24 }, (_, i) => {
  const a1 = (i * 15 * Math.PI) / 180;
  const a2 = ((i * 15 + 7) * Math.PI) / 180;
  const x = (a: number) => (150 + 150 * Math.cos(a)).toFixed(2);
  const y = (a: number) => (150 + 150 * Math.sin(a)).toFixed(2);
  return `M150 150L${x(a1)} ${y(a1)}A150 150 0 0 1 ${x(a2)} ${y(a2)}Z`;
}).join('');

/** Living sun: rays turn slowly, the sun breathes, a halo pulses. Stops with Reduce Motion. */
function ActiveSun() {
  const spin = useLoop(360, 40000, { easing: Easing.linear });
  const breathe = useLoop(1, 1500, { reverse: true, easing: Easing.inOut(Easing.quad) });
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const sun = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.07]) }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.45, 0.1]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.45]) }],
  }));
  return (
    <>
      <Animated.View style={[styles.rays, rays]} pointerEvents="none">
        <Svg width={300} height={300} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="rays" cx="150" cy="150" r="150" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.sun} stopOpacity="0.4" />
              <Stop offset="0.68" stopColor={colors.sun} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={WEDGES} fill="url(#rays)" />
        </Svg>
      </Animated.View>
      <View style={styles.sunBox} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 32, backgroundColor: colors.sun }, halo]} />
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 32, overflow: 'hidden' }, sun]}>
          <LinearGradient colors={['#FFD66B', colors.sun]} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.9, y: 0.9 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </>
  );
}

export default function WeekendsScreen({ jobs, tabs = ['Sat', 'Sun', 'Both'], tab, onTabChange, onBack, onJobPress, loading, strings }: Props) {
  const insets = useSafeAreaInsets();
  const [inner, setInner] = useState(0);
  const current = tab ?? inner;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <StatusBar style="dark" />
      <ScreenScroll background={colors.cream}>
        <View style={{ overflow: 'hidden', paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 40 }}>
          <LinearGradient colors={[accents.sunrise.mid, colors.cream]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <ActiveSun />
          <Parallax rate={-0.3} fade={220}>
            {onBack ? (
              <View style={{ marginBottom: 8 }}>
                <RoundButton icon="back" label="Back" onPress={onBack} />
              </View>
            ) : null}
            <Txt style={[ts.hero, { color: colors.creamInk }]} accessibilityRole="header">{strings?.title ?? 'Weekends'}</Txt>
            <View style={styles.tabs}>
              {tabs.map((t, i) => (
                <Press
                  key={t}
                  onPress={() => {
                    setInner(i);
                    onTabChange?.(i);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: current === i }}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={[styles.tab, current === i && { borderBottomColor: colors.clay }]}
                >
                  <Txt style={{ fontFamily: font.bold, color: colors.creamInk }}>{t}</Txt>
                </Press>
              ))}
            </View>
          </Parallax>
          <Svg width="100%" height={30} viewBox="0 0 100 30" preserveAspectRatio="none" style={styles.hill}>
            <Path d="M0 30L0 22Q50 -6 100 22L100 30Z" fill={colors.cream} />
          </Svg>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <WeekendsListSkeleton count={4} />
          ) : (
            jobs.map((j) => (
              <Reveal key={j.id}>
                <Press onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`} style={styles.ticket}>
                  <View style={styles.stub}>
                    <Txt style={{ fontFamily: font.head, fontSize: 14, lineHeight: 18, color: colors.clay, textAlign: 'center' }}>{j.day}</Txt>
                    <Txt style={[ts.caption, { fontSize: 11, textAlign: 'center' }]}>{j.hours}</Txt>
                  </View>
                  <Svg width={2} height="100%" style={styles.tear}>
                    <Line x1="1" y1="0" x2="1" y2="100%" stroke={colors.border} strokeWidth="2" strokeDasharray="4 4" />
                  </Svg>
                  <View style={[styles.notch, { top: -9 }]} />
                  <View style={[styles.notch, { bottom: -9 }]} />
                  <View style={{ flex: 1, minWidth: 0, padding: 12 }}>
                    <Txt style={ts.title} numberOfLines={1}>{j.title}</Txt>
                    <Txt style={ts.caption} numberOfLines={1}>{j.company}</Txt>
                    <Txt style={[ts.tag, { marginTop: 2 }]}>{j.pay}</Txt>
                  </View>
                </Press>
              </Reveal>
            ))
          )}
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  rays: { position: 'absolute', width: 300, height: 300, right: -90, top: -136 },
  sunBox: { position: 'absolute', right: 28, top: -18, width: 64, height: 64 },
  tabs: { flexDirection: 'row', gap: 20, marginTop: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(122,67,0,0.2)' },
  tab: { paddingVertical: 8, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  hill: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  ticket: {
    flexDirection: 'row', backgroundColor: colors.white, borderRadius: 20, marginVertical: 12,
    shadowColor: colors.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 3,
  },
  stub: { width: 62, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tear: { position: 'absolute', left: 61, top: 0, bottom: 0 },
  notch: { position: 'absolute', left: 53, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cream },
});
