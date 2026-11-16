// rqstage / RqSceneDeck.tsx
// The right-anchored 280x250 stage: sparkles, three switching scenes (backdrop layer +
// people layer), the amber switch blade. Scroll parallax is applied to whole LAYERS
// (3 styles in total), not to every object.
//
// The stage is authored in a fixed 280x250 coordinate system. On narrow phones it is
// scaled down as a whole (origin: bottom right, so the feet stay on the ground line)
// so it never collides with the text column. Text inside the stage (the match chip)
// is pre-compensated by 1/scale so it stays legible.

import React, { memo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Ellipse, Path, Polygon, Rect } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  RQ_CAND_X,
  RQ_CLR,
  RQ_EMP_X,
  RQ_FONT,
  RQ_SCENE_DEFS,
  RQ_STAGE_H,
  RQ_STAGE_W,
  RqItemKind,
  RqSceneDef,
  rqLayout,
} from './rqTokens';
import { RQ_TAU, rqHandoff } from './rqMotionMath';
import { RqSceneSV, RqTick } from './rqTicker';
import { RqFolk } from './RqFolk';
import { RqBackdrop } from './RqBackdropSet';

const Fill = StyleSheet.absoluteFill;
const BADGE_X = RQ_CAND_X + 22;
const BADGE_Y = 140;

function useSceneRoot(s: RqSceneSV) {
  return useAnimatedStyle(() => ({
    opacity: s.op.value,
    transform: [{ translateX: s.dx.value }],
  }));
}

/** The thing being handed over. Static SVG; only the steam has its own opacity style. */
function RqItemArt({ kind, lc }: { kind: RqItemKind; lc: SharedValue<number> }) {
  const steam = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.7 * (0.5 - 0.5 * Math.cos(RQ_TAU * ((lc.value % 1400) / 1400))),
  }));
  return (
    <View pointerEvents="none" style={Fill}>
      {/* static art is rasterized once; the animated steam lives OUTSIDE this wrapper */}
      <View style={Fill} renderToHardwareTextureAndroid shouldRasterizeIOS>
        <Svg width={40} height={40} viewBox="-20 -20 40 40">
          {kind === 'cup' && (
            <>
              <Rect x={-7} y={-8} width={12} height={14} rx={3} fill="#fff" />
              <Path d="M5 -4 q6 0 6 4 q0 4 -6 4" stroke="#fff" strokeWidth={2} fill="none" />
            </>
          )}
          {kind === 'parcel' && (
            <>
              <Rect x={-10} y={-9} width={20} height={18} rx={2} fill="#C98F52" />
              <Rect x={-2} y={-9} width={4} height={18} fill="#E7C089" />
            </>
          )}
          {kind === 'folder' && (
            <>
              <Rect x={-10} y={-11} width={9} height={4} rx={1.5} fill={RQ_CLR.amber} />
              <Rect x={-10} y={-8} width={20} height={16} rx={2} fill={RQ_CLR.amber} />
              <Path d="M-4 0 l3 3 l6 -6" stroke={RQ_CLR.ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </Svg>
      </View>
      {kind === 'cup' && (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, steam]}>
          <Svg width={40} height={40} viewBox="-20 -20 40 40">
            <Path d="M-3 -12 q2 -3 0 -6" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

function FingerArt({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={Fill} renderToHardwareTextureAndroid shouldRasterizeIOS>
      <Svg width={20} height={8} viewBox="-10 -4 20 8">
        <Ellipse cx={0} cy={0} rx={9} ry={3.4} fill={color} />
      </Svg>
    </View>
  );
}

const RqSceneBack = memo(function RqSceneBack({
  s,
  def,
  sway,
}: {
  s: RqSceneSV;
  def: RqSceneDef;
  sway: SharedValue<number>;
}) {
  const root = useSceneRoot(s);
  return (
    <Animated.View pointerEvents="none" style={[Fill, root]}>
      <RqBackdrop kind={def.key} lc={s.lc} sway={sway} />
    </Animated.View>
  );
});

const RqScenePeople = memo(function RqScenePeople({
  s,
  def,
  sway,
  stageScale,
}: {
  s: RqSceneSV;
  def: RqSceneDef;
  sway: SharedValue<number>;
  stageScale: number;
}) {
  const root = useSceneRoot(s);
  const pose = useDerivedValue(() => rqHandoff(s.t.value, RQ_EMP_X, RQ_CAND_X));
  const empHand = useDerivedValue(() => pose.value.eh);
  const candHand = useDerivedValue(() => pose.value.ch);
  const smile = useDerivedValue(() => pose.value.smile);

  const item = useAnimatedStyle(() => {
    const p = pose.value;
    return {
      opacity: p.io,
      transform: [
        { translateX: p.ix },
        { translateY: p.iy },
        { rotate: `${sway.value * 2}deg` },
        { scale: p.pop },
      ],
    };
  });
  const fingerEmp = useAnimatedStyle(() => {
    const p = pose.value;
    return {
      opacity: p.fingerC === 0 ? p.fingerOp : 0,
      transform: [{ translateX: p.ix }, { translateY: p.iy + 7 }],
    };
  });
  const fingerCand = useAnimatedStyle(() => {
    const p = pose.value;
    return {
      opacity: p.fingerC === 1 ? p.fingerOp : 0,
      transform: [{ translateX: p.ix }, { translateY: p.iy + 7 }],
    };
  });
  const badge = useAnimatedStyle(() => {
    const p = pose.value;
    return {
      opacity: p.bOp,
      transform: [{ translateX: BADGE_X }, { translateY: BADGE_Y }, { scale: p.bScale }],
    };
  });

  // The chip carries text, so it is sized in "visual" pixels and pre-compensated by
  // 1/stageScale: it keeps its intended size on screen whatever the stage scale is.
  const inv = 1 / Math.max(0.2, stageScale);
  const chipW = def.chipW * inv;
  const chipX = Math.min(RQ_CAND_X, RQ_STAGE_W - 6 - chipW / 2);
  const chip = useAnimatedStyle(() => {
    const p = pose.value;
    return {
      opacity: p.chipOp,
      transform: [{ translateX: chipX }, { translateY: 112 - p.chipRise * 10 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[Fill, root]}>
      <RqFolk x={RQ_EMP_X} side={1} look={def.emp} hand={empHand} smile={smile} lc={s.lc} sway={sway} blinkPhase={300} />
      <RqFolk x={RQ_CAND_X} side={-1} look={def.cand} hand={candHand} smile={smile} lc={s.lc} sway={sway} blinkPhase={1900} />

      <Animated.View style={[{ position: 'absolute', left: -20, top: -20, width: 40, height: 40 }, item]}>
        <RqItemArt kind={def.item} lc={s.lc} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: -10, top: -4, width: 20, height: 8 }, fingerEmp]}>
        <FingerArt color={def.emp.skin[0]} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: -10, top: -4, width: 20, height: 8 }, fingerCand]}>
        <FingerArt color={def.cand.skin[0]} />
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', left: -10, top: -10, width: 20, height: 20 }, badge]}>
        <Svg width={20} height={20} viewBox="-10 -10 20 20">
          <Path d="M-7 0 A7 7 0 1 0 7 0 A7 7 0 1 0 -7 0Z" fill={RQ_CLR.amber} />
          <Path d="M-3 0 L-1 2.5 L3.5 -2.5" stroke={RQ_CLR.ink} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute', left: -chipW / 2, top: -9 * inv, width: chipW, height: 18 * inv,
            borderRadius: 9 * inv, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
          },
          chip,
        ]}
      >
        <Text
          style={{
            fontSize: 11 * inv, lineHeight: 14 * inv, fontFamily: RQ_FONT.bodyMed,
            color: RQ_CLR.chipText, includeFontPadding: false,
          }}
        >
          {def.chip}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

function RqSpark({ x, y, i, color, clock }: { x: number; y: number; i: number; color: string; clock: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const c = clock.value - i * 700;
    const k = c <= 0 ? 0 : 0.5 - 0.5 * Math.cos(RQ_TAU * ((c % 2600) / 2600));
    return { opacity: 0.2 + 0.75 * k, transform: [{ scale: 0.6 + 0.5 * k }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 6, top: y - 6, width: 12, height: 12 }, st]}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <Svg width={12} height={12} viewBox="-6 -6 12 12">
        <Path d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

export const RqSceneDeck = memo(function RqSceneDeck({
  tick,
  scrollY,
}: {
  tick: RqTick;
  scrollY: SharedValue<number>;
}) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const { stageScale } = rqLayout(width);
  // Parallax is a scroll response; under reduce-motion the banner holds still.
  const px = reduce ? 0 : 1;

  const sparkLayer = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, scrollY.value) * 0.2 * px }],
  }));
  const backLayer = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, scrollY.value) * 0.12 * px }],
  }));
  // characters lag behind the scroll and sink behind the curved ground edge
  const peopleLayer = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(Math.max(0, scrollY.value) * 0.4 * px, 80 * px) }],
  }));
  const blade = useAnimatedStyle(() => ({
    opacity: tick.bladeO.value,
    transform: [{ translateX: tick.bladeX.value }],
  }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute', right: 0, top: 0, width: RQ_STAGE_W, height: RQ_STAGE_H,
        overflow: 'hidden', transformOrigin: '100% 100%', transform: [{ scale: stageScale }],
      }}
    >
      <Animated.View style={[Fill, sparkLayer]}>
        <RqSpark x={40} y={20} i={0} color="#fff" clock={tick.clock} />
        <RqSpark x={120} y={14} i={1} color={RQ_CLR.amber} clock={tick.clock} />
        <RqSpark x={250} y={16} i={2} color="#fff" clock={tick.clock} />
      </Animated.View>

      <Animated.View style={[Fill, backLayer]}>
        {RQ_SCENE_DEFS.map((def, i) => (
          <RqSceneBack key={def.key} s={tick.scenes[i]} def={def} sway={tick.sway} />
        ))}
      </Animated.View>

      <Animated.View style={[Fill, peopleLayer]}>
        {RQ_SCENE_DEFS.map((def, i) => (
          <RqScenePeople key={def.key} s={tick.scenes[i]} def={def} sway={tick.sway} stageScale={stageScale} />
        ))}
      </Animated.View>

      <Animated.View style={[Fill, blade]} renderToHardwareTextureAndroid shouldRasterizeIOS>
        <Svg width={RQ_STAGE_W + 80} height={RQ_STAGE_H} viewBox={`0 0 ${RQ_STAGE_W + 80} ${RQ_STAGE_H}`}>
          <Polygon points="272,0 316,0 276,250 232,250" fill={RQ_CLR.amber} />
        </Svg>
      </Animated.View>
    </View>
  );
});
