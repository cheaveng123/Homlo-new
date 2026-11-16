import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { BOOST_PLANS } from "@/lib/boostData";

const SLIDE_DURATION = 280;

// The outgoing plan travels 0 -> +width and the incoming travels +width -> 0,
// so both move rightward off the edge and back in from the right edge.
function PlanImageLayer({
  planIndex,
  selectedIndex,
  width,
  height,
}: {
  planIndex: number;
  selectedIndex: SharedValue<number>;
  width: number;
  height: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = selectedIndex.value - planIndex;
    return {
      transform: [{ translateX: distance * width }],
      opacity: Math.abs(distance) <= 1 ? 1 : 0,
    };
  });

  return (
    <Animated.Image
      resizeMode="contain"
      source={BOOST_PLANS[planIndex].image}
      style={[styles.image, { height, width }, animatedStyle]}
    />
  );
}

export function BoostPlanImage({
  index,
  width,
  height = 150,
}: {
  index: number;
  width: number;
  height?: number;
}) {
  const selectedIndex = useSharedValue(index);

  useEffect(() => {
    // withTiming always starts from the value's current position, so a new
    // selection mid-flight re-targets the running animation rather than
    // restarting it from 0 — no queued or stranded transitions.
    selectedIndex.value = withTiming(index, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [index, selectedIndex]);

  return (
    <View pointerEvents="none" style={[styles.stage, { height, width }]}>
      {BOOST_PLANS.map((plan, planIndex) => (
        <PlanImageLayer
          height={height}
          key={plan.id}
          planIndex={planIndex}
          selectedIndex={selectedIndex}
          width={width}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // No background and no radius: the image sits directly on whatever is behind
  // it. overflow hidden is still needed to clip the sliding layers.
  stage: { overflow: "hidden" },
  image: { left: 0, position: "absolute", top: 0 },
});
