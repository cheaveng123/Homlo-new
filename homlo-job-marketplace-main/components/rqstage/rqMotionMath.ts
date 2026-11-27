// rqstage / rqMotionMath.ts
// Pure worklet math for the banner. Every function runs on the UI thread.
// No allocations that matter, no React, no shared values in here.

import { RQ_CYCLE_MS, RQ_SCENE_COUNT, RQ_PERSON_SCALE, RQ_STAGE_H } from './rqTokens';

export const RQ_TAU = Math.PI * 2;

/** smoothstep progress of t between a and b (0..1) */
export function rqSeg(t: number, a: number, b: number) {
  'worklet';
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export function rqMix(p: number[], q: number[], k: number) {
  'worklet';
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
}

/** 0..1..0 smooth loop with the given period */
export function rqPulse(clockMs: number, period: number) {
  'worklet';
  return 0.5 - 0.5 * Math.cos(RQ_TAU * ((clockMs % period) / period));
}

/** eye scaleY: 1 most of the time, quick blink every 4.4s */
export function rqBlink(clockMs: number, phase: number) {
  'worklet';
  const p = ((clockMs + phase) % 4400) / 4400;
  if (p < 0.92) return 1;
  if (p < 0.95) return 1 - (0.9 * (p - 0.92)) / 0.03;
  return 0.1 + (0.9 * (p - 0.95)) / 0.05;
}

/**
 * Two-bone arm solver in person-local units (origin = bottom centre of the torso).
 * side: +1 = arm on the right of the figure, -1 = left.
 * Both bones are 16 units, so the elbow bends naturally and always points outward/down.
 */
export function rqSolveArm(side: number, hand: number[]) {
  'worklet';
  const sx = side * 24;
  const sy = -34;
  const dx = hand[0] - sx;
  const dy = hand[1] - sy;
  const full = Math.sqrt(dx * dx + dy * dy) || 1;
  const dist = Math.max(8, Math.min(31, full));
  const ux = dx / full;
  const uy = dy / full;
  const L = 16;
  const aa = dist / 2;
  const hh = Math.sqrt(Math.max(0, L * L - aa * aa));
  let px = -uy;
  let py = ux;
  if (py + 0.8 * px * side < 0) {
    px = -px;
    py = -py;
  }
  const ex = sx + ux * aa + px * hh;
  const ey = sy + uy * aa + py * hh;
  const hx = sx + ux * dist;
  const hy = sy + uy * dist;
  const ang = Math.atan2(hy - ey, (hx - ex) * side);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return {
    sx,
    sy,
    ex,
    ey,
    hx,
    hy,
    tx: hx + side * (1.5 * c + 4.2 * s), // thumb centre
    ty: hy + (1.5 * s - 4.2 * c),
  };
}

const E_REST = [29, -6];
const E_EXT = [44, -30];
const C_REST = [-29, -6];
const C_EXT = [-44, -30];
const C_UP = [-36, -52];

/**
 * The whole hand-off, as a function of local scene time t (ms).
 * t < 0 returns the rest pose with everything hidden.
 * Coordinates for item/chip/badge are in stage pixels.
 */
export function rqHandoff(t: number, empX: number, candX: number) {
  'worklet';
  const S = RQ_PERSON_SCALE;
  const BY = RQ_STAGE_H;

  const eh = rqMix(rqMix(E_REST, E_EXT, rqSeg(t, 500, 1100)), E_REST, rqSeg(t, 2300, 2900));
  let ch = rqMix(C_REST, C_EXT, rqSeg(t, 1200, 1700));
  ch = rqMix(ch, C_UP, rqSeg(t, 2500, 3100));
  ch = rqMix(ch, C_REST, rqSeg(t, 4300, 4900));

  const k = rqSeg(t, 1500, 2200); // flight progress
  let px: number;
  let py: number;
  if (k <= 0) {
    px = empX + eh[0] * S;
    py = BY + eh[1] * S;
  } else if (k >= 1) {
    px = candX + ch[0] * S;
    py = BY + ch[1] * S;
  } else {
    const ax = empX + E_EXT[0] * S;
    const ay = BY + E_EXT[1] * S;
    const bx = candX + C_EXT[0] * S;
    const by = BY + C_EXT[1] * S;
    px = ax + (bx - ax) * k;
    py = ay + (by - ay) * k - 26 * Math.sin(Math.PI * k);
  }

  const io = rqSeg(t, 500, 900) * (1 - rqSeg(t, 4500, 4900));
  const held = k <= 0 || k >= 1 ? 1 : k < 0.5 ? 1 - rqSeg(k, 0, 0.15) : rqSeg(k, 0.85, 1);
  const chipRise = rqSeg(t, 2300, 2900);

  return {
    eh,
    ch,
    ix: px,
    iy: py - 8, // item rests on the palm
    pop: 1 + 0.22 * Math.sin(Math.PI * rqSeg(t, 2200, 2500)),
    io,
    fingerOp: io * held,
    fingerC: k < 0.5 ? 0 : 1, // 0 = giver's fingers, 1 = receiver's fingers
    smile: t > 2200 && t < 4900,
    bScale: rqSeg(t, 2300, 2600),
    bOp: 1 - rqSeg(t, 4700, 5100),
    chipRise,
    chipOp: Math.min(1, chipRise * 3) * (1 - rqSeg(t, 4900, 5400)),
  };
}

/**
 * Where scene i is in the rotation.
 * t   local timeline in ms (-1 = idle)
 * op  scene opacity, dx slide offset (px)
 */
export function rqSceneClock(clockMs: number, i: number) {
  'worklet';
  const idx = Math.floor(clockMs / RQ_CYCLE_MS) % RQ_SCENE_COUNT;
  const ts = clockMs % RQ_CYCLE_MS;
  if (idx === i) {
    const e = rqSeg(ts, 0, 450);
    return { t: ts - 300, op: e, dx: 40 * (1 - e) };
  }
  const wasPrev = clockMs >= RQ_CYCLE_MS && idx === (i + 1) % RQ_SCENE_COUNT && ts < 400;
  if (wasPrev) {
    const q = ts / 400;
    return { t: RQ_CYCLE_MS - 300, op: 1 - q, dx: -30 * q };
  }
  return { t: -1, op: 0, dx: 0 };
}
