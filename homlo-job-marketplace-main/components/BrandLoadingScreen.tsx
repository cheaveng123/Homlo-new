import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, useColorScheme, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { BRAND_COLORS, BRAND_IMAGES } from "@/constants/brand";

const ANIMATION_MS = 600;

export function BrandLoadingScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: ANIMATION_MS });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: dark ? BRAND_COLORS.darkTeal : BRAND_COLORS.cyan },
      ]}
    >
      <Animated.View style={[styles.logoWrap, animatedStyle]}>
        <Image
          source={dark ? BRAND_IMAGES.logoOnDark() : BRAND_IMAGES.logoOnBlue()}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="HireNow"
        />
      </Animated.View>
      <ActivityIndicator color="#FFFFFF" size="small" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoWrap: {
    width: "100%",
    alignItems: "center",
  },
  logo: {
    width: "80%",
    maxWidth: 360,
    aspectRatio: 2400 / 517,
  },
  spinner: {
    marginTop: 28,
  },
});
