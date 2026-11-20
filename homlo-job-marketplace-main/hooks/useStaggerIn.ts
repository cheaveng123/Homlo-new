import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring } from 'react-native-reanimated';

export function useStaggerIn(index: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = Math.min(index, 8) * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 200 }));
  }, [index, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}