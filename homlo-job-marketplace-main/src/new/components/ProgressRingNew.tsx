import React, { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { colorsNew } from '../theme/tokensNew';

const AC = Animated.createAnimatedComponent(Circle);

/** Ring that fills on mount. progress 0..1. */
export function ProgressRingNew({ progress, size = 96, stroke = 11, children }: { progress: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    p.value = reduced ? progress : withDelay(200, withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduced]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colorsNew.track} strokeWidth={stroke} fill="none" />
        <AC cx={size / 2} cy={size / 2} r={r} stroke={colorsNew.primary} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      {children}
    </View>
  );
}
