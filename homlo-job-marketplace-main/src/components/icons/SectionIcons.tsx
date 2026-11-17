// Tier B icons for section titles and key facts. 24x24, flat two-tone (cyan + navy)
// with exactly one amber accent, or `tone="mono"` (plain slate) for titles. Each one plays a one-shot entrance when it mounts:
// the body settles in, then its accent pops. Static under Reduce Motion.
import React, { useEffect } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { around, kf } from './loop';

const AG = Animated.createAnimatedComponent(G);
type Pal = { cyan: string; soft: string; tint: string; navy: string; amber: string };
/** color: cyan + navy with one amber accent. mono: plain slate, for section titles (calm, professional). */
const PALETTES: Record<'color' | 'mono', Pal> = {
  color: { cyan: '#0891B2', soft: '#8BD3E3', tint: '#DCF1F6', navy: '#14324A', amber: '#F5A524' },
  mono: { cyan: '#5B6E76', soft: '#B9C5CA', tint: 'transparent', navy: '#2C3E46', amber: '#2C3E46' },
};

function useOnce(delay: number, replayKey: number) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { t.value = 1; return; }
    t.value = 0;
    t.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [delay, replayKey, reduce, t]);
  return t;
}

/** Body: fades in and rises 3pt during the first 45%. */
function Body({ t, children }: { t: SharedValue<number>; children: React.ReactNode }) {
  const ap = useAnimatedProps(() => ({ opacity: kf(t.value, [[0, 0], [0.45, 1], [1, 1]]), transform: [{ translateY: kf(t.value, [[0, 3], [0.45, 0], [1, 0]]) }] }));
  return <AG animatedProps={ap}>{children}</AG>;
}
/** Accent: settles 0.6 -> 1 around (x, y) after the body lands (no overshoot). */
function Accent({ t, x, y, children }: { t: SharedValue<number>; x: number; y: number; children: React.ReactNode }) {
  const ap = useAnimatedProps(() => ({
    opacity: kf(t.value, [[0, 0], [0.35, 0], [0.7, 1], [1, 1]]),
    transform: around(kf(t.value, [[0, 0.6], [0.35, 0.6], [1, 1]]), x, y),
  }));
  return <AG animatedProps={ap}>{children}</AG>;
}

type Art = (t: SharedValue<number>, C: Pal) => React.ReactNode;

const ART = {
  // Style (from the Popular flame): one solid silhouette (C.cyan) + one darker inner
  // shape (C.amber, the accent) + white cut-outs. No thin outlines.
  // Job field: three solid category tiles, the fourth a darker round tile.
  jobField: (t, C) => (<>
    <Body t={t}>
      <Rect x={3} y={3} width={8} height={8} rx={2.5} fill={C.cyan} />
      <Rect x={13} y={3} width={8} height={8} rx={2.5} fill={C.cyan} />
      <Rect x={3} y={13} width={8} height={8} rx={2.5} fill={C.cyan} />
    </Body>
    <Accent t={t} x={17} y={17}><Rect x={13} y={13} width={8} height={8} rx={4} fill={C.amber} /></Accent>
  </>),
  // Job type: a solid clock face with white hands and a darker hub.
  jobType: (t, C) => (<>
    <Body t={t}>
      <Circle cx={12} cy={12} r={9.5} fill={C.cyan} />
      <Path d="M12 6.8V12l3.4 2.1" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Body>
    <Accent t={t} x={12} y={12}><Circle cx={12} cy={12} r={2.2} fill={C.amber} stroke="#fff" strokeWidth={1.2} /></Accent>
  </>),
  // Recommended: a solid job card with white lines; a darker star badge.
  recommended: (t, C) => (<>
    <Body t={t}>
      <Rect x={2.5} y={6} width={15.5} height={14.5} rx={3.5} fill={C.cyan} />
      <Rect x={5.5} y={10} width={4.5} height={6.5} rx={1.4} fill="#fff" />
      <Path d="M12.5 11h3M12.5 14.5h2.2" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={18} y={6}>
      <Path d="m18 1.6 1.4 2.8 3.1.5-2.2 2.2.5 3.1L18 8.7l-2.8 1.5.5-3.1-2.2-2.2 3.1-.5Z" fill={C.amber} stroke="#fff" strokeWidth={1.2} strokeLinejoin="round" />
    </Accent>
  </>),
  // Jobs near you: a solid pin with a white eye, standing on a darker ground oval.
  nearby: (t, C) => (<>
    <Accent t={t} x={12} y={20.3}><Path d="M6 20.3c0-1 2.7-1.9 6-1.9s6 .9 6 1.9-2.7 1.9-6 1.9-6-.9-6-1.9Z" fill={C.amber} /></Accent>
    <Body t={t}>
      <Path d="M12 2.2a6.8 6.8 0 0 0-6.8 6.8c0 4.8 6.8 10.6 6.8 10.6s6.8-5.8 6.8-10.6A6.8 6.8 0 0 0 12 2.2Z" fill={C.cyan} stroke="#fff" strokeWidth={1} />
      <Circle cx={12} cy={9} r={2.5} fill="#fff" />
    </Body>
  </>),
  // Popular: a solid flame with a darker core (the reference style).
  popular: (t, C) => (<>
    <Body t={t}>
      <Path d="M12 2.5c.5 3.2 3.2 4.6 4.6 7.3 1.5 2.8 1.2 6.4-1.2 8.6A6.3 6.3 0 0 1 5.8 15c-.2-2.6 1-4.4 2.4-5.8.2 1.4.9 2.3 1.9 2.8C9.6 8.3 10.6 5 12 2.5Z" fill={C.cyan} />
    </Body>
    <Accent t={t} x={12} y={17}><Path d="M12.1 11.6c1.3 1.5 2.4 2.7 2.4 4.4a2.5 2.5 0 0 1-5 0c0-1.5 1.1-2.6 2.6-4.4Z" fill={C.amber} /></Accent>
  </>),
  // Explore: a solid compass disc; white needle tail, darker needle head.
  explore: (t, C) => (<>
    <Body t={t}>
      <Circle cx={12} cy={12} r={9.5} fill={C.cyan} />
      <Path d="m12 12-3 5.6L14.6 15Z" fill="#fff" />
    </Body>
    <Accent t={t} x={12} y={12}><Path d="M17.6 6.4 14.6 15 12 12 9 9Z" fill={C.amber} stroke="#fff" strokeWidth={0.9} strokeLinejoin="round" /></Accent>
  </>),
  // Recent: a solid clock with white hands; a darker rewind arrow.
  recent: (t, C) => (<>
    <Body t={t}>
      <Circle cx={13} cy={12.5} r={8.5} fill={C.cyan} />
      <Path d="M13 8.2v4.5l2.8 1.7" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Body>
    <Accent t={t} x={4.5} y={6}><Path d="M2.5 3.5 8 4.3 4.3 8.6Z" fill={C.amber} stroke="#fff" strokeWidth={1} strokeLinejoin="round" /></Accent>
  </>),
  // Suggestions: a solid bulb with a white spark; darker base.
  suggestions: (t, C) => (<>
    <Body t={t}>
      <Path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.2.9 1.9v.9h6v-.9c0-.7.3-1.4.9-1.9A6.5 6.5 0 0 0 12 2.5Z" fill={C.cyan} />
      <Path d="m12.7 5.8-2.6 3.8h3.4l-2.4 3.6" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Body>
    <Accent t={t} x={12} y={19.5}><Rect x={9} y={17.6} width={6} height={3.9} rx={1.6} fill={C.amber} /></Accent>
  </>),
  // Trending: three solid rising bars; a darker arrow tip.
  trending: (t, C) => (<>
    <Body t={t}>
      <Rect x={3} y={14} width={4.6} height={7} rx={1.6} fill={C.cyan} />
      <Rect x={9.7} y={10.5} width={4.6} height={10.5} rx={1.6} fill={C.cyan} />
      <Rect x={16.4} y={7} width={4.6} height={14} rx={1.6} fill={C.cyan} />
    </Body>
    <Accent t={t} x={18} y={3.5}><Path d="M14.5 2.5h6v6Z" fill={C.amber} /><Path d="M3.5 9.5 9 5l4 2.6" fill="none" stroke={C.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Accent>
  </>),
  // Active conversations: a solid bubble with white dots; a darker reply bubble.
  conversations: (t, C) => (<>
    <Accent t={t} x={17} y={8}><Path d="M10 3.5h9.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H19v2.5L16 13.5" fill={C.amber} /></Accent>
    <Body t={t}>
      <Path d="M2.5 9.5A3 3 0 0 1 5.5 6.5h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8.7L5 20.5v-3.1a3 3 0 0 1-2.5-3Z" fill={C.cyan} stroke="#fff" strokeWidth={1} />
      <Circle cx={7} cy={12} r={1.1} fill="#fff" /><Circle cx={10} cy={12} r={1.1} fill="#fff" /><Circle cx={13} cy={12} r={1.1} fill="#fff" />
    </Body>
  </>),
  // Location: a solid folded map with white folds; a darker pin.
  location: (t, C) => (<>
    <Body t={t}>
      <Path d="M2.5 6.2 8.5 3.8l7 2.4 6-2.4v14l-6 2.4-7-2.4-6 2.4Z" fill={C.cyan} />
      <Path d="M8.5 3.8v14M15.5 6.2v14" stroke="#fff" strokeWidth={1.2} />
    </Body>
    <Accent t={t} x={12} y={11}><Path d="M12 5.8a3.2 3.2 0 0 0-3.2 3.2c0 2.4 3.2 5.4 3.2 5.4s3.2-3 3.2-5.4A3.2 3.2 0 0 0 12 5.8Z" fill={C.amber} stroke="#fff" strokeWidth={1} /><Circle cx={12} cy={9} r={1.1} fill="#fff" /></Accent>
  </>),
  // Details: a solid job sheet with white lines; a darker folded corner.
  details: (t, C) => (<>
    <Body t={t}>
      <Path d="M6 2.5h8.5l5 5v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z" fill={C.cyan} />
      <Path d="M7.8 11.5h8M7.8 15h8M7.8 18.5h4.5" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={16.5} y={5}><Path d="M14.5 2.5v4a1 1 0 0 0 1 1h4Z" fill={C.amber} /></Accent>
  </>),
  // Employer: a solid office block with white windows; one darker lit window.
  employer: (t, C) => (<>
    <Body t={t}>
      <Rect x={4} y={3} width={16} height={18.5} rx={2.5} fill={C.cyan} />
      <Rect x={7} y={6.5} width={3} height={3} rx={0.8} fill="#fff" /><Rect x={7} y={11} width={3} height={3} rx={0.8} fill="#fff" />
      <Rect x={14} y={11} width={3} height={3} rx={0.8} fill="#fff" />
      <Rect x={10} y={16} width={4} height={5.5} rx={1} fill="#fff" />
    </Body>
    <Accent t={t} x={15.5} y={8}><Rect x={14} y={6.5} width={3} height={3} rx={0.8} fill={C.amber} /></Accent>
  </>),
  // Pay: a solid banknote with a white centre; a darker coin.
  pay: (t, C) => (<>
    <Body t={t}>
      <Rect x={2} y={5.5} width={17} height={11} rx={2.5} fill={C.cyan} />
      <Circle cx={10.5} cy={11} r={2.6} fill="#fff" />
    </Body>
    <Accent t={t} x={18} y={17.5}><Circle cx={18} cy={17.5} r={4} fill={C.amber} stroke="#fff" strokeWidth={1.4} /><Path d="M18 15.6v3.8" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" /></Accent>
  </>),
  // Positions: a solid person; a darker open seat with a white plus.
  positions: (t, C) => (<>
    <Body t={t}>
      <Circle cx={9} cy={7.5} r={3.6} fill={C.cyan} />
      <Path d="M2.5 20.5V19c0-3.3 2.8-5.5 6.5-5.5s6.5 2.2 6.5 5.5v1.5Z" fill={C.cyan} />
    </Body>
    <Accent t={t} x={18} y={9}><Circle cx={18} cy={9} r={4} fill={C.amber} stroke="#fff" strokeWidth={1.2} /><Path d="M18 7v4M16 9h4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" /></Accent>
  </>),
} satisfies Record<string, Art>;

export type SectionIconName = keyof typeof ART;

export function SectionIcon({ name, size = 22, delay = 120, replayKey = 0, tone = 'color' }: { name: SectionIconName; size?: number; delay?: number; replayKey?: number; tone?: 'color' | 'mono' }) {
  const t = useOnce(delay, replayKey);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ART[name](t, PALETTES[tone])}
    </Svg>
  );
}
