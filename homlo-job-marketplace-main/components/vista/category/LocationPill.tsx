// Small round location pill with a 1.5 px outline. A warm orange highlight
// (#FFC765 tail into #F5A524) travels around the light grey outline, one lap
// every 4 s, linear. Drawn as SVG strokes whose dash offset moves along the
// pill's perimeter. No glow, blur or shadow.
// Reduced motion: no loop, plain grey outline.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { smooth } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import { ChevronDownGlyph } from './glyphs';
import { AP, F, LINE } from './tokens';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const STROKE = 1.5;

function MiniMap() {
  return (
    <View style={s.map}>
      <Svg width={26} height={26} viewBox="0 0 46 46">
        <Path d="M0 33c9-3 12-9 21-9s12 7 25 3" fill="none" stroke={AP.cyan} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        <Path d="M13 0v46M31 0v46M0 12h46" stroke={AP.navy} strokeWidth={1} opacity={0.18} />
        <Path d="M23 30s8-6 8-12a8 8 0 10-16 0c0 6 8 12 8 12z" fill={AP.amber} />
        <Circle cx={23} cy={18} r={3} fill="#fff" />
      </Svg>
    </View>
  );
}

/** Outline + travelling highlight, sized to the measured pill. */
function SunOutline({ w, h, animate }: { w: number; h: number; animate: boolean }) {
  const progress = useSharedValue(0);
  const x = STROKE / 2;
  const rw = w - STROKE;
  const rh = h - STROKE;
  const r = rh / 2;
  const perim = 2 * (rw - rh) + Math.PI * rh;
  const tail = perim * 0.3; // soft #FFC765 lead-in
  const head = perim * 0.14; // brighter #F5A524 front

  useEffect(() => {
    if (!animate) {
      cancelAnimation(progress);
      return;
    }
    progress.set(0);
    progress.set(withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [animate, progress]);

  // The head sits at the front end of the tail; both move together.
  const tailProps = useAnimatedProps(() => ({ strokeDashoffset: -progress.value * perim }));
  const headProps = useAnimatedProps(() => ({ strokeDashoffset: -progress.value * perim - (tail - head) }));

  return (
    <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={x} y={x} width={rw} height={rh} rx={r} ry={r} fill="none" stroke={LINE} strokeWidth={STROKE} />
      {animate ? (
        <>
          <AnimatedRect
            x={x} y={x} width={rw} height={rh} rx={r} ry={r} fill="none"
            stroke={AP.amberSoft} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={[tail, perim - tail]} animatedProps={tailProps}
          />
          <AnimatedRect
            x={x} y={x} width={rw} height={rh} rx={r} ry={r} fill="none"
            stroke={AP.amber} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={[head, perim - head]} animatedProps={headProps}
          />
        </>
      ) : null}
    </Svg>
  );
}

type Props = { area?: string; city: string; onPress: () => void };

export function LocationPill({ area, city, onPress }: Props) {
  const reduce = useReducedMotion();
  const press = useSharedValue(1);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
  };

  return (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }}
      onPressIn={() => { press.set(smooth(0.97, 160)); }}
      onPressOut={() => { press.set(smooth(1, 200)); }}
      accessibilityRole="button"
      accessibilityLabel={`Choose area. Current: ${area ?? `all of ${city}`}`}
      hitSlop={6}
      style={s.hit}
    >
      <Animated.View style={[s.pill, scale]} onLayout={onLayout}>
        <MiniMap />
        <Text style={s.area}>{area ?? city}</Text>
        <Text style={s.city}>{area ? city : 'all areas'}</Text>
        <ChevronDownGlyph size={16} color={AP.navy} />
        {size ? <SunOutline w={size.w} h={size.h} animate={!reduce} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hit: { alignSelf: 'flex-start', marginBottom: 12, minHeight: 44, justifyContent: 'center' },
  pill: {
    height: 34, borderRadius: 999, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingLeft: 4 + STROKE, paddingRight: 10 + STROKE,
  },
  map: { width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: AP.tint },
  area: { fontFamily: F.hb, fontSize: 13, color: AP.navy },
  city: { fontFamily: F.m, fontSize: 12.5, color: AP.muted },
});
