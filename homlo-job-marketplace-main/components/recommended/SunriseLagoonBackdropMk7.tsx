// SunriseLagoonBackdropMk7.tsx
// Animated background for the Homlo Jobs "Recommended" banner (Lagoon & Sunrise).
// Mobile only (Expo / React Native). Needs: react-native-reanimated, react-native-svg.
// It fills whatever container it is placed in and scales from that container's measured
// size, so it never renders "small". Contains NO character and NO text.

import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type SunriseVariant = 0 | 1 | 2; // 0 café (amber), 1 delivery (gold), 2 office (aqua)

export type SunriseLagoonBackdropMk7Props = {
  /** Controlled sun color. If omitted, use autoCycle or it stays on 0. */
  variant?: SunriseVariant;
  /** Cycle the sun color by itself (ignored when `variant` is passed). */
  autoCycle?: boolean;
  cycleMs?: number;
  onCycle?: (v: SunriseVariant) => void;
  /** Colour of the curved bottom edge. Must equal the screen background below the banner. */
  edgeColor?: string;
  showEdge?: boolean;
  style?: ViewStyle;
};

const SUNS: [string, string][] = [
  ['#FFD98A', '#F29B3C'],
  ['#FFF0A8', '#F5B52B'],
  ['#E8FFFB', '#7FD6D2'],
];

// 8 segments x 100 = 800 wide, period 200, so shifting by half (400) loops seamlessly.
const WAVE_D = 'M0 30 q50 -26 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 V70 H0 Z';

function SunDisc({ d, left, top, colors, on, id }: { d: number; left: number; top: number; colors: [string, string]; on: boolean; id: string }) {
  const o = useSharedValue(on ? 0.95 : 0);
  useEffect(() => {
    o.value = withTiming(on ? 0.95 : 0, { duration: 1600, easing: Easing.inOut(Easing.quad) });
  }, [on, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, width: d, height: d }, s]}>
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={id} cx="40%" cy="35%" r="70%">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </RadialGradient>
        </Defs>
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Ring({ clock, phase, d, left, top }: { clock: SharedValue<number>; phase: number; d: number; left: number; top: number }) {
  const s = useAnimatedStyle(() => {
    const p = (clock.value + phase) % 1;
    return { opacity: 0.6 * (1 - p), transform: [{ scale: 0.9 + 1.4 * p }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left, top, width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }, s]}
    />
  );
}

function Dot({ clock, phase, x, y, r }: { clock: SharedValue<number>; phase: number; x: number; y: number; r: number }) {
  const s = useAnimatedStyle(() => {
    const a = (clock.value + phase) * Math.PI * 2;
    return { transform: [{ translateX: Math.sin(a) * 8 }, { translateY: -9 * (1 - Math.cos(a)) }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#fff', opacity: 0.22 }, s]}
    />
  );
}

export default function SunriseLagoonBackdropMk7({
  variant,
  autoCycle = false,
  cycleMs = 5600,
  onCycle,
  edgeColor = '#F4F8F8',
  showEdge = true,
  style,
}: SunriseLagoonBackdropMk7Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [auto, setAuto] = useState<SunriseVariant>(0);
  const idx = useRef(0);
  const active: SunriseVariant = variant ?? auto;

  const clock = useSharedValue(0);
  const waveA = useSharedValue(0);
  const waveB = useSharedValue(-1);

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    waveA.value = withRepeat(withTiming(-1, { duration: 18000, easing: Easing.linear }), -1, false);
    waveB.value = withRepeat(withTiming(0, { duration: 26000, easing: Easing.linear }), -1, false);
  }, [clock, waveA, waveB]);

  useEffect(() => {
    if (!autoCycle || variant !== undefined) return;
    const t = setInterval(() => {
      idx.current = (idx.current + 1) % 3;
      setAuto(idx.current as SunriseVariant);
      onCycle?.(idx.current as SunriseVariant);
    }, cycleMs);
    return () => clearInterval(t);
  }, [autoCycle, cycleMs, variant, onCycle]);

  const { w, h } = size;
  const waveAStyle = useAnimatedStyle(() => ({ transform: [{ translateX: waveA.value * w }] }));
  const waveBStyle = useAnimatedStyle(() => ({ transform: [{ translateX: waveB.value * w }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // All geometry is proportional to the measured container.
  const d = w * 0.56;
  const cx = w * 0.7;
  const cy = h * 0.42;
  const left = cx - d / 2;
  const top = cy - d / 2;
  const waveH = Math.max(w * 0.2, 60);
  const edgeH = Math.max(w * 0.11, 34);

  return (
    <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      {w > 0 && h > 0 && (
        <>
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="mk7bg" x1="0.15" y1="0" x2="0.85" y2="1">
                <Stop offset="0" stopColor="#15A0AA" />
                <Stop offset="0.5" stopColor="#0E7C86" />
                <Stop offset="1" stopColor="#09535C" />
              </LinearGradient>
            </Defs>
            <Rect width={w} height={h} fill="url(#mk7bg)" />
          </Svg>

          {SUNS.map((c, k) => (
            <SunDisc key={k} id={`mk7sun${k}`} d={d} left={left} top={top} colors={c} on={active === k} />
          ))}
          <Ring clock={clock} phase={0} d={d} left={left} top={top} />
          <Ring clock={clock} phase={1 / 3} d={d} left={left} top={top} />
          <Ring clock={clock} phase={2 / 3} d={d} left={left} top={top} />

          <Dot clock={clock} phase={0} x={w * 0.38} y={h * 0.19} r={4} />
          <Dot clock={clock} phase={0.33} x={w * 0.08} y={h * 0.68} r={3} />
          <Dot clock={clock} phase={0.55} x={w * 0.87} y={h * 0.13} r={5} />
          <Dot clock={clock} phase={0.78} x={w * 0.31} y={h * 0.74} r={4.5} />
          <Dot clock={clock} phase={0.2} x={w * 0.94} y={h * 0.65} r={3} />

          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: edgeH * 0.7, width: w * 2, height: waveH }, waveAStyle]}>
            <Svg width={w * 2} height={waveH} viewBox="0 0 800 70" preserveAspectRatio="none">
              <Path d={WAVE_D} fill="#0A626B" opacity={0.6} />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: edgeH * 0.35, width: w * 2, height: waveH }, waveBStyle]}>
            <Svg width={w * 2} height={waveH} viewBox="0 0 800 70" preserveAspectRatio="none">
              <Path d={WAVE_D} fill="#073B42" opacity={0.55} />
            </Svg>
          </Animated.View>

          {showEdge && (
            <Svg width={w} height={edgeH} viewBox="0 0 390 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: -1 }}>
              <Path d="M0 20c40-24 80-24 130-8s90 22 140 6 80-20 120-6v28H0z" fill={edgeColor} />
            </Svg>
          )}
        </>
      )}
    </View>
  );
}
