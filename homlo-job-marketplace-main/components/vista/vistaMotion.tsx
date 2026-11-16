// vistaMotion.tsx
// Tiny animation kit for the hero illustrations (react-native-svg + Reanimated 4).
// <VistaMove kind="bob">…</VistaMove> wraps any SVG <G> content in a looping motion.
// <VistaDraw d="…" /> is a path that draws itself, holds, then erases.
//
// Why style transforms: under the new architecture Reanimated applies animatedProps
// straight to the native view, so react-native-svg's JS-only transform props (translateY,
// rotation, originX, scale…) never take effect on an animated <G>, and an array-valued
// `matrix` prop crashes the app. The native group view DOES take style transforms, which
// is the same path every Animated.View uses, so motion here is style-based. Style
// transforms apply about scene (0,0), so a fully transparent full-canvas rect
// pins the group's bounds to the
// 160×120 scene (so scene (0,0) is the transform origin) and pivots are composed
// translates. `opacity`/`strokeDashoffset` are real native props and
// pass through animatedProps.
import React, { useEffect } from 'react';
import { G, Path, PathProps, Rect } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';

const AG = Animated.createAnimatedComponent(G) as unknown as React.ComponentType<Record<string, unknown>>;
const AP = Animated.createAnimatedComponent(Path);

export type VistaKind =
  | 'spin' | 'bob' | 'sw' | 'pl' | 'bl' | 'rise' | 'grow'
  | 'flip' | 'pg' | 'road' | 'lift' | 'scan' | 'snip';

// seconds for one full cycle
const DUR: Record<VistaKind, number> = {
  spin: 6, bob: 2, sw: 2, pl: 2, bl: 2, rise: 3, grow: 3,
  flip: 2, pg: 3.6, road: 0.8, lift: 3, scan: 2.4, snip: 1,
};
// kinds that go 0→1→0 instead of restarting
const REV: Record<VistaKind, boolean> = {
  spin: false, bob: true, sw: true, pl: true, bl: true, rise: false, grow: false,
  flip: true, pg: true, road: false, lift: false, scan: false, snip: true,
};
const LINEAR: VistaKind[] = ['spin', 'road'];

type MoveProps = {
  kind: VistaKind;
  delay?: number; // seconds
  duration?: number; // seconds for one cycle
  origin?: [number, number]; // pivot in the 160×120 scene
  dir?: 1 | -1; // spin/sway/snip direction
  amp?: number; // bob px, sway degrees, scan distance
  children: React.ReactNode;
};

export function VistaMove({ kind, delay = 0, duration, origin = [0, 0], dir = 1, amp, children }: MoveProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    const ms = ((duration ?? DUR[kind]) * 1000) / (REV[kind] ? 2 : 1);
    p.value = 0;
    p.value = withDelay(
      delay * 1000,
      withRepeat(
        withTiming(1, { duration: ms, easing: LINEAR.includes(kind) ? Easing.linear : Easing.inOut(Easing.ease) }),
        -1,
        REV[kind],
      ),
    );
    return () => cancelAnimation(p);
  }, [kind, delay, duration, reduce]);

  // Object-form style transforms: RN applies style transforms natively (the same
  // path every Animated.View uses). react-native-svg merges style keys into its
  // props and re-parses transform arrays through its SVG grammar, so entries must
  // be single-key objects it understands and must be omitted entirely when there
  // is no motion — an empty array makes its parser return null and crash. Native
  // style transforms apply about scene (0,0) and ignore transformOrigin, so
  // pivots are composed as translate→rotate/scale→translate about
  // the pivot itself; the full-canvas rect pins the group's bounds to the
  // 160×120 scene and makes transforms apply about scene (0,0).
  const style = useAnimatedStyle(() => {
    const v = p.value;
    const cx = origin[0];
    const cy = origin[1];
    const t: Record<string, number | string>[] = [];
    const pivot = (entry: Record<string, number | string>) => {
      t.push({ translateX: cx }, { translateY: cy }, entry, { translateX: -cx }, { translateY: -cy });
    };
    switch (kind) {
      case 'spin': pivot({ rotate: `${v * 360 * dir}deg` }); break;
      case 'bob': t.push({ translateY: -(amp ?? 6) * v }); break;
      case 'sw': { const a = amp ?? 8; pivot({ rotate: `${(-a + 2 * a * v) * dir}deg` }); break; }
      case 'pl': { const s = 1 + 0.15 * v; pivot({ scale: s }); break; }
      case 'bl': break;
      case 'rise': t.push({ translateY: 8 - 26 * v }); break;
      case 'grow': pivot({ scaleY: 0.25 + 0.75 * Math.min(1, v / 0.55) }); break;
      case 'flip': pivot({ scaleX: 1 - 0.92 * v }); break;
      case 'pg': pivot({ scaleX: 1 - 2 * v }); break;
      case 'road': t.push({ translateX: -40 * v }); break;
      case 'lift': t.push({ translateY: v < 0.25 ? (-16 * v) / 0.25 : v < 0.4 ? -16 : v < 0.55 ? -16 * (1 - (v - 0.4) / 0.15) : 0 }); break;
      case 'scan': t.push({ translateY: (amp ?? 76) * v }); break;
      case 'snip': pivot({ rotate: `${(-9 + 18 * v) * dir}deg` }); break;
      default: break;
    }
    return (t.length ? { transform: t } : {}) as any;
  });

  const opacityProps = useAnimatedProps<Record<string, number>>(() => {
    const v = p.value;
    switch (kind) {
      case 'bl': return { opacity: 1 - 0.85 * v };
      case 'rise': return { opacity: v < 0.3 ? v / 0.3 : 1 - (v - 0.3) / 0.7 };
      case 'scan': return { opacity: v < 0.1 ? v / 0.1 : v > 0.9 ? (1 - v) / 0.1 : 1 };
      default: return { opacity: 1 };
    }
  });

  return (
    <AG style={style as any} animatedProps={opacityProps as any}>
      <Rect x={0} y={0} width={160} height={120} fill="#000" fillOpacity={0} stroke="none" pointerEvents="none" />
      {children}
    </AG>
  );
}

type DrawProps = PathProps & { d: string; delay?: number; duration?: number; len?: number };

export function VistaDraw({ d, delay = 0, duration = 3, len = 200, ...rest }: DrawProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.6 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = 0;
    p.value = withDelay(delay * 1000, withRepeat(withTiming(1, { duration: duration * 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [delay, duration, reduce]);

  const animatedProps = useAnimatedProps(() => {
    const v = p.value;
    const q = v < 0.45 ? v / 0.45 : v < 0.85 ? 1 : 1 - (v - 0.85) / 0.15;
    return { strokeDashoffset: len * (1 - q) };
  });

  return <AP d={d} strokeDasharray={String(len)} animatedProps={animatedProps as any} {...rest} />;
}
