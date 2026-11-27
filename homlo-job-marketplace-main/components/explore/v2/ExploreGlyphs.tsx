/**
 * Explore glyphs. Tab icons are flat two-tone concept icons (40 grid) with one small
 * story each, played only while their tab is active. Everything else is monochrome
 * slate utility art. Transparent SVG, no background shapes.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { EX } from './tokens';

/* ───────── shared 5s loop (static end state when inactive or Reduce Motion) ───────── */

function useLoop(active: boolean) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0.5);
  useEffect(() => {
    cancelAnimation(p);
    if (reduce || !active) { p.value = 0.5; return; }
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [active, reduce, p]);
  return p;
}
const kf = (p: SharedValue<number>, frames: number[][]) => {
  'worklet';
  return interpolate(p.value, frames.map((f) => f[0]), frames.map((f) => f[1]), Extrapolation.CLAMP);
};


/* ───────── utility glyphs (monochrome) ───────── */

type P = { size?: number; color?: string };

export function PinGlyph({ size = 22, color = EX.amberText }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a6.5 6.5 0 0 1 6.5 6.5c0 4.8-6.5 11-6.5 11s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function ChevronDown({ size = 16, color = EX.icon }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HeartOutline({ size = 22, color = EX.navy }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchGlyph({ size = 20, color = EX.navy }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.9} />
      <Path d="m16 16 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Filter: three tapering lines (funnel read). */
export function FilterGlyph({ size = 18, color = EX.amberText }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M7 12h10M10 17h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowRight({ size = 18, color = EX.navy }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SmallPin({ known = true }: { known?: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      {known ? (
        <>
          <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke={EX.slate} strokeWidth={1.5} />
          <Circle cx={8} cy={6.5} r={1.6} fill={EX.slate} />
        </>
      ) : (
        <>
          <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke="#8FA3AA" strokeWidth={1.5} strokeDasharray="2.2 1.8" />
          <Path d="M6.6 6a1.4 1.4 0 1 1 2 1.2c-.4.2-.6.5-.6 1M8 10v.1" stroke={EX.slate} strokeWidth={1.2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export function PersonGlyph({ taken }: { taken: boolean }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16">
      <Circle cx={8} cy={4.6} r={2.9} fill={taken ? EX.navy : 'none'} stroke={taken ? EX.navy : '#AAC3CB'} strokeWidth={taken ? 0 : 1.3} />
      <Path d="M2.4 14.2c0-3 2.3-5 5.6-5s5.6 2 5.6 5Z" fill={taken ? EX.navy : 'none'} stroke={taken ? EX.navy : '#AAC3CB'} strokeWidth={taken ? 0 : 1.3} />
    </Svg>
  );
}

export function AdMegaphone({ color = EX.amberText }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Path d="M2 6.2h3l5-3v9.6l-5-3H2Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M12 5.5a3 3 0 0 1 0 5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function PhotoGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={3} stroke="#6D8C97" strokeWidth={1.5} />
      <Path d="m4 17 5-5 4 4 3-3 4 4" stroke="#6D8C97" strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

/** Section-title icons: slate outline, soft parts at 28% opacity. */
export type SectionIconName = 'flame' | 'tray' | 'cup' | 'bag' | 'scooter' | 'desk' | 'building';
export function SectionIcon({ name }: { name: SectionIconName }) {
  const s = { stroke: EX.icon, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const soft = { fill: EX.icon, fillOpacity: 0.28 };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'flame' && (<>
        <Path {...s} d="M12 3c.6 4.5 6 6 6 11a6 6 0 0 1-12 0c0-2.6 1.4-4.2 3-5.5.4 1.8 1 2.5 1.8 3C11 10.5 11.5 6.5 12 3Z" />
        <Path {...soft} d="M12 14.5c1.3 1.3 2.2 2.1 2.2 3.5a2.2 2.2 0 0 1-4.4 0c0-1.4.9-2.2 2.2-3.5Z" />
      </>)}
      {name === 'tray' && (<>
        {/* hospitality: a service cloche */}
        <Path {...s} d="M4 17h16M5.5 17a6.5 6.5 0 0 1 13 0M12 8.5V7" />
        <Path {...soft} d="M7.5 17a4.5 4.5 0 0 1 9 0Z" />
      </>)}
      {name === 'cup' && (<>
        <Path {...s} d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z M16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16M8 4.5v2M11 3.5v3" />
        <Path {...soft} d="M6.5 13h8v1a3.5 3.5 0 0 1-3.5 3.5h-1A3.5 3.5 0 0 1 6.5 14Z" />
      </>)}
      {name === 'bag' && (<>
        <Path {...s} d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4ZM9 8V7a3 3 0 0 1 6 0v1" />
        <Path {...soft} d="M7.2 13h9.6l-.5 6H7.7Z" />
      </>)}
      {name === 'scooter' && (<>
        <Path {...s} d="M4 16.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M15 16.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M9 16.5h6l-2-8h3" />
        <Path {...soft} d="M4 11h6v3H4Z" />
      </>)}
      {name === 'desk' && (<>
        <Path {...s} d="M3.5 12h17M5 12v7M19 12v7M8 12V5.5h8V12" />
        <Path {...soft} d="M9.5 7h5v3.5h-5Z" />
      </>)}
      {name === 'building' && (<>
        <Path {...s} d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v15.5M15 10h3a1.5 1.5 0 0 1 1.5 1.5v9M3.5 20.5h17" />
        <Path {...soft} d="M8 7h4v3H8ZM8 12.5h4v3H8Z" />
      </>)}
    </Svg>
  );
}

/** Bell for the "didn't find it" banner: the bell body rings once per loop. */
export function BellArt({ active = true }: { active?: boolean }) {
  const p = useLoop(active);
  const ring = useAnimatedStyle(() => ({
    transform: [{ rotate: `${kf(p, [[0, 0], [0.6, 0], [0.64, 14], [0.68, -12], [0.72, 9], [0.76, -6], [0.8, 0], [1, 0]])}deg` }],
  }));
  return (
    <View style={{ width: 64, height: 64 }}>
      <Animated.View style={[{ position: 'absolute', width: 64, height: 64, transformOrigin: '50% 15%' }, ring]}>
        <Svg width={64} height={64} viewBox="0 0 40 40">
          <Path d="M20 6c-6 0-9 4-9 9v6l-3 4h24l-3-4v-6c0-5-3-9-9-9Z" fill="#FFF1D6" />
        </Svg>
      </Animated.View>
      <Svg width={64} height={64} viewBox="0 0 40 40" style={{ position: 'absolute' }}>
        <Path d="M16 31a4 4 0 0 0 8 0Z" fill={EX.amber} />
      </Svg>
    </View>
  );
}
