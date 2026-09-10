import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import { useRef } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { motion } from "@/lib/animation-presets";

export function HapticTab(props: BottomTabBarButtonProps) {
  const scale = useSharedValue(1);
  const lastPressAt = useRef(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <PlatformPressable
        {...props}
        onPress={(event) => {
          const now = Date.now();
          if (now - lastPressAt.current < 220) return;
          lastPressAt.current = now;
          props.onPress?.(event);
        }}
        onPressIn={(ev) => {
          scale.set(withTiming(motion.pressScale, { duration: motion.pressDuration }));
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(ev);
        }}
        onPressOut={(ev) => {
          scale.set(withTiming(1, { duration: motion.releaseDuration }));
          props.onPressOut?.(ev);
        }}
      />
    </Animated.View>
  );
}
