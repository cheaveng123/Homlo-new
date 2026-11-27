// rqstage / RqBackdropSet.tsx
// The three animated backdrops (café, delivery, office), in stage coordinates (0..280 x 0..250).
//
// Smoothness rules used here:
//  - Every moving object is its own Animated.View driven by a transform/opacity style
//    (GPU composited, diffed by Reanimated, no SVG redraw).
//  - SVG art inside moving views is static and rasterized once.
//  - Only the route dash uses an animated SVG prop, on a tiny SVG, quantized to 0.5px steps.
//  - Everything reads the scene's own loop clock `lc`, which only advances while that scene
//    is visible, so hidden scenes cost nothing.

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { RQ_CLR } from './rqTokens';
import { rqPulse } from './rqMotionMath';

const APath = Animated.createAnimatedComponent(Path);
type SV = SharedValue<number>;

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

/** Drifting cloud: one static single-path SVG, moved by translateX only. */
function Cloud({ lc, left, top }: { lc: SV; left: number; top: number }) {
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: ((lc.value % 11000) / 11000) * 90 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left, top, width: 30, height: 15 }, st]}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <Svg width={30} height={15} viewBox="0 0 30 15">
        <Path
          d="M4.5 15 A4.5 4.5 0 0 1 4.5 6 H8 A6 6 0 0 1 20 6 H25.5 A4.5 4.5 0 0 1 25.5 15 Z"
          fill="#ffffff"
          fillOpacity={0.35}
        />
      </Svg>
    </Animated.View>
  );
}

function Cafe({ lc, sway }: { lc: SV; sway: SV }) {
  const lamp = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.sin(lc.value * 0.0016) * 3 + sway.value * 0.9}deg` }],
  }));
  const dot = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * rqPulse(lc.value, 1800) }));
  return (
    <>
      <View
        style={{
          position: 'absolute', left: 8, top: 34, width: 60, height: 86,
          borderTopLeftRadius: 30, borderTopRightRadius: 30,
          backgroundColor: RQ_CLR.windowTeal, overflow: 'hidden',
        }}
      >
        <Cloud lc={lc} left={-16} top={22} />
      </View>
      <View
        style={{
          position: 'absolute', left: 172, top: 30, width: 92, height: 50,
          borderRadius: 6, backgroundColor: RQ_CLR.boardTeal,
        }}
      >
        {[[10, 12, 44], [10, 22, 30], [10, 32, 50]].map(([l, t, w], i) => (
          <View
            key={i}
            style={{
              position: 'absolute', left: l, top: t, width: w, height: 3,
              borderRadius: 1.5, backgroundColor: RQ_CLR.lineTeal,
            }}
          />
        ))}
        <Animated.View
          style={[
            { position: 'absolute', left: 77, top: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: RQ_CLR.amber },
            dot,
          ]}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 120, top: 0, width: 40, height: 56, transformOrigin: ['50%', 0, 0] },
          lamp,
        ]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <Svg width={40} height={56} viewBox="0 0 40 56">
          <Line x1={20} y1={0} x2={20} y2={34} stroke={RQ_CLR.lampLine} strokeWidth={1.5} />
          <Path d="M4 52 Q20 30 36 52Z" fill={RQ_CLR.amber} />
        </Svg>
      </Animated.View>
    </>
  );
}

function Delivery({ lc, sway }: { lc: SV; sway: SV }) {
  const pin = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(lc.value * 0.002) * 3 },
      { rotate: `${sway.value * 0.7 + Math.sin(lc.value * 0.0013) * 2}deg` },
    ],
  }));
  // ripple = a circle squashed into an ellipse (rigid transform, no SVG redraw)
  const ripple = useAnimatedStyle(() => {
    const p = (lc.value % 2000) / 2000;
    const s = (4 + 18 * p) / 22;
    return { opacity: 0.8 * (1 - p), transform: [{ scaleX: s }, { scaleY: s * 0.32 }] };
  });
  const dest = useAnimatedStyle(() => {
    const k = rqPulse(lc.value, 1800);
    return { opacity: 1 - 0.5 * k, transform: [{ scale: 1 + 0.5 * k }] };
  });
  const dash = useAnimatedProps(() => ({
    strokeDashoffset: -Math.round((((lc.value % 1400) / 1400) * 20) * 2) / 2,
  }));
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 28, top: 81, width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: RQ_CLR.coral },
          ripple,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 26, top: 36, width: 48, height: 64, transformOrigin: ['50%', '100%', 0] },
          pin,
        ]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <Svg width={48} height={64} viewBox="0 0 48 64">
          <Path d="M24 64 C24 64 0 40 0 24 A24 24 0 0 1 48 24 C48 40 24 64 24 64Z" fill={RQ_CLR.coral} />
          <Path d="M16 24 A8 8 0 1 0 32 24 A8 8 0 1 0 16 24Z" fill={RQ_CLR.header} />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 76, top: 30, width: 170, height: 100 }}>
        <Svg width={170} height={100} viewBox="76 30 170 100">
          <APath
            d="M86 88 C130 40 184 118 234 68"
            stroke={RQ_CLR.lineTeal}
            strokeWidth={2}
            strokeDasharray="4 6"
            fill="none"
            animatedProps={dash}
          />
        </Svg>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 232, top: 58, width: 12, height: 12, borderRadius: 6, backgroundColor: RQ_CLR.mintSky },
          dest,
        ]}
      />
    </>
  );
}

function Office({ lc }: { lc: SV }) {
  const minute = useAnimatedStyle(() => ({
    transform: [{ rotate: `${((lc.value % 10000) / 10000) * 360}deg` }],
  }));
  return (
    <>
      <View
        style={{
          position: 'absolute', left: 8, top: 34, width: 68, height: 76,
          borderRadius: 6, backgroundColor: RQ_CLR.windowTeal, overflow: 'hidden',
        }}
      >
        <Cloud lc={lc} left={-16} top={18} />
        <View style={{ position: 'absolute', left: 33, top: 0, width: 2, height: 76, backgroundColor: RQ_CLR.header }} />
        <View style={{ position: 'absolute', left: 0, top: 36, width: 68, height: 2, backgroundColor: RQ_CLR.header }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 144, top: 42, width: 32, height: 32 }}>
        <Raster>
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Path d="M1 16 A15 15 0 1 0 31 16 A15 15 0 1 0 1 16Z" fill={RQ_CLR.boardTeal} stroke={RQ_CLR.lineTeal} strokeWidth={2} />
            <Line x1={16} y1={16} x2={23} y2={20} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Raster>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: 0, width: 32, height: 32 }, minute]}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
        >
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Line x1={16} y1={16} x2={16} y2={3} stroke={RQ_CLR.amber} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
    </>
  );
}

export const RqBackdrop = memo(function RqBackdrop({
  kind,
  lc,
  sway,
}: {
  kind: 'cafe' | 'delivery' | 'office';
  lc: SV;
  sway: SV;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {kind === 'cafe' && <Cafe lc={lc} sway={sway} />}
      {kind === 'delivery' && <Delivery lc={lc} sway={sway} />}
      {kind === 'office' && <Office lc={lc} />}
    </View>
  );
});
