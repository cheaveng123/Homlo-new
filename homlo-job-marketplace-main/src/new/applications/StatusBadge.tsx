import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { copy } from './copy';
import { mapBackendStatus, statusLabel } from './status';
import { colors, fonts, radii } from './theme';
import type { ApplicationStatus } from './types';

const TONES = {
  waiting: { bg: colors.cream, fg: colors.ink, chip: '#FFFFFF', border: colors.cream },
  accepted: { bg: colors.teal, fg: '#FFFFFF', chip: 'rgba(255,255,255,0.28)', border: colors.teal },
  declined: { bg: colors.page, fg: colors.muted, chip: '#FFFFFF', border: colors.border },
} as const;

function ClockFace({ rotate }: { rotate: boolean }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!rotate) return;
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [rotate, rot]);
  const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <View style={{ width: 12, height: 12 }}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Circle cx={6} cy={6} r={5} stroke={colors.ink} strokeWidth={1.3} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, hand]}>
        <View style={{ position: 'absolute', left: 5.35, top: 2.2, width: 1.3, height: 4, borderRadius: 1, backgroundColor: colors.ink }} />
      </Animated.View>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const reduced = useReducedMotion();
  const mapped: ApplicationStatus = mapBackendStatus(status);
  const t = TONES[mapped];
  const label = statusLabel(mapped);
  const [w, setW] = useState(0);
  const sweepX = useSharedValue(-40);
  const sweeps = mapped !== 'declined' && !reduced;

  useEffect(() => {
    if (!sweeps || w === 0) return;
    sweepX.value = -40;
    sweepX.value = withRepeat(
      withSequence(
        withTiming(w + 40, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withDelay(3200, withTiming(-40, { duration: 1 })),
      ),
      -1,
    );
    return () => cancelAnimation(sweepX);
  }, [sweeps, w, sweepX]);

  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweepX.value }, { rotate: '20deg' }] }));

  return (
    <View
      accessible
      accessibilityLabel={`${copy.statusPrefix}: ${label}`}
      style={[styles.outer, mapped === 'accepted' && styles.acceptedShadow]}
    >
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
        <View style={[styles.chip, { backgroundColor: t.chip }]}>
          {mapped === 'waiting' ? <ClockFace rotate={!reduced} />
            : mapped === 'accepted' ? <Icon name="check" size={12} color="#FFFFFF" strokeWidth={2} />
            : <Icon name="sunrise" size={12} color={colors.teal} strokeWidth={1.8} />}
        </View>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.text, { color: t.fg }]}>{label}</Text>
        {sweeps ? <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radii.badge, alignSelf: 'flex-start' },
  acceptedShadow: { shadowColor: colors.teal, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  badge: { height: 28, borderRadius: radii.badge, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 9, gap: 6, overflow: 'hidden' },
  chip: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  sweep: { position: 'absolute', top: -8, bottom: -8, left: 0, width: 16, backgroundColor: 'rgba(255,255,255,0.45)' },
});