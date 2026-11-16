import React, { createContext, useContext, useRef } from 'react';
import { View, Text, Image, ImageSourcePropType, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, { SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

export const C = { forest: '#0E3B2E', mint: '#0F9D62', mint100: '#DFF7E9', mint50: '#EEF9F2', bg: '#F6F8F7', text: '#17201A', muted: '#66736A', line: '#E2E8E5', orange: '#F08A3C', white: '#FFFFFF' };
// Swap for the app's familyForWeight() helper if preferred
export const F = { h800: 'PlusJakartaSans_800ExtraBold', h700: 'PlusJakartaSans_700Bold', b400: 'Inter_400Regular', b500: 'Inter_500Medium', b600: 'Inter_600SemiBold' };
export const shadow = { shadowColor: '#173C25', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

export const ScrollYCtx = createContext<SharedValue<number> | null>(null);

/** Image placeholder: shows the real image when `source` is set, otherwise a dashed slot with a label. */
export function ImageSlot({ source, label, style, radius = 18 }: { source?: ImageSourcePropType | null; label?: string; style?: StyleProp<ViewStyle>; radius?: number }) {
  if (source) return <Image source={source} resizeMode="cover" style={[{ borderRadius: radius }, style as any]} />;
  return (
    <View style={[{ borderRadius: radius, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(15,157,98,0.6)', backgroundColor: 'rgba(223,247,233,0.6)', alignItems: 'center', justifyContent: 'center' }, style]}>
      {!!label && <Text style={{ color: C.mint, fontFamily: F.b600, fontSize: 10, textAlign: 'center' }}>{label}</Text>}
    </View>
  );
}

/** Scroll-triggered entrance: tilt + scale + slide. Must sit inside <ScrollYCtx.Provider>. */
export function Reveal({ children, delay = 0, from = 'up', style }: { children: React.ReactNode; delay?: number; from?: 'up' | 'left'; style?: StyleProp<ViewStyle> }) {
  const ctx = useContext(ScrollYCtx);
  const local = useSharedValue(0);
  const sy = ctx ?? local;
  const { height } = useWindowDimensions();
  const ref = useRef<View>(null);
  const top = useSharedValue(99999);
  const p = useSharedValue(0);
  const started = useSharedValue(false);

  useAnimatedReaction(
    () => sy.value + height * 0.92 > top.value,
    (vis) => {
      if (vis && !started.value) {
        started.value = true;
        p.value = withDelay(delay, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
      }
    }
  );

  const aStyle = useAnimatedStyle(() => {
    const k = 1 - p.value;
    return {
      opacity: p.value,
      transform: [
        { translateY: from === 'up' ? 34 * k : 0 },
        { translateX: from === 'left' ? 46 * k : 0 },
        { scale: 0.92 + 0.08 * p.value },
        { rotate: `${-1.2 * k}deg` },
      ],
    };
  });

  return (
    <Animated.View
      ref={ref as any}
      style={[style, aStyle]}
      onLayout={() => setTimeout(() => ref.current?.measureInWindow((_x, y) => { top.value = y + sy.value; }), 60)}
    >
      {children}
    </Animated.View>
  );
}
