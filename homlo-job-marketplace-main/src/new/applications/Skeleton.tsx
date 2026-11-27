import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors, radii } from './theme';

// Grey-teal block that pulses gently.
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withSequence(withTiming(0.55, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
    return () => cancelAnimation(o);
  }, [reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: colors.track, borderRadius: radii.chip }, style, a]} />;
}