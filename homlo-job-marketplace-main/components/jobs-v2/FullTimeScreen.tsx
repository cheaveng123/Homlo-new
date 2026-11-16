import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Parallax, Press, Reveal, ResultBar, RoundButton, ScreenScroll, Txt, ts, useLoop } from './ui';
import { colors, radius } from './theme';
import { SkeletonBlock } from '@/components/loading/HomloSkeletonKit';
import { FullTimeListSkeleton } from './JobTypeSkeletons';

export type FullTimeJob = {
  id: string; title: string; company: string; arrangement: string;
  pay: string;        // big monthly figure, e.g. "$750"
  rangeLabel: string; // e.g. "$600–900 /mo"
  min: number; max: number; // numeric range for the bar
};

type Props = {
  jobs: FullTimeJob[];
  subtitle: string; // e.g. "214 steady roles with monthly pay"
  onBack: () => void;
  onJobPress: (id: string) => void;
  onFilters?: () => void;
  onSort?: () => void;
  loading?: boolean;
  strings?: { title?: string };
};

/** Back-layer and front-layer buildings in a 300x60 box. [x, y, w, h] */
const BACK: number[][] = [[8, 22, 20, 38], [34, 10, 24, 50], [78, 24, 22, 36], [124, 14, 20, 46], [176, 20, 24, 40], [226, 8, 22, 52], [262, 24, 26, 36]];
const FRONT: number[][] = [[0, 34, 22, 26], [24, 20, 26, 40], [52, 30, 18, 30], [72, 10, 24, 50], [98, 28, 20, 32], [120, 38, 26, 22], [148, 16, 22, 44], [172, 32, 24, 28], [198, 24, 20, 36], [220, 36, 22, 24], [244, 14, 24, 46], [270, 30, 30, 30]];
const WINDOWS: number[][] = [[30, 28], [40, 28], [34, 38], [78, 18], [86, 18], [80, 30], [154, 24], [160, 34], [250, 22], [258, 32], [252, 42], [204, 34]];

/** Daylight skyline: light sky, small bobbing sun with a soft halo, drifting clouds, teal office skyline. */
function Skyline() {
  return (
    <Svg width="100%" height={56} viewBox="0 0 300 60" preserveAspectRatio="none" style={styles.sky}>
      {BACK.map((b, i) => (
        <Rect key={`b${i}`} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill={colors.tintMid} />
      ))}
      {FRONT.map((b, i) => (
        <Rect key={`f${i}`} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill={colors.teal} />
      ))}
      {WINDOWS.map((w, i) => (
        <Rect key={`w${i}`} x={w[0]} y={w[1]} width={3} height={3} fill={colors.tint} />
      ))}
    </Svg>
  );
}

function Sun() {
  const bob = useLoop(1, 2000, { reverse: true, easing: Easing.inOut(Easing.quad) });
  const glow = useLoop(1, 1800, { reverse: true, easing: Easing.inOut(Easing.quad) });
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(bob.value, [0, 1], [0, -6]) }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.25, 0.5]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.5]) }],
  }));
  return (
    <Animated.View style={[styles.sun, st]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 17, backgroundColor: colors.sun }, halo]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 17, backgroundColor: colors.sun }]} />
    </Animated.View>
  );
}

function Cloud({ left, top, width, delay }: { left: `${number}%`; top: number; width: number; delay: number }) {
  const t = useLoop(1, 6000, { reverse: true, easing: Easing.inOut(Easing.quad), delay });
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(t.value, [0, 1], [0, 14]) }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width, height: 16, borderRadius: 8, backgroundColor: colors.white, opacity: 0.85 }, st]}>
      <View style={{ position: 'absolute', left: width * 0.2, top: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white }} />
    </Animated.View>
  );
}

export default function FullTimeScreen({ jobs, subtitle, onBack, onJobPress, onFilters, onSort, loading, strings }: Props) {
  const insets = useSafeAreaInsets();
  const lo = jobs.length ? Math.min(...jobs.map((j) => j.min)) : 0;
  const hi = jobs.length ? Math.max(...jobs.map((j) => j.max)) : 0;
  const span = Math.max(1, hi - lo);

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <StatusBar style="dark" />
      <ScreenScroll>
        <View style={{ minHeight: insets.top + 162, overflow: 'hidden' }}>
          <LinearGradient
            colors={[colors.tintMid, colors.tint, colors.cream]} locations={[0, 0.55, 1]}
            start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill}
          />
          <Cloud left="52%" top={insets.top + 18} width={52} delay={0} />
          <Cloud left="72%" top={insets.top + 58} width={38} delay={1500} />
          <Sun />
          <Parallax rate={-0.3} fade={220} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
            <RoundButton icon="back" label="Back" onPress={onBack} />
            <Txt style={[ts.hero, { marginTop: 12 }]} accessibilityRole="header">{strings?.title ?? 'Full-time'}</Txt>
            <Txt style={{ color: colors.deepTeal }}>{subtitle}</Txt>
          </Parallax>
          <Skyline />
        </View>

        <View style={{ padding: 16 }}>
          <View style={{ paddingBottom: 12 }}>
            <ResultBar countLabel={loading ? undefined : undefined} onFilters={onFilters} onSort={onSort} />
            {loading ? <SkeletonBlock width="34%" height={ts.title.lineHeight} borderRadius={4} /> : null}
          </View>
          {loading ? (
            <FullTimeListSkeleton count={4} />
          ) : (
            <View style={styles.group}>
              {jobs.map((j, i) => {
                const left = ((j.min - lo) / span) * 100;
                const width = Math.max(8, ((j.max - j.min) / span) * 100);
                return (
                  <Reveal key={j.id}>
                    <Press
                      onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`}
                      style={[styles.row, i === jobs.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt style={ts.title} numberOfLines={1}>{j.title}</Txt>
                        <Txt style={ts.caption} numberOfLines={1}>{`${j.company} · ${j.arrangement}`}</Txt>
                        <View style={styles.track}>
                          <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(left, 100 - width)}%`, width: `${width}%`, borderRadius: 6, backgroundColor: colors.teal }} />
                        </View>
                        <Txt style={[ts.caption, { fontSize: 11 }]}>{j.rangeLabel}</Txt>
                      </View>
                      <Txt style={ts.big}>{j.pay}</Txt>
                    </Press>
                  </Reveal>
                );
              })}
            </View>
          )}
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sun: { position: 'absolute', left: '60%', bottom: 24, width: 34, height: 34 },
  group: { backgroundColor: colors.white, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { height: 6, borderRadius: 6, backgroundColor: colors.track, marginTop: 8, marginBottom: 4 },
});
