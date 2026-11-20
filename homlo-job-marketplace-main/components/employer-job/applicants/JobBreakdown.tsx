/**
 * "By job" card: a lit donut of applicant share with the total in the middle, then
 * one container per job (custom glyph tile, counts, new badge, share bar). Arcs
 * sweep in one after another; share bars fill as each container appears.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop, type CircleProps } from 'react-native-svg';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { SMOOTH } from '@/src/design/motion';
import type { ApplicationsPerJob } from '@/hooks/use-employer-applications';
import { ChevronGlyph, JobTileGlyph } from './ApplicantGlyphs';
import { RevealOnScroll } from '@/src/new/components/home/ScrollRevealNew';
import { AP, JOB_TILES, liftShadow } from './tokens';

const ACircle = Animated.createAnimatedComponent(Circle);
const SIZE = 168;
const THICK = 22;
const R = (SIZE - THICK) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 3; // px gap between slices so each reads as its own piece

function Slice({ ratio, start, color, delay }: { ratio: number; start: number; color: string; delay: number }) {
  const reduced = useReducedMotion();
  const len = Math.max(0, ratio * CIRC - GAP);
  const off = useSharedValue(reduced ? CIRC - len : CIRC);
  useEffect(() => {
    if (reduced) return;
    off.value = CIRC;
    off.value = withDelay(delay, withTiming(CIRC - len, { duration: 700, easing: SMOOTH }));
  }, [len, delay, reduced, off]);
  const props = useAnimatedProps<CircleProps>(() => ({ strokeDashoffset: off.value }));
  return (
    <ACircle
      cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color} strokeWidth={THICK} fill="none" strokeLinecap="butt"
      strokeDasharray={`${len} ${CIRC}`} rotation={-90 + start * 360} originX={SIZE / 2} originY={SIZE / 2}
      animatedProps={props}
    />
  );
}

function ShareBar({ ratio, colors, delay }: { ratio: number; colors: [string, string]; delay: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? ratio : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(delay, withTiming(ratio, { duration: 800, easing: SMOOTH }));
  }, [ratio, delay, reduced, p]);
  const a = useAnimatedStyle(() => ({ width: `${Math.max(0.03, p.value) * 100}%` }));
  return (
    <View style={st.track}>
      <Animated.View style={[st.fill, a]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function JobContainer({ entry, ratio, index, onPress }: { entry: ApplicationsPerJob; ratio: number; index: number; onPress: () => void }) {
  const tile = JOB_TILES[index % JOB_TILES.length];
  return (
    <RevealOnScroll index={index}>
      <PressableScaleNew onPress={onPress} scaleTo={0.98} accessibilityLabel={`${entry.jobTitle}, ${entry.total} applicants`} style={st.job}>
        <View style={[st.tile, liftShadow, { shadowColor: tile[1] }]}>
          <LinearGradient colors={tile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.tileRadius]} />
          <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }} style={[StyleSheet.absoluteFill, st.tileRadius]} />
          <JobTileGlyph size={24} variant={index} />
          <View style={st.rank}>
            <TextNew variant="caption" heading weight="extrabold" color={AP.navy} style={st.rankText}>{index + 1}</TextNew>
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={st.jobTop}>
            <TextNew variant="title" heading weight="bold" color={AP.navy} numberOfLines={1} style={{ flex: 1 }}>{entry.jobTitle}</TextNew>
            {entry.unread > 0 && (
              <View style={st.newPill}>
                <TextNew variant="caption" heading weight="extrabold" color={AP.amberDeep} style={st.newText}>{entry.unread} new</TextNew>
              </View>
            )}
          </View>
          <View style={st.jobMeta}>
            <ShareBar ratio={ratio} colors={tile} delay={250 + index * 90} />
            <TextNew variant="meta" heading weight="bold" color={AP.navy} style={st.count}>{entry.total}</TextNew>
            <TextNew variant="caption" color={AP.muted} style={st.pct}>{Math.round(ratio * 100)}%</TextNew>
          </View>
        </View>
        <ChevronGlyph />
      </PressableScaleNew>
    </RevealOnScroll>
  );
}

export function JobBreakdown({ entries, onOpenJob }: { entries: ApplicationsPerJob[]; onOpenJob: (jobId: string) => void }) {
  const total = entries.reduce((s, e) => s + e.total, 0);
  const ratios = entries.map((e) => (total > 0 ? e.total / total : 0));
  const newTotal = entries.reduce((s, e) => s + e.unread, 0);
  return (
    <View>
      <View style={st.donutRow}>
        <View style={{ width: SIZE, height: SIZE }}>
          {/* soft inner glow so the ring looks lit */}
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="donutGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0.45" stopColor={AP.tint} stopOpacity={0.9} />
                <Stop offset="0.7" stopColor={AP.tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="url(#donutGlow)" />
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={AP.bg} strokeWidth={THICK} fill="none" />
          </Svg>
          <Svg width={SIZE} height={SIZE}>
            {entries.map((e, i) => (
              <Slice
                key={e.jobId}
                ratio={ratios[i]}
                start={ratios.slice(0, i).reduce((s, v) => s + v, 0)}
                color={JOB_TILES[i % JOB_TILES.length][1]}
                delay={i * 120}
              />
            ))}
          </Svg>
          <View style={[StyleSheet.absoluteFill, st.center]} pointerEvents="none">
            <TextNew variant="hero" heading weight="extrabold" color={AP.navy} style={st.donutValue}>{total}</TextNew>
            <TextNew variant="caption" color={AP.muted}>applicant{total === 1 ? '' : 's'}</TextNew>
          </View>
        </View>
        <View style={st.sideStats}>
          <View>
            <TextNew variant="caption" color={AP.muted}>Jobs shown</TextNew>
            <TextNew variant="header" heading weight="extrabold" color={AP.navy}>{entries.length}</TextNew>
          </View>
          <View style={st.sideDivider} />
          <View>
            <TextNew variant="caption" color={AP.muted}>Still new</TextNew>
            <TextNew variant="header" heading weight="extrabold" color={AP.amberDeep}>{newTotal}</TextNew>
          </View>
        </View>
      </View>

      <View style={{ gap: 10, marginTop: 18 }}>
        {entries.map((e, i) => (
          <JobContainer key={e.jobId} entry={e} ratio={ratios[i]} index={i} onPress={() => onOpenJob(e.jobId)} />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  center: { alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontSize: 30, lineHeight: 34 },
  sideStats: { flex: 1, gap: 12 },
  sideDivider: { height: 1, backgroundColor: AP.line },
  job: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: AP.white,
    borderWidth: 1, borderColor: AP.line,
  },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileRadius: { borderRadius: 14 },
  rank: {
    position: 'absolute', top: -5, left: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: AP.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: AP.line,
  },
  rankText: { fontSize: 10, lineHeight: 12 },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newPill: { backgroundColor: '#FDF0D9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  newText: { fontSize: 11, lineHeight: 14 },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: AP.bg, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, overflow: 'hidden' },
  count: { minWidth: 18, textAlign: 'right' },
  pct: { width: 32, textAlign: 'right' },
});
