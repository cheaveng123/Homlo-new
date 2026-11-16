// rqstage / rqTicker.ts
// ONE frame callback drives the whole banner on the UI thread.
//
// Performance rules baked in here:
//  - Only scenes that are visible get their shared values written. Idle scenes never
//    trigger any style or derived-value work.
//  - The scroll spring snaps to exactly 0 when it settles, so nothing keeps updating
//    while the user is not scrolling.
//  - Nothing in this file touches React state.

import { useEffect } from 'react';
import {
  SharedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { RQ_CYCLE_MS, RQ_FREEZE_MS, RQ_SCENE_COUNT } from './rqTokens';
import { rqSceneClock, rqSeg } from './rqMotionMath';

export type RqSceneSV = {
  t: SharedValue<number>; // local timeline ms (-1 idle)
  lc: SharedValue<number>; // loop clock, only advances while the scene is visible
  op: SharedValue<number>; // scene opacity
  dx: SharedValue<number>; // slide offset
};

export type RqTick = {
  clock: SharedValue<number>; // global ms
  sway: SharedValue<number>; // scroll-driven spring angle in degrees (-16..16)
  scenes: RqSceneSV[];
  bladeX: SharedValue<number>;
  bladeO: SharedValue<number>;
};

// The container that is handed to the scene components is cached per component
// instance (keyed by a shared value, which is stable for the whole lifetime of the
// component) so the memoised children below never see a new `tick` object.
const tickCache = new WeakMap<object, RqTick>();

export function useRqTicker(scrollY: SharedValue<number>, active: boolean = true): RqTick {
  const reduce = useReducedMotion();
  const clock = useSharedValue(reduce ? RQ_FREEZE_MS : 0);
  const sway = useSharedValue(0);
  const vel = useSharedValue(0);
  const last = useSharedValue(0);
  const bladeX = useSharedValue(0);
  const bladeO = useSharedValue(0);

  // One set of shared values per scene. They are written directly (never through the
  // container) so the frame callback only ever touches plain shared values.
  const t0 = useSharedValue(-1);
  const t1 = useSharedValue(-1);
  const t2 = useSharedValue(-1);
  const lc0 = useSharedValue(0);
  const lc1 = useSharedValue(0);
  const lc2 = useSharedValue(0);
  const op0 = useSharedValue(0);
  const op1 = useSharedValue(0);
  const op2 = useSharedValue(0);
  const dx0 = useSharedValue(0);
  const dx1 = useSharedValue(0);
  const dx2 = useSharedValue(0);

  // The scene clock is ACCUMULATED into `clock` from the raw frame timestamp
  // rather than read from `fi.timeSinceFirstFrame`. `timeSinceFirstFrame` restarts
  // at 0 every time useFrameCallback re-registers its callback (which happens on
  // re-render, because the callback closure identity changes), and a clock restart
  // makes the scene index jump back mid-cycle. `clock` is a shared value, so it
  // survives re-registration. The delta is capped so a pause (frame callback
  // stopped while the screen is hidden) cannot jump the clock forward either.
  const lastTs = useSharedValue(-1);

  let tick = tickCache.get(clock);
  if (!tick) {
    tick = {
      clock,
      sway,
      bladeX,
      bladeO,
      scenes: [
        { t: t0, lc: lc0, op: op0, dx: dx0 },
        { t: t1, lc: lc1, op: op1, dx: dx1 },
        { t: t2, lc: lc2, op: op2, dx: dx2 },
      ],
    };
    tickCache.set(clock, tick);
  }

  const frame = useFrameCallback((fi) => {
    const ts = fi.timestamp;
    const dt = lastTs.value < 0 ? 0 : Math.min(100, Math.max(0, ts - lastTs.value));
    lastTs.value = ts;
    const c = reduce ? RQ_FREEZE_MS : clock.value + dt;
    if (!reduce) clock.value = c;

    // --- scenes: write only what is visible ---
    for (let i = 0; i < RQ_SCENE_COUNT; i++) {
      const info = rqSceneClock(c, i);
      const t = i === 0 ? t0 : i === 1 ? t1 : t2;
      const lc = i === 0 ? lc0 : i === 1 ? lc1 : lc2;
      const op = i === 0 ? op0 : i === 1 ? op1 : op2;
      const dx = i === 0 ? dx0 : i === 1 ? dx1 : dx2;
      if (t.value !== info.t || op.value !== info.op) {
        t.value = info.t;
        lc.value = c;
        op.value = info.op;
        dx.value = info.dx;
      }
    }

    // --- amber blade that sweeps across on scene change ---
    const ts2 = c % RQ_CYCLE_MS;
    let bx = 0;
    let bo = 0;
    if (c >= RQ_CYCLE_MS && ts2 < 560) {
      bx = -330 * rqSeg(ts2, 0, 520);
      bo = ts2 < 400 ? 0.9 : 0.9 * (1 - (ts2 - 400) / 160);
    }
    if (bladeO.value !== bo) {
      bladeO.value = bo;
      bladeX.value = bx;
    }

    // --- scroll spring (lean / sway) ---
    if (!reduce) {
      const sy = Math.max(0, scrollY.value);
      const v = sy - last.value;
      last.value = sy;
      const w = vel.value * 0.9 - v * 0.22 - sway.value * 0.05;
      let a = sway.value + w;
      a = Math.max(-16, Math.min(16, a));
      if (Math.abs(a) < 0.01 && Math.abs(w) < 0.01) {
        if (sway.value !== 0) {
          sway.value = 0;
          vel.value = 0;
        }
      } else {
        vel.value = w;
        sway.value = a;
      }
    }
  }, active);

  useEffect(() => {
    frame.setActive(active);
  }, [active, frame]);

  return tick;
}
