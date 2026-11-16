import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Icon } from './Icon';
import { copy } from './copy';
import { colors, fonts, radii } from './theme';
import type { ApplicationStatus } from './types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function PulseRing({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [delay, p]);
  const s = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.8, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 1.9]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, s]} />;
}

function MovingBar() {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced || w === 0) return;
    x.value = -w * 0.4;
    x.value = withRepeat(withTiming(w, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [reduced, w, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fillBar, reduced ? { width: '55%' } : { width: '40%' }, reduced ? undefined : a]} />
    </View>
  );
}

function Step({ label, mode }: { label: string; mode: 'done' | 'on' | 'todo' }) {
  return (
    <View style={styles.step}>
      {mode === 'on' ? (
        <View style={styles.halo}><View style={[styles.dot, { backgroundColor: colors.sun }]} /></View>
      ) : (
        <View style={styles.haloSpace}>
          <View style={[styles.dot, { backgroundColor: mode === 'done' ? colors.ink : 'rgba(122,67,0,0.25)' }]} />
        </View>
      )}
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

function WaitingPanel() {
  const reduced = useReducedMotion();
  return (
    <View style={[styles.panel, { backgroundColor: colors.cream }]}>
      <View style={styles.row}>
        <View style={styles.discWrap}>
          {reduced ? null : (<><PulseRing delay={0} color={colors.sun} /><PulseRing delay={1200} color={colors.sun} /></>)}
          <View style={styles.disc}><Icon name="eye" size={22} color={colors.ink} /></View>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.ink }]}>{copy.waitingTitle}</Text>
          <Text style={[styles.body, { color: colors.ink }]}>{copy.waitingBody}</Text>
        </View>
      </View>
      <MovingBar />
      <View style={styles.steps}>
        <Step label={copy.stepSent} mode="done" />
        <Step label={copy.stepReviewing} mode="on" />
        <Step label={copy.stepDecision} mode="todo" />
      </View>
    </View>
  );
}

function AcceptedPanel() {
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0);
  const dash = useSharedValue(reduced ? 0 : 24);
  useEffect(() => {
    if (reduced) return;
    pop.value = withSpring(1, { damping: 9, stiffness: 140 });
    dash.value = withDelay(350, withTiming(0, { duration: 500 }));
  }, [reduced, pop, dash]);
  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
  return (
    <View style={[styles.panel, { backgroundColor: colors.deep }]}>
      <View style={styles.row}>
        <View style={styles.discWrap}>
          {reduced ? null : <PulseRing delay={400} color={colors.tint2} />}
          <Animated.View style={[styles.disc, { backgroundColor: colors.teal }, discStyle]}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" stroke="#FFFFFF" strokeWidth={2} fill="none"
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} animatedProps={checkProps} />
            </Svg>
          </Animated.View>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.white }]}>{copy.acceptedTitle}</Text>
          <Text style={[styles.body, { color: colors.tint }]}>{copy.acceptedBody}</Text>
        </View>
      </View>
    </View>
  );
}

// Soft and symbolic: a sun rising over a hill, no red, no harsh icon.
function DeclinedPanel() {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? -14 : 30);
  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(300, withTiming(-14, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [reduced, y]);
  const sun = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={[styles.panel, { backgroundColor: colors.tint }]}>
      <View style={styles.scene}>
        <Animated.View style={[styles.sun, sun]} />
        <View style={styles.hill} />
      </View>
      <Text style={[styles.title, { color: colors.deep }]}>{copy.declinedTitle}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{copy.declinedBody}</Text>
    </View>
  );
}

export function StatePanel({ status }: { status: ApplicationStatus }) {
  if (status === 'accepted') return <AcceptedPanel />;
  if (status === 'declined') return <DeclinedPanel />;
  return <WaitingPanel />;
}

const styles = StyleSheet.create({
  panel: { borderRadius: radii.card, padding: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 26, marginBottom: 4 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  discWrap: { width: 44, height: 44 },
  disc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  track: { height: 6, borderRadius: 99, backgroundColor: 'rgba(122,67,0,0.14)', marginTop: 14, marginBottom: 12, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 99, backgroundColor: colors.sun },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  halo: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(245,181,43,0.3)', alignItems: 'center', justifyContent: 'center' },
  haloSpace: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.ink, textAlign: 'center' },
  scene: { height: 72, borderRadius: 14, backgroundColor: colors.tint2, overflow: 'hidden', marginBottom: 12 },
  sun: { position: 'absolute', bottom: 0, left: '50%', marginLeft: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sun },
  hill: { position: 'absolute', bottom: -296, left: '50%', marginLeft: -160, width: 320, height: 320, borderRadius: 160, backgroundColor: colors.teal },
});