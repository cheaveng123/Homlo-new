import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { Card, Parallax, Press, Reveal, ResultBar, RoundButton, ScreenScroll, SearchRow, Txt, ts, useLoop } from './ui';
import { colors, font } from './theme';
import { SkeletonBlock } from '@/components/loading/HomloSkeletonKit';
import { RemoteGridSkeleton } from './JobTypeSkeletons';

export type RemoteJob = { id: string; title: string; company: string; pay: string; photo?: ImageSourcePropType };

type Props = {
  jobs: RemoteJob[];
  countLabel: string;
  onBack: () => void;
  onSearch: () => void;
  onFilters?: () => void;
  onSort?: () => void;
  onJobPress: (id: string) => void;
  loading?: boolean;
  strings?: { title?: string; subtitle?: string; search?: string };
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TRACE_1 = 'M200 24H150L135 39H98';
const TRACE_2 = 'M200 62H168L153 77H122V104';

/** Technical top: circuit traces with data pulses flowing along them and a code chip. */
function Circuit() {
  const a = useLoop(-16, 1000, { easing: Easing.linear });
  const b = useLoop(-24, 1000, { easing: Easing.linear, from: -8 });
  const p1 = useAnimatedProps(() => ({ strokeDashoffset: a.value }));
  const p2 = useAnimatedProps(() => ({ strokeDashoffset: b.value }));
  return (
    <View style={styles.circuit} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={200} height={130} viewBox="0 0 200 110" fill="none" strokeLinecap="round">
        <G stroke={colors.tint} strokeOpacity={0.35} strokeWidth={1.2}>
          <Path d={TRACE_1} />
          <Path d={TRACE_2} />
          <Path d="M200 100H178" />
        </G>
        <AnimatedPath d={TRACE_1} stroke={colors.sun} strokeWidth={1.6} strokeDasharray="8 8" animatedProps={p1} />
        <AnimatedPath d={TRACE_2} stroke={colors.sun} strokeWidth={1.6} strokeDasharray="8 8" animatedProps={p2} />
        <G fill={colors.deepTeal} stroke={colors.tint} strokeOpacity={0.7}>
          <Circle cx={98} cy={39} r={3.5} />
          <Circle cx={122} cy={104} r={3.5} />
          <Circle cx={178} cy={100} r={3.5} />
        </G>
        <Rect x={112} y={48} width={36} height={18} rx={5} stroke={colors.tint} strokeOpacity={0.6} />
        <SvgText x={130} y={61} fontSize={10} fontWeight="700" fill={colors.tint} stroke="none" textAnchor="middle" fontFamily={font.bold}>
          {'</>'}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function RemoteScreen({ jobs, countLabel, onBack, onSearch, onFilters, onSort, onJobPress, loading, strings }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colW = (width - 32 - 12) / 2;
  const s = { title: 'Remote jobs', subtitle: 'Work from home or anywhere', search: 'Search remote jobs', ...strings };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <StatusBar style="light" />
      <ScreenScroll>
        <View style={{ minHeight: insets.top + 160, overflow: 'hidden' }}>
          <LinearGradient colors={[colors.night, colors.deepTeal]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <Parallax rate={0.25} style={{ position: 'absolute', right: 0, top: 0 }}>
            <Circuit />
          </Parallax>
          <Parallax rate={-0.3} fade={220} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
            <RoundButton icon="back" label="Back" onPress={onBack} onDark />
            <Txt style={[ts.hero, { color: colors.white, marginTop: 10 }]} accessibilityRole="header">{s.title}</Txt>
            <Txt style={{ color: 'rgba(255,255,255,0.8)' }}>{s.subtitle}</Txt>
          </Parallax>
        </View>

        <View style={styles.sheet}>
          <SearchRow placeholder={s.search} onPress={onSearch} />
          <View style={{ paddingTop: 12, paddingBottom: 12 }}>
            <ResultBar countLabel={loading ? undefined : countLabel} onFilters={onFilters} onSort={onSort} />
            {loading ? <SkeletonBlock width="34%" height={ts.title.lineHeight} borderRadius={4} /> : null}
          </View>
          {loading ? (
            <RemoteGridSkeleton count={4} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {jobs.map((j) => (
                <Reveal key={j.id} style={{ width: colW }}>
                  <Press onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`}>
                    <Card style={{ padding: 8, marginBottom: 0 }}>
                      <View style={styles.thumb}>
                        {j.photo ? (
                          <Image source={j.photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <AppIcon name="laptop" size={24} color={colors.teal} />
                        )}
                      </View>
                      <Txt style={[ts.title, { fontSize: 13 }]} numberOfLines={1}>{j.title}</Txt>
                      <Txt style={ts.caption} numberOfLines={1}>{j.company}</Txt>
                      <Txt style={[ts.tag, { marginTop: 6 }]}>{j.pay}</Txt>
                    </Card>
                  </Press>
                </Reveal>
              ))}
            </View>
          )}
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  circuit: { width: 200, height: 130 },
  sheet: { marginTop: -20, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  thumb: {
    height: 74, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 8,
  },
});
