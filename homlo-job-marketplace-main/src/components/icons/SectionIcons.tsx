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
/** Accent: pops 0.3 -> 1.15 -> 1 around (x, y) after the body lands. */
function Accent({ t, x, y, children }: { t: SharedValue<number>; x: number; y: number; children: React.ReactNode }) {
  const ap = useAnimatedProps(() => ({
    opacity: kf(t.value, [[0, 0], [0.4, 0], [0.62, 1], [1, 1]]),
    transform: around(kf(t.value, [[0, 0.3], [0.4, 0.3], [0.75, 1.15], [1, 1]]), x, y),
  }));
  return <AG animatedProps={ap}>{children}</AG>;
}

type Art = (t: SharedValue<number>, C: Pal) => React.ReactNode;

const ART = {
  // Job field: a grid of category tiles; one amber tile is "yours".
  jobField: (t, C) => (<>
    <Body t={t}>
      <Rect x={3} y={3} width={8} height={8} rx={2.5} fill={C.cyan} />
      <Rect x={13} y={3} width={8} height={8} rx={2.5} fill={C.soft} />
      <Rect x={3} y={13} width={8} height={8} rx={2.5} fill={C.soft} />
    </Body>
    <Accent t={t} x={17} y={17}><Rect x={13} y={13} width={8} height={8} rx={4} fill={C.amber} /></Accent>
  </>),
  // Job type / schedule: a clock face, amber hub.
  jobType: (t, C) => (<>
    <Body t={t}>
      <Circle cx={12} cy={12} r={8.5} fill={C.tint} stroke={C.cyan} strokeWidth={2} />
      <Path d="M12 7.5V12l3.2 2" fill="none" stroke={C.navy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Body>
    <Accent t={t} x={12} y={12}><Circle cx={12} cy={12} r={1.9} fill={C.amber} /></Accent>
  </>),
  // Recommended: a job card earning an amber star.
  recommended: (t, C) => (<>
    <Body t={t}>
      <Rect x={2.5} y={6} width={15} height={14} rx={3.5} fill={C.tint} stroke={C.cyan} strokeWidth={1.8} />
      <Rect x={5.5} y={10} width={5} height={6} rx={1.5} fill={C.cyan} />
      <Path d="M12.5 11h2.5M12.5 14.5h2" stroke={C.navy} strokeWidth={1.6} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={18} y={6}>
      <Path d="m18 1.8 1.3 2.7 2.9.4-2.1 2 .5 2.9L18 8.4l-2.6 1.4.5-2.9-2.1-2 2.9-.4Z" fill={C.amber} stroke="#fff" strokeWidth={1} strokeLinejoin="round" />
    </Accent>
  </>),
  // Nearby: a pin sending a ripple across the ground.
  nearby: (t, C) => (<>
    <Accent t={t} x={12} y={20}><Path d="M5.5 20.2c0-1.1 2.9-2 6.5-2s6.5.9 6.5 2-2.9 2-6.5 2-6.5-.9-6.5-2Z" fill="none" stroke={C.amber} strokeWidth={1.6} /></Accent>
    <Body t={t}>
      <Path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.6 6.5 10.5 6.5 10.5s6.5-5.9 6.5-10.5A6.5 6.5 0 0 0 12 2.5Z" fill={C.cyan} />
      <Circle cx={12} cy={9} r={2.4} fill="#fff" />
    </Body>
  </>),
  // Popular: a cyan flame with an amber core.
  popular: (t, C) => (<>
    <Body t={t}>
      <Path d="M12 2.5c.5 3.2 3.2 4.6 4.6 7.3 1.5 2.8 1.2 6.4-1.2 8.6A6.3 6.3 0 0 1 5.8 15c-.2-2.6 1-4.4 2.4-5.8.2 1.4.9 2.3 1.9 2.8C9.6 8.3 10.6 5 12 2.5Z" fill={C.cyan} />
    </Body>
    <Accent t={t} x={12} y={17}><Path d="M12.1 11.6c1.3 1.5 2.4 2.7 2.4 4.4a2.5 2.5 0 0 1-5 0c0-1.5 1.1-2.6 2.6-4.4Z" fill={C.amber} /></Accent>
  </>),
  // Explore: a compass; the amber half of the needle points the way.
  explore: (t, C) => (<>
    <Body t={t}>
      <Circle cx={12} cy={12} r={9} fill={C.tint} stroke={C.cyan} strokeWidth={2} />
      <Path d="m12 12-2.4 4.6L14.4 14.4Z" fill={C.navy} />
    </Body>
    <Accent t={t} x={12} y={12}><Path d="M16.6 7.4 14.4 14.4 12 12 9.6 9.6Z" fill={C.amber} /></Accent>
  </>),
  // Recent: a clock wound backwards.
  recent: (t, C) => (<>
    <Body t={t}>
      <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke={C.cyan} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3.8 3.8v3.6h3.6" fill="none" stroke={C.cyan} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 8v4.2l2.6 1.6" fill="none" stroke={C.navy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Body>
    <Accent t={t} x={12} y={12.2}><Circle cx={12} cy={12.2} r={1.6} fill={C.amber} /></Accent>
  </>),
  // Suggestions: a bulb with an amber spark.
  suggestions: (t, C) => (<>
    <Body t={t}>
      <Path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" fill={C.tint} stroke={C.cyan} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9.6 20h4.8" stroke={C.navy} strokeWidth={2} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={12} y={10}><Path d="m12.6 6.8-2.4 3.6h3.2l-2.2 3.4" fill="none" stroke={C.amber} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Accent>
  </>),
  // Trending: bars climb, the amber line rises across them.
  trending: (t, C) => (<>
    <Body t={t}>
      <Rect x={3} y={14} width={4.5} height={7} rx={1.5} fill={C.soft} />
      <Rect x={9.75} y={10.5} width={4.5} height={10.5} rx={1.5} fill="#2BB0CC" />
      <Rect x={16.5} y={7} width={4.5} height={14} rx={1.5} fill={C.cyan} />
    </Body>
    <Accent t={t} x={12} y={6}><Path d="M3 9.5 8 5.5l4 2.8L19.5 3M15.5 2.8h4.2V7" fill="none" stroke={C.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Accent>
  </>),
  // Active conversations: two bubbles talking, amber "online" dot.
  conversations: (t, C) => (<>
    <Body t={t}>
      <Path d="M9 4h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-.5v2.5L15 15" fill={C.soft} />
      <Path d="M3 9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8.5L5 20v-3a2 2 0 0 1-2-2Z" fill={C.cyan} />
      <Circle cx={7.5} cy={11.5} r={1} fill="#fff" /><Circle cx={10} cy={11.5} r={1} fill="#fff" /><Circle cx={12.5} cy={11.5} r={1} fill="#fff" />
    </Body>
    <Accent t={t} x={19.5} y={4.5}><Circle cx={19.5} cy={4.5} r={2.6} fill={C.amber} stroke="#fff" strokeWidth={1.2} /></Accent>
  </>),
  // Location: a folded map with an amber pin.
  location: (t, C) => (<>
    <Body t={t}>
      <Path d="M2.5 6.5 8.5 4l7 2.5 6-2.5v13.5l-6 2.5-7-2.5-6 2.5Z" fill={C.tint} stroke={C.cyan} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M8.5 4v13.5M15.5 6.5V20" stroke={C.cyan} strokeWidth={1.5} />
    </Body>
    <Accent t={t} x={12} y={12}><Path d="M12 6.5a3 3 0 0 0-3 3c0 2.2 3 5 3 5s3-2.8 3-5a3 3 0 0 0-3-3Z" fill={C.amber} /><Circle cx={12} cy={9.5} r={1.1} fill="#fff" /></Accent>
  </>),
  // Details: a job sheet with an amber tag.
  details: (t, C) => (<>
    <Body t={t}>
      <Path d="M6 2.5h8l4.5 4.5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z" fill={C.tint} stroke={C.cyan} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M8 11h7M8 14.5h7M8 18h4" stroke={C.navy} strokeWidth={1.6} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={16} y={5}><Path d="M14 2.5V7h4.5Z" fill={C.amber} /></Accent>
  </>),
  // Employer: an office block with one amber window lit.
  employer: (t, C) => (<>
    <Body t={t}>
      <Rect x={4} y={3} width={16} height={18.5} rx={2.5} fill={C.cyan} />
      <Rect x={7} y={6.5} width={3} height={3} rx={0.8} fill="#fff" /><Rect x={14} y={11} width={3} height={3} rx={0.8} fill="#fff" />
      <Rect x={7} y={11} width={3} height={3} rx={0.8} fill="#fff" />
      <Rect x={10} y={16} width={4} height={5.5} rx={1} fill={C.navy} />
    </Body>
    <Accent t={t} x={15.5} y={8}><Rect x={14} y={6.5} width={3} height={3} rx={0.8} fill={C.amber} /></Accent>
  </>),
  // Pay: a banknote with an amber coin.
  pay: (t, C) => (<>
    <Body t={t}>
      <Rect x={2} y={5.5} width={17} height={11} rx={2.5} fill={C.cyan} />
      <Circle cx={10.5} cy={11} r={2.6} fill="#fff" />
      <Path d="M5 8.5v5M16 8.5v5" stroke={C.soft} strokeWidth={1.4} strokeLinecap="round" />
    </Body>
    <Accent t={t} x={18} y={17.5}><Circle cx={18} cy={17.5} r={4} fill={C.amber} stroke="#fff" strokeWidth={1.4} /><Path d="M18 15.6v3.8" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" /></Accent>
  </>),
  // Positions: two people, an amber seat waiting to be filled.
  positions: (t, C) => (<>
    <Body t={t}>
      <Circle cx={9} cy={7.5} r={3.4} fill={C.cyan} />
      <Path d="M2.5 20v-1.5c0-3.2 2.8-5.3 6.5-5.3s6.5 2.1 6.5 5.3V20Z" fill={C.cyan} />
    </Body>
    <Accent t={t} x={18} y={9}><Circle cx={18} cy={9} r={3.6} fill="none" stroke={C.amber} strokeWidth={1.8} strokeDasharray="2.4 1.6" /><Path d="M18 7.5v3M16.5 9h3" stroke={C.amber} strokeWidth={1.6} strokeLinecap="round" /></Accent>
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
