/**
 * Full-screen "publishing" state for the post-a-job wizard.
 *
 * A listing card assembles itself inside a cyan progress ring while a short checklist
 * ticks through the real steps (save → photo → publish). When the last step completes,
 * the ring closes and a check mark draws in. Pure UI: the route drives `step` / `done`.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TextNew } from '@/src/new/components/TextNew';
import { SMOOTH } from '@/src/design/motion';

const C = {
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  tint: '#DCF1F6',
  track: '#E3EEF1',
  navy: '#14324A',
  muted: '#6A7C84',
  line: '#D5E6EA',
  amber: '#F5A524',
  white: '#FFFFFF',
};

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);

const RING = 132;
const R = 58;
const CIRC = 2 * Math.PI * R;

export type PublishStep = { key: string; label: string };

type Props = {
  steps: PublishStep[];
  /** Index of the step in progress (steps before it are done). */
  step: number;
  /** All steps finished: close the ring and draw the check. */
  done?: boolean;
  title?: string;
  jobTitle?: string;
};

/* ───────── ring: eases toward the current step; a soft comet sweeps while working ───────── */

function ProgressRing({ fraction, done }: { fraction: number; done: boolean }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    p.value = reduced ? fraction : withTiming(fraction, { duration: 700, easing: SMOOTH });
  }, [fraction, reduced, p]);
  useEffect(() => {
    if (reduced || done) return;
    spin.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false);
  }, [reduced, done, spin]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - p.value) }));
  const comet = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }], opacity: done ? 0 : 1 }));

  return (
    <View style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={C.track} strokeWidth={6} fill="none" />
        <ACircle
          animatedProps={arc}
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={C.cyan}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      {/* small bright head that orbits while work is happening */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, comet]}>
        <View style={[st.comet, { left: RING / 2 - 5, top: RING / 2 - R - 5 }]} />
      </Animated.View>
    </View>
  );
}

/* ───────── listing card that builds itself line by line, then a check draws over it ───────── */

function AssemblingCard({ done }: { done: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const check = useSharedValue(0);
  useEffect(() => {
    if (reduced) { t.value = 1; return; }
    t.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400, easing: SMOOTH }), withDelay(500, withTiming(0, { duration: 400, easing: SMOOTH }))),
      -1,
      false,
    );
  }, [reduced, t]);
  useEffect(() => {
    if (!done) return;
    check.value = reduced ? 1 : withTiming(1, { duration: 450, easing: SMOOTH });
  }, [done, reduced, check]);

  const l1 = useAnimatedStyle(() => ({ width: 34 * interpolate(t.value, [0, 0.35], [0, 1], Extrapolation.CLAMP) }));
  const l2 = useAnimatedStyle(() => ({ width: 26 * interpolate(t.value, [0.2, 0.6], [0, 1], Extrapolation.CLAMP) }));
  const l3 = useAnimatedStyle(() => ({ width: 18 * interpolate(t.value, [0.45, 0.85], [0, 1], Extrapolation.CLAMP) }));
  const pin = useAnimatedStyle(() => {
    const k = interpolate(t.value, [0.7, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: k, transform: [{ scale: 0.6 + 0.4 * k }] };
  });
  const card = useAnimatedStyle(() => ({ opacity: 1 - check.value, transform: [{ scale: 1 - 0.15 * check.value }] }));
  const checkWrap = useAnimatedStyle(() => ({ opacity: check.value, transform: [{ scale: 0.8 + 0.2 * check.value }] }));
  const checkDraw = useAnimatedProps(() => ({ strokeDashoffset: 30 * (1 - check.value) }));

  return (
    <View style={st.cardSlot}>
      <Animated.View style={[st.card, card]}>
        <View style={st.cardPhoto}>
          <Svg width={16} height={13} viewBox="0 0 32 26" fill="none">
            <Rect x={1} y={1} width={30} height={24} rx={5} stroke={C.cyan} strokeWidth={2.5} />
            <Path d="M3 21l9-8 7 6 5-4 6 6" stroke={C.cyan} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Animated.View style={[st.line, { backgroundColor: C.navy }, l1]} />
          <Animated.View style={[st.line, l2]} />
          <Animated.View style={[st.line, { backgroundColor: C.amber }, l3]} />
        </View>
        <Animated.View style={[st.cardPin, pin]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, st.center, checkWrap]}>
        <View style={st.checkDisc}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <APath d="M5 12.5l4.5 4.5L19 7.5" stroke={C.white} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="30 30" animatedProps={checkDraw} />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

/* ───────── checklist row ───────── */

function StepRow({ label, state, index }: { label: string; state: 'done' | 'active' | 'todo'; index: number }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduced || state !== 'active') return;
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
  }, [reduced, state, spin]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(120 + index * 80).duration(400)} style={st.stepRow}>
      <View style={st.stepIcon}>
        {state === 'done' ? (
          <View style={st.stepDone}>
            <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <Path d="M6.5 11.3l3 3 6-6.3" stroke={C.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        ) : state === 'active' ? (
          <Animated.View style={a}>
            <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <Circle cx={11} cy={11} r={8.5} stroke={C.tint} strokeWidth={2.5} />
              <Path d="M11 2.5a8.5 8.5 0 0 1 8.5 8.5" stroke={C.cyan} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        ) : (
          <View style={st.stepTodo} />
        )}
      </View>
      <TextNew
        variant="body"
        heading={state !== 'todo'}
        weight={state === 'todo' ? 'medium' : 'bold'}
        color={state === 'todo' ? C.muted : C.navy}
        style={{ fontSize: 15, lineHeight: 20 }}
      >
        {label}
      </TextNew>
    </Animated.View>
  );
}

/* ───────── screen ───────── */

export function PublishingProgress({ steps, step, done = false, title = 'Publishing your job', jobTitle }: Props) {
  const ins = useSafeAreaInsets();
  const fraction = done ? 1 : Math.min(0.92, (step + 0.5) / Math.max(1, steps.length));
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[StyleSheet.absoluteFill, st.page]} accessibilityRole="progressbar" accessibilityLabel={title}>
      <LinearGradient colors={['#E9F5F8', '#FFFFFF']} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <View style={[st.body, { paddingTop: ins.top, paddingBottom: ins.bottom + 60 }]}>
        <View style={st.ringWrap}>
          <ProgressRing fraction={fraction} done={done} />
          <View style={[StyleSheet.absoluteFill, st.center]}>
            <AssemblingCard done={done} />
          </View>
        </View>

        <TextNew variant="hero" heading weight="extrabold" color={C.navy} align="center" style={st.title}>
          {done ? 'Your job is live' : title}
        </TextNew>
        {!!jobTitle && (
          <TextNew variant="body" weight="medium" color={C.muted} align="center" numberOfLines={1} style={st.sub}>
            {jobTitle}
          </TextNew>
        )}

        <View style={st.steps}>
          {steps.map((s, i) => (
            <StepRow key={s.key} index={i} label={s.label} state={done || i < step ? 'done' : i === step ? 'active' : 'todo'} />
          ))}
        </View>
      </View>
      <TextNew variant="caption" color={C.muted} align="center" style={[st.foot, { bottom: ins.bottom + 24 }]}>
        This usually takes a few seconds. Keep the app open.
      </TextNew>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  page: { backgroundColor: C.white, zIndex: 50 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  center: { alignItems: 'center', justifyContent: 'center' },
  ringWrap: { width: RING, height: RING, marginBottom: 28 },
  comet: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.white, borderWidth: 3, borderColor: C.cyan },
  cardSlot: { width: 76, height: 58, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 76, height: 50, borderRadius: 12, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 7,
    shadowColor: '#0B4F63', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardPhoto: { width: 22, height: 30, borderRadius: 6, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  line: { height: 4, borderRadius: 2, backgroundColor: C.line },
  cardPin: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: C.amber, borderWidth: 2, borderColor: C.white },
  checkDisc: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.cyan, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, lineHeight: 30 },
  sub: { marginTop: 4, maxWidth: 280 },
  steps: { marginTop: 30, alignSelf: 'stretch', gap: 14, paddingHorizontal: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stepDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.cyan, alignItems: 'center', justifyContent: 'center' },
  stepTodo: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.line },
  foot: { position: 'absolute', left: 24, right: 24 },
});
