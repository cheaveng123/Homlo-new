import { useEffect, useState } from 'react';
import { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';

export const motionNew = {
  fast: 200,
  base: 300,
  slow: 450,
  stagger: 60,
  pressButton: 0.975,
  pressCard: 0.985,
  easing: Easing.out(Easing.cubic),
} as const;

/** Staggered entrance. Returns undefined (no animation) when Reduce Motion is on. */
export function useEnterNew() {
  const reduced = useReducedMotion();
  return (index = 0) =>
    reduced ? undefined : FadeInDown.delay(Math.min(index, 9) * motionNew.stagger).duration(motionNew.slow);
}

/** Count-up number (JS driven, fine for a few numbers). */
export function useCountUpNew(target: number, duration = 1100) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return v;
}
