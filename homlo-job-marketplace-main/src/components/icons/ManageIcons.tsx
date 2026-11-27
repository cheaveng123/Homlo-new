import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { around, FADE, kf, POP, softFade, useLoop } from './loop';

const AG = Animated.createAnimatedComponent(G);
const AP = Animated.createAnimatedComponent(Path);
const AR = Animated.createAnimatedComponent(Rect);

export type ManageIconProps = { size?: number; surface?: string; delay?: number; replayKey?: number; active?: boolean };
const C = { cyan: '#0891B2', navy: '#14324A', amber: '#F5A524', coral: '#EF6A4C', violet: '#6A5FC1' };

// 1. Applications: the applicant lands on the clipboard, then the amber check stamps in.
export function ApplicationsIcon({ size = 48, surface = '#fff', delay = 0, replayKey = 0, active = true }: ManageIconProps) {
  const p = useLoop(delay, replayKey, active);
  const person = useAnimatedProps(() => ({
    opacity: kf(p.value, FADE),
    transform: [{ translateY: kf(p.value, [[0, 7], [0.06, 7], [0.24, 0], [1, 0]]) }],
  }));
  const badge = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.24, 0], [0.34, 1], [0.8, 1], [0.92, 0], [1, 0]]),
    transform: around(kf(p.value, POP), 31, 31),
  }));
  const check = useAnimatedProps(() => ({ strokeDashoffset: kf(p.value, [[0, 12], [0.34, 12], [0.48, 0], [1, 0]]) }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x={6} y={6} width={26} height={30} rx={5} fill={C.cyan} />
      <Rect x={9.5} y={10.5} width={19} height={22.5} rx={3} fill="#E3F4F8" />
      <Rect x={13} y={3.5} width={12} height={8} rx={2.8} fill={C.navy} />
      <AG animatedProps={person}>
        <Circle cx={19} cy={17.5} r={3.1} fill={C.cyan} />
        <Path d="M13 27c0-3.3 2.6-5.2 6-5.2s6 1.9 6 5.2Z" fill={C.cyan} />
        <Rect x={12.5} y={29.4} width={13} height={1.8} rx={0.9} fill="#8BD3E3" />
      </AG>
      <AG animatedProps={badge}>
        <Circle cx={31} cy={31} r={6.4} fill={C.amber} stroke={surface} strokeWidth={2} />
        <AP animatedProps={check} d="m28.2 31.2 2 2 3.7-4.1" fill="none" stroke="#fff" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="12" />
      </AG>
    </Svg>
  );
}

// 2. Closed jobs: the padlock shackle lifts, then snaps shut.
export function ClosedJobsIcon({ size = 48, delay = 0, replayKey = 0, active = true }: ManageIconProps) {
  const p = useLoop(delay, replayKey, active);
  const shackle = useAnimatedProps(() => ({
    transform: [{ translateY: kf(p.value, [[0, 0], [0.5, 0], [0.6, -3.5], [0.8, -3.5], [0.9, 0], [1, 0]]) }],
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M14.5 13.5V10.5A3.5 3.5 0 0 1 18 7h4a3.5 3.5 0 0 1 3.5 3.5v3" stroke={C.navy} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <Rect x={4} y={12} width={32} height={23} rx={4.8} fill={C.coral} />
      <Path d="M4 22.5h32v7.7a4.8 4.8 0 0 1-4.8 4.8H8.8A4.8 4.8 0 0 1 4 30.2Z" fill="#D4503A" />
      <Rect x={16} y={20.6} width={8} height={6.6} rx={2} fill="#FFE1AD" />
      <AG animatedProps={shackle}>
        <Path d="M18 20.8v-1.7a2 2 0 0 1 4 0v1.7" fill="none" stroke="#FFE1AD" strokeWidth={1.8} strokeLinecap="round" />
      </AG>
      <Circle cx={20} cy={23.9} r={1.1} fill="#D4503A" />
    </Svg>
  );
}

function useBarProps(p: SharedValue<number>, i: number) {
  return useAnimatedProps(() => {
    const q = (p.value + i * 0.024) % 1;
    return {
      opacity: softFade(kf(q, [[0, 0], [0.08, 1], [0.78, 1], [0.92, 0], [1, 0]])),
      transform: [{ translateY: 36 }, { scaleY: kf(q, [[0, 0.2], [0.26, 1], [1, 1]]) }, { translateY: -36 }],
    };
  });
}

// 3. Live jobs: bars climb in sequence, then the amber trend line draws across.
export function LiveJobsIcon({ size = 48, delay = 0, replayKey = 0, active = true }: ManageIconProps) {
  const p = useLoop(delay, replayKey, active);
  const b0 = useBarProps(p, 0);
  const b1 = useBarProps(p, 1);
  const b2 = useBarProps(p, 2);
  const arrow = useAnimatedProps(() => ({
    strokeDashoffset: kf(p.value, [[0, 44], [0.22, 44], [0.46, 0], [1, 0]]),
    opacity: kf(p.value, [[0, 1], [0.8, 1], [0.92, 0], [1, 0]]),
  }));
  const head = useAnimatedProps(() => ({ opacity: kf(p.value, [[0, 0], [0.4, 0], [0.48, 1], [0.8, 1], [0.92, 0], [1, 0]]) }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AR animatedProps={b0} x={5} y={23} width={8.5} height={13} rx={2.6} fill="#8BD3E3" />
      <AR animatedProps={b1} x={15.8} y={17} width={8.5} height={19} rx={2.6} fill="#2BB0CC" />
      <AR animatedProps={b2} x={26.5} y={10} width={8.5} height={26} rx={2.6} fill={C.cyan} />
      <AP animatedProps={arrow} d="M6 16 14 9.5l6.2 4.6L30 5" fill="none" stroke={C.amber} strokeWidth={3}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" />
      <AP animatedProps={head} d="M25 4.2h6.2v6.2" fill="none" stroke={C.amber} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 4. New applicants: two people slide together, then the coral "+" pops.
export function NewApplicantsIcon({ size = 48, surface = '#fff', delay = 0, replayKey = 0, active = true }: ManageIconProps) {
  const p = useLoop(delay, replayKey, active);
  const back = useAnimatedProps(() => ({
    opacity: softFade(kf(p.value, FADE)),
    transform: [{ translateX: kf(p.value, [[0, 9], [0.06, 9], [0.26, 0], [1, 0]]) }],
  }));
  const front = useAnimatedProps(() => ({
    opacity: softFade(kf(p.value, FADE)),
    transform: [{ translateX: kf(p.value, [[0, -9], [0.06, -9], [0.26, 0], [1, 0]]) }],
  }));
  const badge = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.24, 0], [0.34, 1], [0.8, 1], [0.92, 0], [1, 0]]),
    transform: around(kf(p.value, POP), 32.5, 7.5),
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <AG animatedProps={back}>
        <Circle cx={26.5} cy={14} r={5.3} fill={C.violet} />
        <Path d="M17.5 34v-3.6c0-4.5 3.7-7.6 9-7.6s9 3.1 9 7.6V34Z" fill={C.violet} />
      </AG>
      <AG animatedProps={front}>
        <Circle cx={15} cy={17} r={6} fill={C.cyan} stroke={surface} strokeWidth={2} />
        <Path d="M3.3 37v-4.4C3.3 27 8 23.8 15 23.8s11.7 3.2 11.7 8.8V37Z" fill={C.cyan} stroke={surface} strokeWidth={2} strokeLinejoin="round" />
      </AG>
      <AG animatedProps={badge}>
        <Circle cx={32.5} cy={7.5} r={5} fill={C.coral} stroke={surface} strokeWidth={2} />
        <Path d="M32.5 5v5M30 7.5h5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      </AG>
    </Svg>
  );
}
