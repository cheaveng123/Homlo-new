import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number };

// Every button and card shrinks to 0.975 on press.
export function PressableScale({ style, scaleTo = 0.975, onPressIn, onPressOut, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { if (!reduced) { // eslint-disable-next-line react-hooks/immutability
        s.value = withTiming(scaleTo, { duration: 90 }); } onPressIn?.(e); }}
      onPressOut={(e) => { if (!reduced) { // eslint-disable-next-line react-hooks/immutability
        s.value = withTiming(1, { duration: 140 }); } onPressOut?.(e); }}
      style={[style, a]}
    >
      {children}
    </AnimatedPressable>
  );
}