import React, { useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "@/lib/native/haptics";

import { type BoostPlan, priceFor } from "@/lib/boostData";
import { colors, fonts } from "@/theme";

const ITEM_WIDTH = 92;
type Props = {
  plans: BoostPlan[];
  index: number;
  onChange: (index: number) => void;
  recommendedIndex: number;
  isPro?: boolean;
  /** Measured container width. Falls back to the window, which on web includes
   *  the scrollbar and pushes the range and its handle past the right edge. */
  width?: number;
};

export function PriceRange({
  plans,
  index,
  onChange,
  recommendedIndex,
  isPro = false,
  width: measuredWidth,
}: Props) {
  const window = useWindowDimensions();
  const width = measuredWidth && measuredWidth > 0 ? measuredWidth : window.width;
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = useRef(index);
  const animating = useRef(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      scrollRef.current?.scrollTo({ x: index * ITEM_WIDTH, animated: false });
      return;
    }

    if (currentIndex.current === index) return;
    currentIndex.current = index;
    animating.current = true;
    scrollRef.current?.scrollTo({ x: index * ITEM_WIDTH, animated: true });
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = setTimeout(() => {
      animating.current = false;
    }, 450);
  }, [index]);

  useEffect(
    () => () => {
      if (animationTimer.current) clearTimeout(animationTimer.current);
    },
    [],
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (animating.current || plans.length === 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(
        plans.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH),
      ),
    );
    if (nextIndex === currentIndex.current) return;
    currentIndex.current = nextIndex;
    void Haptics.selectionAsync();
    onChange(nextIndex);
  };

  return (
    <View style={{ height: 84, width }}>
      <View pointerEvents="none" style={styles.line} />
      <ScrollView
        ref={scrollRef}
        accessibilityLabel="Boost price range"
        contentContainerStyle={{
          paddingHorizontal: Math.max(0, (width - ITEM_WIDTH) / 2),
        }}
        decelerationRate="fast"
        horizontal
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
      >
        {plans.map((plan, planIndex) => (
          <Pressable
            key={plan.id}
            accessibilityLabel={`${plan.name}, ${priceFor(plan, isPro).toFixed(2)} dollars`}
            accessibilityRole="button"
            onPress={() => onChange(planIndex)}
            style={styles.stop}
          >
            <Text style={[styles.price, planIndex === index && styles.priceOn]}>
              {priceFor(plan, isPro).toFixed(0)}
            </Text>
            <View style={styles.dot} />
            {planIndex === recommendedIndex ? (
              <Text style={styles.recommended}>Recommended</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      <View
        pointerEvents="none"
        style={[styles.handle, { left: Math.max(0, (width - 26) / 2) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    backgroundColor: colors.teal,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: 34,
  },
  stop: { alignItems: "center", height: 84, width: ITEM_WIDTH },
  price: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 12,
    paddingTop: 2,
  },
  priceOn: { color: colors.text, fontSize: 15 },
  dot: {
    backgroundColor: colors.teal,
    borderRadius: 3,
    height: 6,
    opacity: 0.3,
    position: "absolute",
    top: 32,
    width: 6,
  },
  recommended: {
    color: colors.teal,
    fontFamily: fonts.bold,
    fontSize: 10.5,
    position: "absolute",
    top: 54,
  },
  handle: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.teal,
    borderRadius: 13,
    borderWidth: 3,
    elevation: 4,
    height: 26,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    top: 22,
    width: 26,
  },
});
