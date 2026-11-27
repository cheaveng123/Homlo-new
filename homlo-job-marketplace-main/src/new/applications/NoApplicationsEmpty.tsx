import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { PressableScale } from './PressableScale';
import { colors, fonts, radii } from './theme';

/**
 * Original "no applications" illustration: an empty in-tray with one blank
 * application card hovering above it, a sun spark and a soft lagoon backdrop.
 * Line weight follows the house icon style (rounded caps and joins).
 * Exported so employer-side empty states can reuse the same art.
 */
export function NoApplicationsArt({ size = 120, float = true }: { size?: number; float?: boolean }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!float || reduced) return;
    // Smooth hover, no bounce: a slow sine between 0 and -4.
    y.value = withRepeat(withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(y);
  }, [float, reduced, y]);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Backdrop + tray (static) */}
      <Svg width={size} height={size} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
        <Circle cx={60} cy={60} r={54} fill={colors.tint} />
        <Circle cx={60} cy={60} r={42} fill={colors.white} opacity={0.55} />
        <Ellipse cx={60} cy={98} rx={30} ry={4} fill={colors.track} />
        {/* tray */}
        <Path d="M28 74h16l4 8h24l4-8h16v14a4 4 0 01-4 4H32a4 4 0 01-4-4z" fill={colors.white} stroke={colors.deep} strokeWidth={2.2} strokeLinejoin="round" />
        <Path d="M28 74l7-14h50l7 14" fill="none" stroke={colors.deep} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {/* sun spark */}
        <Path d="M96 26v8M92 30h8" stroke={colors.sun} strokeWidth={2.4} strokeLinecap="round" />
        <Circle cx={22} cy={40} r={3} fill={colors.tint2} />
      </Svg>
      {/* Blank application card hovering over the tray */}
      <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Rect x={40} y={22} width={40} height={46} rx={6} fill={colors.white} stroke={colors.deep} strokeWidth={2.2} />
          <Circle cx={51} cy={34} r={5} fill={colors.tint} stroke={colors.teal} strokeWidth={1.8} />
          <Path d="M60 32h12M60 37h8" stroke={colors.tint2} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M47 48h26M47 54h26M47 60h16" stroke={colors.track} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Empty state for every applications list: illustration, short title, subtitle, optional action. */
export function NoApplicationsEmpty({ title, body, actionLabel, onAction, compact = false }: {
  title: string; body?: string; actionLabel?: string; onAction?: () => void; compact?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(400)}
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="summary"
    >
      <NoApplicationsArt size={compact ? 96 : 128} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} accessibilityRole="button" style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24, gap: 6 },
  wrapCompact: { paddingTop: 24 },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 26, color: colors.deep, textAlign: 'center', marginTop: 10 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  btn: { height: 48, paddingHorizontal: 28, borderRadius: radii.pill, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});
