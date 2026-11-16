import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from './theme';

/**
 * Mirrors the approved mockup's header wash: a soft mint bloom from the
 * upper-left, a faint white highlight upper-right, fading to the page
 * background before the job feed starts. Uses a true radial gradient via
 * react-native-svg — CSS radial-gradient has no flexbox/RN equivalent, and
 * approximating it with LinearGradient is what usually makes the color
 * "not there" after a port.
 */
export function HomeHeaderBackground({ height }: { height: number }) {
  const { width } = useWindowDimensions();
  return (
    <Svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <Defs>
        <RadialGradient id="mintBloom" cx="6%" cy="-10%" r="95%">
          <Stop offset="0%" stopColor={colors.mint} stopOpacity={0.65} />
          <Stop offset="38%" stopColor={colors.mint} stopOpacity={0.28} />
          <Stop offset="68%" stopColor={colors.mint} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="whiteHighlight" cx="100%" cy="-10%" r="85%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={colors.pageBg} />
      <Rect width={width} height={height} fill="url(#mintBloom)" />
      <Rect width={width} height={height} fill="url(#whiteHighlight)" />
    </Svg>
  );
}
