import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, interpolate, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { Card, Parallax, Pill, Press, Reveal, ResultBar, RoundButton, ScreenScroll, SearchRow, Txt, ts, useLoop } from './ui';
import { colors, radius } from './theme';
import { SkeletonBlock } from '@/components/loading/HomloSkeletonKit';
import { PartTimeListSkeleton } from './JobTypeSkeletons';

export type PartTimeJob = {
  id: string; title: string; company: string; pay: string; location: string;
  photo?: ImageSourcePropType; photoColors?: [string, string]; saved?: boolean;
};

type Props = {
  jobs: PartTimeJob[];
  countLabel: string;
  onBack?: () => void;
  onSearch: () => void;
  onFilters: () => void;
  onSort?: () => void;
  onJobPress: (id: string) => void;
  onToggleSave?: (id: string) => void;
  loading?: boolean;
  strings?: { title?: string; subtitle?: string; search?: string; type?: string };
};

/* Courier on a scooter, drawn in a 200x100 box and shown at 0.85 scale. Wheels spin, rider bobs, road dashes move. */
const K = 0.85;
const W = 200 * K;
const H = 100 * K;
const AnimatedLine = Animated.createAnimatedComponent(Line);

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  const rot = useLoop(360, 500, { easing: Easing.linear });
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const size = 22 * K;
  return (
    <Animated.View style={[{ position: 'absolute', left: (cx - 11) * K, top: (cy - 11) * K, width: size, height: size }, st]}>
      <Svg width={size} height={size} viewBox="0 0 22 22">
        <Circle cx="11" cy="11" r="11" fill={colors.deepTeal} />
        <Circle cx="11" cy="11" r="4" fill={colors.tint} />
        <Line x1="11" y1="2" x2="11" y2="20" stroke={colors.tint} strokeWidth="1.5" />
      </Svg>
    </Animated.View>
  );
}

function Courier() {
  const dash = useLoop(-16, 1000, { easing: Easing.linear });
  const bob = useLoop(1, 800, { reverse: true, easing: Easing.inOut(Easing.quad) });
  const roadProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(bob.value, [0, 1], [0, -1.5]) }] }));
  const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
  return (
    <View style={{ width: W, height: H }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H} viewBox="0 0 200 100" style={fill}>
        <AnimatedLine
          x1="0" y1="90" x2="200" y2="90" stroke={colors.teal} strokeWidth="2" strokeOpacity="0.4"
          strokeDasharray="8 8" animatedProps={roadProps}
        />
        <Path d="M4 50h26M0 62h20M10 74h18" stroke={colors.teal} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.45" />
      </Svg>
      <Animated.View style={[fill, bobStyle]}>
        <Svg width={W} height={H} viewBox="0 0 200 100">
          <Rect x="44" y="28" width="28" height="26" rx="4" fill={colors.clay} />
          <Rect x="44" y="38" width="28" height="4" fill={colors.cream} />
          <Rect x="62" y="56" width="28" height="10" rx="5" fill={colors.teal} />
          <Rect x="74" y="66" width="50" height="8" rx="4" fill={colors.teal} />
          <Path d="M138 80l-10-36" stroke={colors.deepTeal} strokeWidth="5" strokeLinecap="round" />
          <Path d="M120 42h16" stroke={colors.deepTeal} strokeWidth="5" strokeLinecap="round" />
          <Circle cx="139" cy="50" r="3" fill={colors.sun} />
          <Path d="M82 58l16 8h18" stroke={colors.deepTeal} strokeWidth="7" strokeLinecap="round" fill="none" />
          <Path d="M82 58l5-24" stroke={colors.deepTeal} strokeWidth="10" strokeLinecap="round" />
          <Path d="M88 36l32 6" stroke={colors.deepTeal} strokeWidth="5" strokeLinecap="round" />
          <Circle cx="90" cy="24" r="8" fill={colors.cream} />
          <Path d="M81 24a9 9 0 0 1 18 0z" fill={colors.sun} />
        </Svg>
      </Animated.View>
      <Wheel cx={62} cy={80} />
      <Wheel cx={142} cy={80} />
    </View>
  );
}

export default function PartTimeScreen({
  jobs, countLabel, onBack, onSearch, onFilters, onSort, onJobPress, onToggleSave, loading, strings,
}: Props) {
  const insets = useSafeAreaInsets();
  const s = {
    title: 'Part-time', subtitle: 'Flexible hours that fit your day', search: 'Search part-time jobs', type: 'Part-time', ...strings,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <StatusBar style="dark" />
      <ScreenScroll>
        <View
          style={{
            backgroundColor: colors.tint, minHeight: insets.top + 150, paddingTop: insets.top + 8, paddingHorizontal: 16,
            paddingBottom: 24, overflow: 'hidden', borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet,
          }}
        >
          <Parallax rate={-0.3} fade={220}>
            {onBack ? (
              <View style={{ marginBottom: 8 }}>
                <RoundButton icon="back" label="Back" onPress={onBack} />
              </View>
            ) : null}
            <Txt style={ts.hero} accessibilityRole="header">{s.title}</Txt>
            <Txt style={{ color: colors.deepTeal, maxWidth: 130 }}>{s.subtitle}</Txt>
          </Parallax>
          <Parallax rate={0.25} style={{ position: 'absolute', right: 6, bottom: 6 }}>
            <Courier />
          </Parallax>
        </View>

          <View style={{ padding: 16 }}>
            <SearchRow placeholder={s.search} onPress={onSearch} onFilters={onFilters} />
            <View style={{ paddingTop: 14, paddingBottom: 12 }}>
              <ResultBar countLabel={loading ? undefined : countLabel} onSort={onSort} hideFilters />
              {loading ? <SkeletonBlock width="34%" height={ts.title.lineHeight} borderRadius={4} /> : null}
            </View>
            {loading ? (
              <PartTimeListSkeleton count={4} />
            ) : (
              jobs.map((j) => (
                <Reveal key={j.id}>
                  <Press onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`}>
                    <Card style={{ flexDirection: 'row', gap: 12, padding: 10 }}>
                      <View style={styles.thumb}>
                        {j.photo ? (
                          <Image source={j.photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <LinearGradient
                            colors={j.photoColors ?? [colors.tintMid, colors.tint]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
                          />
                        )}
                        <Press
                          onPress={() => onToggleSave?.(j.id)} hitSlop={9} accessibilityRole="button" accessibilityLabel="Save job"
                          style={styles.heart}
                        >
                          <AppIcon name="heart" size={14} color={j.saved ? colors.clay : colors.deepTeal} fill={j.saved ? colors.clay : 'none'} />
                        </Press>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt style={ts.title} numberOfLines={1}>{j.title}</Txt>
                        <Txt style={ts.caption} numberOfLines={1}>{j.company}</Txt>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 6 }}>
                          <AppIcon name="pin" size={13} color={colors.muted} />
                          <Txt style={[ts.caption, { flex: 1 }]} numberOfLines={1}>{j.location}</Txt>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Txt style={ts.tag}>{j.pay}</Txt>
                          <Pill label={s.type} bg={colors.tint} ink={colors.deepTeal} />
                        </View>
                      </View>
                    </Card>
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
  thumb: { width: 84, height: 100, borderRadius: radius.tile, overflow: 'hidden' },
  heart: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
});
