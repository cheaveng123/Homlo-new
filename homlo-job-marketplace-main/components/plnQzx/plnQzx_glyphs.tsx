import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { QZ, qzShadow } from './plnQzx_tokens';

const S = 28;          // glyph box
const K = S / 24;      // svg unit -> px

function Tile({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <View style={[st.tile, { backgroundColor: bg }, qzShadow]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: S, height: S }}>{children}</View>
    </View>
  );
}

/** Active jobs: deep-teal tile. Lid hops open and a sun dot pops out of the corner. */
export function QzJobsGlyph() {
  const rm = useReducedMotion();
  const lid = useSharedValue(0), dot = useSharedValue(rm ? 1 : 0);
  useEffect(() => {
    if (rm) return;
    lid.value = withRepeat(withSequence(
      withDelay(900, withTiming(1, { duration: 300 })), withTiming(1, { duration: 700 }), withTiming(0, { duration: 300 })), -1);
    dot.value = withRepeat(withSequence(
      withDelay(950, withTiming(1.4, { duration: 200 })), withTiming(1, { duration: 150 }), withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 200 }), withTiming(0, { duration: 200 })), -1);
    return () => { cancelAnimation(lid); cancelAnimation(dot); };
  }, [rm, lid, dot]);
  const lidA = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * lid.value }, { rotate: `${-12 * lid.value}deg` }] }));
  const dotA = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));
  const props = { width: S, height: S, viewBox: '0 0 24 24', fill: 'none', stroke: QZ.c.white, strokeWidth: 2.1, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Tile bg={QZ.c.deep}>
      <Svg {...props} style={StyleSheet.absoluteFill}>
        <Rect x={3} y={9} width={18} height={11} rx={3} fill="rgba(255,255,255,0.22)" />
        <Path d="M3 14h18" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, lidA]}>
        <Svg {...props}><Path d="M8.5 9V6.5A1.5 1.5 0 0 1 10 5h4a1.5 1.5 0 0 1 1.5 1.5V9" /></Svg>
      </Animated.View>
      <Animated.View style={[st.dot, dotA]} />
    </Tile>
  );
}

/** Job posts / month: sun tile. Two lines write onto the page while a deep plus badge swells. */
export function QzPostsGlyph() {
  const rm = useReducedMotion();
  const l1 = useSharedValue(rm ? 7 : 0), l2 = useSharedValue(rm ? 4.7 : 0), bump = useSharedValue(1);
  useEffect(() => {
    if (rm) return;
    l1.value = withRepeat(withSequence(withDelay(200, withTiming(7, { duration: 450 })), withTiming(7, { duration: 900 }), withTiming(0, { duration: 250 }), withTiming(0, { duration: 400 })), -1);
    l2.value = withRepeat(withSequence(withDelay(450, withTiming(4.7, { duration: 450 })), withTiming(4.7, { duration: 700 }), withTiming(0, { duration: 250 }), withTiming(0, { duration: 350 })), -1);
    bump.value = withRepeat(withSequence(withDelay(1100, withTiming(1.5, { duration: 200 })), withTiming(1, { duration: 200 }), withTiming(1, { duration: 700 })), -1);
    return () => { cancelAnimation(l1); cancelAnimation(l2); cancelAnimation(bump); };
  }, [rm, l1, l2, bump]);
  const a1 = useAnimatedStyle(() => ({ width: l1.value }));
  const a2 = useAnimatedStyle(() => ({ width: l2.value }));
  const ab = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return (
    <Tile bg={QZ.c.sun}>
      <Svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke={QZ.c.deep} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" style={StyleSheet.absoluteFill}>
        <Path d="M6 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="rgba(255,255,255,0.55)" />
      </Svg>
      <Animated.View style={[st.line, { left: 8 * K, top: 11 * K - 1.2 }, a1]} />
      <Animated.View style={[st.line, { left: 8 * K, top: 15 * K - 1.2 }, a2]} />
      <Animated.View style={[st.badge, ab]}>
        <Svg width={st.badge.width as number} height={st.badge.height as number} viewBox="13.4 13.4 9.2 9.2" fill="none" stroke={QZ.c.white} strokeWidth={2.1} strokeLinecap="round">
          <Path d="M18 15.8v4.4M15.8 18h4.4" />
        </Svg>
      </Animated.View>
    </Tile>
  );
}

const st = StyleSheet.create({
  tile: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 15.6 * K, top: 1.6 * K, width: 9, height: 9, borderRadius: 5, backgroundColor: QZ.c.sun, borderWidth: 1.5, borderColor: QZ.c.deep },
  line: { position: 'absolute', height: 2.4, borderRadius: 2, backgroundColor: QZ.c.deep },
  badge: { position: 'absolute', left: 13.4 * K, top: 13.4 * K, width: 10.7, height: 10.7, borderRadius: 6, backgroundColor: QZ.c.deep, alignItems: 'center', justifyContent: 'center' },
});
