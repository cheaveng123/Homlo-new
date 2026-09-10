import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { motion } from "@/lib/animation-presets";
import { haptic } from "@/lib/haptics";

type ScalePressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  hapticFeedback?: boolean;
};

export function ScalePressable({
  children,
  containerStyle,
  hapticFeedback = false,
  onPressIn,
  onPressOut,
  style,
  ...props
}: ScalePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          scale.set(withTiming(motion.pressScale, { duration: motion.pressDuration }));
          if (hapticFeedback) haptic.light();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withTiming(1, { duration: motion.releaseDuration }));
          onPressOut?.(event);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
