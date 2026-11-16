// rqstage / RqFolk.tsx
// One flat-style person (bust). Smooth by construction:
//  - Torso and head are STATIC SVG layers, rasterized once and never redrawn.
//  - Arms, hands, eyes and mouth are plain Views moved with GPU transforms
//    (no per-frame SVG redraw anywhere in this component).

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { RQ_PERSON_SCALE as S, RQ_STAGE_H, RqLook } from './rqTokens';
import { RQ_TAU, rqBlink, rqSolveArm } from './rqMotionMath';

// person-local viewBox: origin = bottom centre of the torso
const VB_X = -54;
const VB_Y = -95;
const VB_W = 108;
const VB_H = 95;
const PX = (x: number) => {
  'worklet';
  return (x - VB_X) * S;
};
const PY = (y: number) => {
  'worklet';
  return (y - VB_Y) * S;
};

const TORSO = 'M-30 0 L-28 -28 Q-26 -41 -12 -43 L12 -43 Q26 -41 28 -28 L30 0Z';
const NECK = 'M-5 -45 L5 -45 L6 -37 Q0 -33 -6 -37Z';
const HAIR_BACK = 'M-15 -62 C-19 -88 19 -88 15 -62 L17 -36 L-17 -36Z';
const HAIR_FRONT =
  'M-15 -57 C-19 -80 -3 -83 3 -81 C16 -82 19 -68 15 -57 C13 -66 7 -70 0 -69 C-8 -68 -13 -64 -15 -57Z';

type Props = {
  x: number; // centre x inside the stage
  side: 1 | -1; // which arm does the hand-off (+1 right, -1 left)
  look: RqLook;
  hand: SharedValue<number[]>; // target hand position, person-local units
  smile: SharedValue<boolean>;
  lc: SharedValue<number>; // loop clock of the owning scene
  sway: SharedValue<number>; // scroll spring angle
  blinkPhase?: number;
};

/** Static children are rasterized to a texture and just get moved around. */
function Raster({ children }: { children: React.ReactNode }) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      {children}
    </View>
  );
}

function RqFolkBase({ x, side, look, hand, smile, lc, sway, blinkPhase = 0 }: Props) {
  const { skin, hair, hairLong, shirt, longSleeve, deco, helmet } = look;
  const arm = useDerivedValue(() => rqSolveArm(side, hand.value));

  const T1 = 9; // upper arm thickness
  const T2 = longSleeve ? 8 : 6.4; // forearm thickness
  const forearmColor = longSleeve ? shirt : skin[0];

  // whole person: breathing + lean from scroll spring, pivoting at the feet
  const wrap = useAnimatedStyle(() => {
    const b = 1 + 0.02 * (0.5 - 0.5 * Math.cos(RQ_TAU * ((lc.value % 3600) / 3600)));
    return { transform: [{ rotate: `${sway.value * 0.28}deg` }, { scaleY: b }] };
  });

  const upper = useAnimatedStyle(() => {
    const a = arm.value;
    return {
      transform: [
        { translateX: PX(a.sx) - (T1 * S) / 2 },
        { translateY: PY(a.sy) - (T1 * S) / 2 },
        { rotate: `${Math.atan2(a.ey - a.sy, a.ex - a.sx)}rad` },
      ],
    };
  });
  const fore = useAnimatedStyle(() => {
    const a = arm.value;
    return {
      transform: [
        { translateX: PX(a.ex) - (T2 * S) / 2 },
        { translateY: PY(a.ey) - (T2 * S) / 2 },
        { rotate: `${Math.atan2(a.hy - a.ey, a.hx - a.ex)}rad` },
      ],
    };
  });
  const palm = useAnimatedStyle(() => {
    const a = arm.value;
    return { transform: [{ translateX: PX(a.hx) - 4.6 * S }, { translateY: PY(a.hy) - 4.6 * S }] };
  });
  const thumb = useAnimatedStyle(() => {
    const a = arm.value;
    return { transform: [{ translateX: PX(a.tx) - 2.2 * S }, { translateY: PY(a.ty) - 2.2 * S }] };
  });

  const eyes = useAnimatedStyle(() => ({
    transform: [{ scaleY: rqBlink(lc.value, blinkPhase) }],
  }));
  const mouthSmall = useAnimatedStyle(() => ({ opacity: smile.value ? 0 : 1 }));
  const mouthBig = useAnimatedStyle(() => ({ opacity: smile.value ? 1 : 0 }));

  const frame = {
    position: 'absolute' as const,
    left: x - -VB_X * S,
    top: RQ_STAGE_H - VB_H * S,
    width: VB_W * S,
    height: VB_H * S,
  };

  return (
    <Animated.View pointerEvents="none" style={[frame, { transformOrigin: ['50%', '100%', 0] }, wrap]}>
      {/* layer 1: torso, clothing, resting sleeve (static) */}
      <Raster>
        <Svg width={VB_W * S} height={VB_H * S} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
          <Path d={TORSO} fill={shirt} />
          {deco === 'apron' && (
            <>
              <Path d="M-14 -43 L14 -43 L17 0 L-17 0Z" fill="#7b4a2b" />
              <Rect x={-8} y={-22} width={16} height={8} rx={2} fill="#5e3820" />
            </>
          )}
          {deco === 'jacket' && (
            <Path d="M-27.5 -30 L27.5 -30 L27 -25 L-27 -25Z" fill="#fff" opacity={0.85} />
          )}
          {deco === 'blazer' && (
            <>
              <Path d="M-7 -43 L0 -26 L7 -43Z" fill="#fff" />
              <Path d="M-2 -40 L2 -40 L1.5 -28 L0 -25 L-1.5 -28Z" fill="#D9694F" />
            </>
          )}
          {/* the arm that is NOT handing anything over just rests along the body */}
          <Line
            x1={-side * 24}
            y1={-34}
            x2={-side * 29}
            y2={-3}
            stroke={shirt}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </Svg>
      </Raster>

      {/* layer 2: the working arm, as rotated rounded Views (GPU transforms only) */}
      <Animated.View
        style={[
          styles.abs,
          {
            width: (16 + T1) * S,
            height: T1 * S,
            borderRadius: (T1 * S) / 2,
            backgroundColor: shirt,
            transformOrigin: [(T1 * S) / 2, (T1 * S) / 2, 0],
          },
          upper,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          {
            width: (16 + T2) * S,
            height: T2 * S,
            borderRadius: (T2 * S) / 2,
            backgroundColor: forearmColor,
            transformOrigin: [(T2 * S) / 2, (T2 * S) / 2, 0],
          },
          fore,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          { width: 9.2 * S, height: 9.2 * S, borderRadius: 4.6 * S, backgroundColor: skin[0] },
          palm,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          { width: 4.4 * S, height: 4.4 * S, borderRadius: 2.2 * S, backgroundColor: skin[0] },
          thumb,
        ]}
      />

      {/* layer 3: neck, ears, head, hair (static) */}
      <Raster>
        <Svg width={VB_W * S} height={VB_H * S} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
          {hairLong && <Path d={HAIR_BACK} fill={hair} />}
          <Path d={NECK} fill={skin[1]} />
          <Circle cx={-14.2} cy={-58} r={3} fill={skin[0]} />
          <Circle cx={14.2} cy={-58} r={3} fill={skin[1]} />
          <Ellipse cx={0} cy={-60} rx={14} ry={16} fill={skin[0]} />
          <Path d="M0 -76 A14 16 0 0 1 0 -44Z" fill={skin[1]} />
          <Path d={HAIR_FRONT} fill={hair} />
          {helmet && (
            <>
              <Path d="M-16 -63 C-16 -85 16 -85 16 -63Z" fill="#E8743B" />
              <Rect x={-17} y={-65} width={34} height={3} rx={1.5} fill="#C95A25" />
            </>
          )}
        </Svg>
      </Raster>

      {/* layer 4: face details, tiny Views (blink + smile) */}
      <Animated.View
        style={[
          styles.abs,
          { left: PX(-5.5) - 1.7 * S, top: PY(-59) - 1.7 * S, width: 3.4 * S, height: 3.4 * S, borderRadius: 1.7 * S, backgroundColor: '#2b1d16' },
          eyes,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          { left: PX(5.5) - 1.7 * S, top: PY(-59) - 1.7 * S, width: 3.4 * S, height: 3.4 * S, borderRadius: 1.7 * S, backgroundColor: '#2b1d16' },
          eyes,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          {
            left: PX(-5),
            top: PY(-52.8),
            width: 10 * S,
            height: 3.2 * S,
            borderBottomWidth: 1.6 * S,
            borderBottomLeftRadius: 5 * S,
            borderBottomRightRadius: 5 * S,
            borderColor: '#7a3b2e',
          },
          mouthSmall,
        ]}
      />
      <Animated.View
        style={[
          styles.abs,
          {
            left: PX(-6),
            top: PY(-52),
            width: 12 * S,
            height: 4.6 * S,
            borderBottomLeftRadius: 6 * S,
            borderBottomRightRadius: 6 * S,
            backgroundColor: '#8b3a3a',
          },
          mouthBig,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});

export const RqFolk = memo(RqFolkBase);
