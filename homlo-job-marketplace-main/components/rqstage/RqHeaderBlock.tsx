// rqstage / RqHeaderBlock.tsx
// Drop-in banner for the Recommended page. This is the ONLY component the screen imports.
//
//   const scrollY = useSharedValue(0);
//   const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
//   <Animated.FlatList onScroll={onScroll} scrollEventThrottle={16}
//      ListHeaderComponent={<RqHeaderBlock scrollY={scrollY} matchCount={14} onBack={router.back} />} />
//
// No React state changes while scrolling. The only JS-thread work is the pill text swap on a
// scene change (every 7.4s) and the one-off count-up.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  SharedValue,
  useAnimatedReaction,
  useReducedMotion,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/lib/native/status-bar';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import {
  RQ_CLR,
  RQ_CYCLE_MS,
  RQ_FONT,
  RQ_SCENE_COUNT,
  RQ_SCENE_DEFS,
  rqLayout,
} from './rqTokens';
import { useRqTicker } from './rqTicker';
import SunriseLagoonBackdropMk7 from '@/components/recommended/SunriseLagoonBackdropMk7';
import { RqSceneDeck } from './RqSceneDeck';

const BANNER_H = 290;

const PILL_ICONS: IconName[] = ['cup', 'bike', 'laptop'];

export type RqHeaderBlockProps = {
  scrollY: SharedValue<number>;
  matchCount?: number;
  sceneCounts?: [number, number, number]; // numbers shown in the pill; ideally sum to matchCount
  title?: string;
  greeting?: string;
  subtitle?: string;
  pageBg?: string; // colour of the screen below the banner (for the curved edge)
  paused?: boolean; // pass !isFocused to stop the frame loop when the screen is hidden
  onBack?: () => void;
  onFilter?: () => void; // optional second action, kept on the title row
};

export function RqHeaderBlock({
  scrollY,
  matchCount = 14,
  sceneCounts = [6, 4, 4],
  title = 'Recommended',
  greeting = 'Hi there,',
  subtitle = 'Based on your skills and availability',
  pageBg = RQ_CLR.pageBg,
  paused = false,
  onBack,
  onFilter,
}: RqHeaderBlockProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const tick = useRqTicker(scrollY, !paused);

  // The stage is scaled down on narrow phones so it never eats the text column.
  const { textW } = rqLayout(width);
  const headSize = textW >= 200 ? 26 : textW >= 170 ? 24 : 22;
  const pillSize = textW >= 170 ? 15 : 14;

  // --- which scene is showing (JS state, changes once per 7.4s) ---
  // The pill swaps instantly — any fade here reads as lag against the art handoff.
  const [scene, setScene] = useState(0);
  useAnimatedReaction(
    () => Math.floor(tick.clock.value / RQ_CYCLE_MS) % RQ_SCENE_COUNT,
    (v, prev) => {
      if (v !== prev) {
        scheduleOnRN(setScene, v);
      }
    },
    [],
  );

  // --- count-up on first show ---
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return; // reduce-motion shows the final number straight away
    let i = 0;
    const steps = 14;
    let iv: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      iv = setInterval(() => {
        i += 1;
        setN(Math.round(matchCount * Math.min(1, i / steps)));
        if (i >= steps) clearInterval(iv);
      }, 40);
    }, 120);
    return () => {
      clearTimeout(start);
      if (iv) clearInterval(iv);
    };
  }, [matchCount, reduce]);
  const count = reduce ? matchCount : n;

  const def = RQ_SCENE_DEFS[scene];
  const PillIcon = PILL_ICONS[scene];

  return (
    <View
      style={{ height: BANNER_H + insets.top, backgroundColor: '#0891B2', overflow: 'hidden' }}
    >
      <SunriseLagoonBackdropMk7 edgeColor={pageBg} autoCycle />
      <RqSceneDeck tick={tick} scrollY={scrollY} />
      <StatusBar style="light" />

      {/* text column */}
      <View
        style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, width: textW + 32 }}
      >
        <View style={styles.row}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={styles.back}
          >
            <AppIcon name="back" size={18} color="#fff" strokeWidth={2} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {onFilter ? (
            <Pressable
              onPress={onFilter}
              accessibilityRole="button"
              accessibilityLabel="Filters"
              hitSlop={8}
              style={styles.back}
            >
              <AppIcon name="sliders" size={18} color="#fff" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
        <Text style={[styles.headline, { fontSize: headSize, lineHeight: headSize + 4 }]}>
          <Text style={{ color: RQ_CLR.amber }}>{count}</Text> new matches today
        </Text>

        <View style={styles.pill}>
          <AppIcon name={PillIcon} size={32} color="#fff" strokeWidth={2} />
          <Text style={[styles.pillText, { fontSize: pillSize }]} numberOfLines={1}>
            {def.label} · {sceneCounts[scene]} near you
          </Text>
        </View>

        <Text style={styles.sub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: RQ_CLR.pillBg,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, color: '#fff', fontFamily: RQ_FONT.headMed },
  greeting: { marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: RQ_FONT.body },
  headline: { marginTop: 2, color: '#fff', fontFamily: RQ_FONT.head },
  pill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 12,
    backgroundColor: RQ_CLR.pillBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  pillText: { color: '#fff', fontFamily: RQ_FONT.body },
  sub: { marginTop: 8, fontSize: 12, lineHeight: 15, color: 'rgba(255,255,255,0.75)', fontFamily: RQ_FONT.body },
});
