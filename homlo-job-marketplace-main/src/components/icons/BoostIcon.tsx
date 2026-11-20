// Concept: boosting moves a job to the top of the list. The amber row rises from
// last place to first while the others step down, then two chevrons confirm "rank up".
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { kf, softFade, useLoop } from './loop';

const AG = Animated.createAnimatedComponent(G);

function Row({ y, fill, op = 1 }: { y: number; fill: string; op?: number }) {
  return (
    <>
      <Rect x={2} y={y} width={21} height={7} rx={3.5} fill={fill} opacity={op} />
      <Circle cx={7} cy={y + 3.5} r={1.8} fill="#fff" opacity={0.85} />
      <Rect x={11} y={y + 2.5} width={8} height={2} rx={1} fill="#fff" opacity={0.7} />
    </>
  );
}
const OP = [[0, 0], [0.08, 1], [0.78, 1], [0.9, 0], [1, 0]];

export function BoostIcon({ size = 34, delay = 0, replayKey = 0, active = true }: { size?: number; delay?: number; replayKey?: number; active?: boolean }) {
  const p = useLoop(delay, replayKey, active);
  const rise = useAnimatedProps(() => ({
    opacity: softFade(kf(p.value, OP)),
    transform: [{ translateY: kf(p.value, [[0, 19], [0.08, 19], [0.3, 0], [1, 0]]) }],
  }));
  const step = useAnimatedProps(() => ({
    opacity: softFade(kf(p.value, OP)),
    transform: [{ translateY: kf(p.value, [[0, -9.5], [0.08, -9.5], [0.3, 0], [1, 0]]) }],
  }));
  const step2 = useAnimatedProps(() => ({
    opacity: softFade(kf(p.value, OP)),
    transform: [{ translateY: kf(p.value, [[0, -9.5], [0.08, -9.5], [0.3, 0], [1, 0]]) }],
  }));
  const chev = useAnimatedProps(() => ({
    opacity: kf(p.value, [[0, 0], [0.28, 0], [0.4, 1], [0.78, 1], [0.9, 0], [1, 0]]),
    transform: [{ translateY: kf(p.value, [[0, 4], [0.28, 4], [0.4, 0], [0.9, -2], [1, -2]]) }],
  }));
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <AG animatedProps={step}><Row y={12.5} fill="#14324A" /></AG>
      <AG animatedProps={step2}><Row y={22} fill="#14324A" op={0.45} /></AG>
      <AG animatedProps={rise}><Row y={3} fill="#F5A524" /></AG>
      <AG animatedProps={chev}>
        <Path d="M25.2 8.2 28 5.4l2.8 2.8" fill="none" stroke="#0891B2" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M25.2 13 28 10.2l2.8 2.8" fill="none" stroke="#0891B2" strokeOpacity={0.5} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </AG>
    </Svg>
  );
}
