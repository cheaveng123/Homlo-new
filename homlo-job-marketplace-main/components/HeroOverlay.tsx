import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useHeroTransitionStore } from '@/store/heroTransitionStore';
import { HERO_IMAGE_HEIGHT } from '@/constants/hero';

const { width: SCREEN_W } = Dimensions.get('window');
const SPRING = { damping: 18, stiffness: 180, mass: 1 };

export function HeroOverlay() {
  const active = useHeroTransitionStore((s) => s.active);
  const uri = useHeroTransitionStore((s) => s.uri);
  const startRect = useHeroTransitionStore((s) => s.startRect);
  const clear = useHeroTransitionStore((s) => s.clear);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active && startRect) {
      x.value = startRect.x;
      y.value = startRect.y;
      w.value = startRect.width;
      h.value = startRect.height;
      opacity.value = 1;

      x.value = withSpring(0, SPRING);
      y.value = withSpring(0, SPRING);
      w.value = withSpring(SCREEN_W, SPRING);
      h.value = withSpring(HERO_IMAGE_HEIGHT, SPRING, (finished) => {
        if (finished) {
          opacity.value = withTiming(0, { duration: 80 }, (done) => {
            if (done) runOnJS(clear)();
          });
        }
      });
    }
  }, [active, clear, h, opacity, startRect, w, x, y]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    opacity: opacity.value,
    zIndex: 999,
  }));

  if (!active || !uri) return null;

  return <Animated.Image source={{ uri }} style={[styles.image, style]} resizeMode="cover" />;
}

const styles = StyleSheet.create({ image: { backgroundColor: '#eee' } });