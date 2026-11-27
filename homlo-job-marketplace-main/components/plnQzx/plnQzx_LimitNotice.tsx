/**
 * Banner shown at the top of Account plans when an employer was sent there after hitting
 * a plan limit while publishing. Says which limit was reached (with a full usage meter)
 * and which plan lifts it. Presentational only.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { QzText } from './plnQzx_bits';
import { QZ } from './plnQzx_tokens';
import { SMOOTH } from '@/src/design/motion';

/** Gauge at full: arc + needle pinned to the right, amber tip. */
function LimitGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M4 16a8 8 0 0 1 16 0" stroke={QZ.c.white} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 16l5.2-4.6" stroke={QZ.c.white} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={16} r={1.8} fill={QZ.c.white} />
      <Circle cx={19.4} cy={10.8} r={2} fill={QZ.c.sun} />
    </Svg>
  );
}

export function PlanLimitNotice({ planName, requiredName, reason, limit }: {
  planName: string; requiredName: string; reason: 'active' | 'posts'; limit?: number;
}) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) fill.value = withDelay(250, withTiming(1, { duration: 900, easing: SMOOTH }));
  }, [reduced, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const what = reason === 'posts' ? 'job posts this month' : 'active jobs';
  const usage = limit ? `${limit} / ${limit} ${what}` : `All ${what} used`;

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(380)} style={st.card} accessibilityRole="alert">
      <View style={st.row}>
        <View style={st.icon}><LimitGlyph /></View>
        <View style={{ flex: 1 }}>
          <QzText v="lead" color={QZ.c.white}>You&apos;ve reached your {planName} plan limit</QzText>
          <QzText v="small" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
            Upgrade to {requiredName} to publish this job. Your listing is kept, so you can go back and finish it any time.
          </QzText>
        </View>
      </View>
      <View style={st.meterHead}>
        <QzText v="tiny" color="rgba(255,255,255,0.8)">{planName} plan</QzText>
        <QzText v="tiny" color={QZ.c.white}>{usage}</QzText>
      </View>
      <View style={st.track}><Animated.View style={[st.fill, bar]} /></View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: QZ.c.deep, borderRadius: QZ.r.card, padding: QZ.sp.lg, marginBottom: QZ.sp.xl, gap: QZ.sp.md },
  row: { flexDirection: 'row', gap: QZ.sp.md, alignItems: 'flex-start' },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: QZ.c.sun },
});
