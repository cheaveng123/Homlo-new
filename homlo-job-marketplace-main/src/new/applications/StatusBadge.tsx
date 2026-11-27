import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { copy } from './copy';
import { mapBackendStatus, statusLabel } from './status';
import { colors, fonts, radii } from './theme';
import type { ApplicationStatus } from './types';

/**
 * Status tones. Each state gets a soft tinted pill, a solid icon disc and a
 * matching outline, so Waiting and Accepted read at a glance without relying on
 * the label alone. Colours come from the Lagoon & Sunrise tokens only.
 */
export const STATUS_TONES: Record<ApplicationStatus, { bg: string; border: string; fg: string; disc: string; discFg: string }> = {
  waiting: { bg: colors.cream, border: '#F6D9A0', fg: colors.ink, disc: colors.sun, discFg: colors.white },
  accepted: { bg: colors.tint, border: colors.tint2, fg: colors.deep, disc: colors.teal, discFg: colors.white },
  declined: { bg: colors.page, border: colors.border, fg: colors.muted, disc: colors.track, discFg: colors.muted },
};

const SIZES = {
  md: { height: 28, disc: 18, icon: 11, font: 12, line: 16, padL: 4, padR: 10, gap: 6 },
  sm: { height: 22, disc: 14, icon: 9, font: 11, line: 14, padL: 3, padR: 8, gap: 5 },
} as const;

function ClockFace({ size, color, rotate }: { size: number; color: string; rotate: boolean }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!rotate) return;
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [rotate, rot]);
  const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const r = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={r} cy={r} r={r - 0.8} stroke={color} strokeWidth={1.3} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, hand]}>
        <View style={{ position: 'absolute', left: r - 0.65, top: size * 0.2, width: 1.3, height: r * 0.8, borderRadius: 1, backgroundColor: color }} />
      </Animated.View>
    </View>
  );
}

/** Icon for a status, drawn on its tone's disc colour. Shared by the pill and the filter chips. */
export function StatusGlyph({ status, size, color, animate = true }: { status: ApplicationStatus; size: number; color: string; animate?: boolean }) {
  const reduced = useReducedMotion();
  if (status === 'waiting') return <ClockFace size={size} color={color} rotate={animate && !reduced} />;
  if (status === 'accepted') return <Icon name="check" size={size} color={color} strokeWidth={2.4} />;
  return <Icon name="close" size={size} color={color} strokeWidth={2.2} />;
}

/**
 * Application status pill: tinted capsule, solid icon disc, label. Accepts a
 * raw backend status (`applied`, `hired`, ...) or an already-mapped state.
 */
export function StatusBadge({ status, size = 'md' }: { status: string; size?: keyof typeof SIZES }) {
  const mapped: ApplicationStatus = mapBackendStatus(status);
  const t = STATUS_TONES[mapped];
  const s = SIZES[size];
  const label = statusLabel(mapped);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${copy.statusPrefix}: ${label}`}
      style={[
        styles.badge,
        { height: s.height, paddingLeft: s.padL, paddingRight: s.padR, gap: s.gap, backgroundColor: t.bg, borderColor: t.border },
      ]}
    >
      <View style={[styles.disc, { width: s.disc, height: s.disc, borderRadius: s.disc / 2, backgroundColor: t.disc }]}>
        <StatusGlyph status={mapped} size={s.icon} color={t.discFg} />
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.text, { color: t.fg, fontSize: s.font, lineHeight: s.line }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.semibold, letterSpacing: 0.1 },
});
