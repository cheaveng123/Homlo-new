import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

export function SkeletonBlock({ width, height = 12, borderRadius = 8, style }: {
  width: number | string; height?: number; borderRadius?: number; style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withSequence(withTiming(0.55, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
    return () => cancelAnimation(o);
  }, [reduce, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.block, { width, height, borderRadius } as ViewStyle, style, a]} />
  );
}

export function SkeletonGroup({ count, height, gap = 8 }: { count: number; height: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {[...Array(count)].map((_, i) => (
        <SkeletonBlock key={i} width="100%" height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#D5E6EA', borderRadius: 8 },
});
