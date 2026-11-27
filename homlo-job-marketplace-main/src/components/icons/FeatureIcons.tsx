// Tier A feature icons for empty, success and error states. 40x40, flat multi-tone,
// cyan + navy with one amber accent, each with a 5s narrative loop (see loop.ts).
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { around, FADE, kf, POP, softFade, useLoop } from './loop';

const AG = Animated.createAnimatedComponent(G);
const AP = Animated.createAnimatedComponent(Path);
const C = { cyan: '#0891B2', navy: '#14324A', amber: '#F5A524', soft: '#8BD3E3', paper: '#E3F4F8', coral: '#EF6A4C' };

export type FeatureIconProps = { size?: number; surface?: string; delay?: number; replayKey?: number; active?: boolean };

// No results: a job card slides under the magnifier, then an amber "?" pops.
export function NoResultsIcon({ size = 56, surface = '#fff', delay = 0, replayKey = 0, active = true }: FeatureIconProps) {
  const p = useLoop(delay, replayKey, active);
  const card = useAnimatedProps(() => ({ opacity: softFade(kf(p.value, FADE)), transform: [{ translateX: kf(p.value, [[0, -8], [0.06, -8], [0.26, 0], [1, 0]]) }] }));
  const badge = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.26, 0], [0.36, 1], [0.8, 1], [0.92, 0], [1, 0]]),
    transform: around(kf(p.value, POP), 31, 9),
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AG animatedProps={card}>
        <Rect x={3} y={8} width={22} height={16} rx={3.5} fill={C.paper} />
        <Rect x={6} y={12} width={6} height={8} rx={2} fill={C.soft} />
        <Rect x={14} y={13} width={8} height={2} rx={1} fill={C.navy} opacity={0.55} />
        <Rect x={14} y={17} width={5} height={2} rx={1} fill={C.navy} opacity={0.3} />
      </AG>
      <Circle cx={21} cy={21} r={9} fill="none" stroke={C.cyan} strokeWidth={3.4} />
      <Path d="m27.6 27.6 7 7" stroke={C.navy} strokeWidth={4} strokeLinecap="round" />
      <AG animatedProps={badge}>
        <Circle cx={31} cy={9} r={6} fill={C.amber} stroke={surface} strokeWidth={2} />
        <Path d="M29.3 7.6a1.8 1.8 0 1 1 2.5 1.6c-.6.3-.8.6-.8 1.2" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
        <Circle cx={31} cy={12.2} r={0.9} fill="#fff" />
      </AG>
    </Svg>
  );
}

// Empty inbox: a letter drops into the tray, then the amber dot pings.
export function EmptyInboxIcon({ size = 56, surface = '#fff', delay = 0, replayKey = 0, active = true }: FeatureIconProps) {
  const p = useLoop(delay, replayKey, active);
  const letter = useAnimatedProps(() => ({ opacity: softFade(kf(p.value, FADE)), transform: [{ translateY: kf(p.value, [[0, -9], [0.06, -9], [0.26, 0], [1, 0]]) }] }));
  const dot = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.26, 0], [0.36, 1], [0.8, 1], [0.92, 0], [1, 0]]),
    transform: around(kf(p.value, POP), 32, 8),
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AG animatedProps={letter}>
        <Rect x={10} y={6} width={20} height={16} rx={3} fill={C.paper} />
        <Path d="m11 8 9 7 9-7" fill="none" stroke={C.cyan} strokeWidth={2} strokeLinejoin="round" />
      </AG>
      <Path d="M4 21.5 8.2 15h23.6l4.2 6.5V32a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill={C.cyan} />
      <Path d="M4 21.5h9.5a6.5 6.5 0 0 0 13 0H36V32a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill={C.navy} />
      <AG animatedProps={dot}>
        <Circle cx={32} cy={8} r={4.6} fill={C.amber} stroke={surface} strokeWidth={2} />
      </AG>
    </Svg>
  );
}

// Success: the circle fills, the check draws, then a soft settle.
export function SuccessIcon({ size = 56, delay = 0, replayKey = 0, active = true }: FeatureIconProps) {
  const p = useLoop(delay, replayKey, active);
  const ring = useAnimatedProps(() => ({ transform: around(kf(p.value, [[0, 0.6], [0.2, 1.06], [0.3, 1], [1, 1]]), 20, 20), opacity: softFade(kf(p.value, FADE)) }));
  const check = useAnimatedProps(() => ({ strokeDashoffset: kf(p.value, [[0, 22], [0.24, 22], [0.42, 0], [1, 0]]) }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AG animatedProps={ring}>
        <Circle cx={20} cy={20} r={16} fill={C.cyan} />
        <Circle cx={20} cy={20} r={16} fill="none" stroke={C.navy} strokeOpacity={0.18} strokeWidth={3} />
        <AP animatedProps={check} d="m12.5 20.5 5 5 10-11" fill="none" stroke="#fff" strokeWidth={3.4}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22" />
      </AG>
      <Circle cx={33} cy={8} r={2.6} fill={C.amber} />
    </Svg>
  );
}

// Error: a warning card tilts in, then the amber "!" pops.
export function ErrorStateIcon({ size = 56, surface = '#fff', delay = 0, replayKey = 0, active = true }: FeatureIconProps) {
  const p = useLoop(delay, replayKey, active);
  const card = useAnimatedProps(() => ({ opacity: softFade(kf(p.value, FADE)), transform: [{ translateY: kf(p.value, [[0, 6], [0.06, 6], [0.26, 0], [1, 0]]) }] }));
  const badge = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.26, 0], [0.36, 1], [0.8, 1], [0.92, 0], [1, 0]]),
    transform: around(kf(p.value, POP), 29, 28),
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AG animatedProps={card}>
        <Rect x={4} y={6} width={26} height={24} rx={4.5} fill={C.cyan} />
        <Rect x={4} y={6} width={26} height={7} rx={3.5} fill={C.navy} />
        <Circle cx={8.5} cy={9.5} r={1.2} fill="#fff" />
        <Circle cx={12.5} cy={9.5} r={1.2} fill="#fff" opacity={0.6} />
        <Rect x={9} y={18} width={16} height={2.2} rx={1.1} fill={C.paper} />
        <Rect x={9} y={23} width={10} height={2.2} rx={1.1} fill={C.paper} opacity={0.7} />
      </AG>
      <AG animatedProps={badge}>
        <Circle cx={29} cy={28} r={7} fill={C.amber} stroke={surface} strokeWidth={2} />
        <Path d="M29 24.6v4.2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
        <Circle cx={29} cy={31.4} r={1.2} fill="#fff" />
      </AG>
    </Svg>
  );
}
