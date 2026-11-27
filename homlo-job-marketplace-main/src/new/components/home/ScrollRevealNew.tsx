/**
 * Scroll-driven entrance: each wrapped item fades and rises into place the first time it
 * enters the viewport (items already on screen animate on mount). Smooth, no bounce.
 */
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SMOOTH } from '@/src/design/motion';

type Ctx = { scrollY: SharedValue<number>; viewportH: number };
const ScrollRevealCtx = createContext<Ctx | null>(null);

export function ScrollRevealProvider({ scrollY, viewportH, children }: Ctx & { children: ReactNode }) {
  return <ScrollRevealCtx.Provider value={{ scrollY, viewportH }}>{children}</ScrollRevealCtx.Provider>;
}

/** `index` staggers siblings (capped so long lists never lag). */
export function RevealOnScroll({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const ctx = useContext(ScrollRevealCtx);
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const contentTop = useSharedValue(-1);
  const p = useSharedValue(reduced || !ctx ? 1 : 0);
  const fallbackY = useSharedValue(0);
  const scrollY = ctx?.scrollY ?? fallbackY;
  const viewportH = ctx?.viewportH ?? 0;

  const reveal = () => {
    'worklet';
    if (p.value === 0) {
      p.value = withDelay(Math.min(index, 5) * 70, withTiming(1, { duration: 560, easing: SMOOTH }));
    }
  };

  const onLayout = () => {
    // Already revealed: no need to cross the bridge to measure again.
    if (!ctx || reduced || p.get() > 0) return;
    ref.current?.measureInWindow((_x, y) => {
      contentTop.value = y + scrollY.value;
      // Already on screen when measured: reveal now. The reaction below can miss
      // this case (it may not re-run for the write), which left the second card
      // of a row stuck at opacity 0 and untappable.
      if (y < viewportH - 30) reveal();
    });
  };

  // BUGFIX: the single measurement in onLayout can be wrong (taken while the
  // screen is mid-transition, behind another tab, or before data finished
  // laying out), which left cards/sections at opacity 0 — invisible and
  // untappable — until scrolled past. Re-check shortly after mount, and as a
  // last resort fade in anyway: a missed animation is fine, missing content
  // is not.
  useEffect(() => {
    if (!ctx || reduced) return;
    const recheck = setTimeout(onLayout, 450);
    const failsafe = setTimeout(() => {
      if (p.get() === 0) p.set(withTiming(1, { duration: 300, easing: SMOOTH }));
    }, 2500);
    return () => {
      clearTimeout(recheck);
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAnimatedReaction(
    // Once revealed this is a constant `true`, so `prev` stays true and the reaction is a
    // no-op: every card used to re-read scrollY and compare on every frame of every scroll.
    () => p.value > 0 || (contentTop.value >= 0 && scrollY.value + viewportH > contentTop.value + 30),
    (visible, prev) => {
      if (visible && !prev) reveal();
    },
  );

  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 26 }, { scale: 0.97 + 0.03 * p.value }],
  }));

  return (
    <Animated.View ref={ref as never} onLayout={onLayout} style={[style, a]}>
      {children}
    </Animated.View>
  );
}
