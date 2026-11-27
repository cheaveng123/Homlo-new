// rqstage / RqWaveBands.tsx
// Three drifting wave bands with scroll parallax, plus the curved ground cut at the bottom.
//
// Why this is light:
//  - Each wave is only a ~40px tall strip (not a huge filled SVG). Everything below the
//    strip is a plain solid-colour View.
//  - The strip pattern repeats every 340px, so the drift only travels 340px and loops
//    seamlessly. The strip texture is rasterized once and just translated.

import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { SharedValue, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { RQ_CLR, RQ_STAGE_H, RQ_WAVE_PERIOD } from './rqTokens';

type Band = { y: number; color: string; periodMs: number; dir: 1 | -1; parallax: number };

const BANDS: Band[] = [
  { y: 96, color: RQ_CLR.waveBack, periodMs: 26000, dir: -1, parallax: 0.08 },
  { y: 136, color: RQ_CLR.waveMid, periodMs: 19000, dir: 1, parallax: 0.16 },
  { y: 176, color: RQ_CLR.waveFront, periodMs: 15000, dir: -1, parallax: 0.26 },
];

function wavePath(y: number, width: number) {
  let d = `M0 ${y} Q85 ${y - 26} 170 ${y}`;
  for (let x = 340; x <= width + 170; x += 170) d += ` T${x} ${y}`;
  return `${d} L${width + 170} ${y + 20} L0 ${y + 20} Z`;
}

const STRIP_H = 40;

function WaveBand({
  band,
  width,
  clock,
  scrollY,
}: {
  band: Band;
  width: number;
  clock: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const stripW = Math.ceil((width + RQ_WAVE_PERIOD) / RQ_WAVE_PERIOD) * RQ_WAVE_PERIOD;
  const d = useMemo(() => wavePath(band.y, stripW), [band.y, stripW]);
  // Under reduce-motion the banner holds still: no parallax, and the drift is frozen
  // because the ticker clock stops.
  const px = useReducedMotion() ? 0 : 1;

  const par = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, scrollY.value) * band.parallax * px }],
  }));
  const drift = useAnimatedStyle(() => {
    const p = (clock.value % band.periodMs) / band.periodMs;
    return {
      transform: [{ translateX: band.dir < 0 ? -RQ_WAVE_PERIOD * p : -RQ_WAVE_PERIOD + RQ_WAVE_PERIOD * p }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, par]}>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: band.y - 20, width: stripW + 170, height: STRIP_H }, drift]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <Svg width={stripW + 170} height={STRIP_H} viewBox={`0 ${band.y - 20} ${stripW + 170} ${STRIP_H}`}>
          <Path d={d} fill={band.color} />
        </Svg>
      </Animated.View>
      <View
        style={{
          position: 'absolute', left: 0, right: 0, top: band.y + 19, height: RQ_STAGE_H * 2,
          backgroundColor: band.color,
        }}
      />
    </Animated.View>
  );
}

export const RqWaveBands = memo(function RqWaveBands({
  clock,
  scrollY,
}: {
  clock: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BANDS.map((b) => (
        <WaveBand key={b.y} band={b} width={width} clock={clock} scrollY={scrollY} />
      ))}
    </View>
  );
});

/** Curved bottom edge of the banner, drawn in the page background colour. */
export const RqGroundCut = memo(function RqGroundCut({ pageBg }: { pageBg: string }) {
  const { width } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, bottom: -1, width, height: 32 }}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <Svg width={width} height={32} viewBox={`0 0 ${width} 32`}>
        <Path d={`M0 32 L0 14 Q${width / 2} -14 ${width} 14 L${width} 32Z`} fill={pageBg} />
      </Svg>
    </View>
  );
});
