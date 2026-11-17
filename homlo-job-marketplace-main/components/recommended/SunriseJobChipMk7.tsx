// SunriseJobChipMk7.tsx — white pill with a yellow check badge + job-type label. Mobile only.
import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { OutfitVariant } from './SunriseOutfitPersonMk7';

const LABELS = ['Café & Restaurant', 'Delivery & Courier', 'Office & Admin'];

function Label({ text, on, headingFont, bodyFont }: { text: string; on: boolean; headingFont?: string; bodyFont?: string }) {
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => { o.value = withTiming(on ? 1 : 0, { duration: 900, easing: Easing.inOut(Easing.quad) }); }, [on, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center' }, s]}>
      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: '#14324A', fontFamily: headingFont }}>{text}</Text>
      <Text numberOfLines={1} style={{ fontSize: 10.5, color: '#4B7A7E', marginTop: 1, fontFamily: bodyFont }}>Recommended</Text>
    </Animated.View>
  );
}

export default function SunriseJobChipMk7({ variant, headingFont, bodyFont }: { variant: OutfitVariant; headingFont?: string; bodyFont?: string }) {
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = 0;
    pop.value = withSpring(1, { damping: 9, stiffness: 140 });
  }, [variant, pop]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * -30}deg` }] }));
  return (
    <View style={st.pill}>
      <Animated.View style={[st.badge, badge]}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M5 12.5l4.6 4.6L19 7" fill="none" stroke="#14324A" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <View style={st.lb}>{LABELS.map((t, i) => <Label key={t} text={t} on={variant === i} headingFont={headingFont} bodyFont={bodyFont} />)}</View>
    </View>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingVertical: 7, paddingLeft: 7, paddingRight: 16, minWidth: 176, shadowColor: '#14324A', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5A524', alignItems: 'center', justifyContent: 'center' },
  lb: { height: 32, width: 132 },
});
