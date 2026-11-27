import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TextNew } from '../TextNew';
import { DraftTabGlyph, LiveTabGlyph, ReviewTabGlyph } from '@/src/components/icons/DashIcons';
import { dash, easeInOut } from './dashTokens';

import { SMOOTH, smooth } from '@/src/design/motion';
export type DashTab = { key: string; label: string; count?: number };

const GLYPHS: Record<string, typeof LiveTabGlyph> = {
  live: LiveTabGlyph,
  draft: DraftTabGlyph,
  review: ReviewTabGlyph,
};

function TabItem({ tab, active, onPress, onLayout }: {
  tab: DashTab; active: boolean; onPress: () => void; onLayout: (e: LayoutChangeEvent) => void;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (active && !reduced) pop.value = withSequence(withTiming(1.06, { duration: 140, easing: SMOOTH }), smooth(1, 220));
  }, [active, reduced, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const Glyph = GLYPHS[tab.key.toLowerCase()] ?? LiveTabGlyph;
  const color = active ? dash.cyanDeep : dash.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.count != null ? `${tab.label}, ${tab.count}` : tab.label}
      onPress={onPress}
      onLayout={onLayout}
      style={s.tab}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Animated.View style={iconStyle}>
        <Glyph size={18} color={color} accent={active ? dash.amber : undefined} />
      </Animated.View>
      <TextNew variant="title" weight="medium" color={active ? dash.cyanDeep : dash.muted} style={s.label}>{tab.label}</TextNew>
      {tab.count != null ? (
        <View style={[s.pill, { backgroundColor: active ? '#DCF1F6' : '#EEF3F4' }]}>
          <TextNew variant="caption" heading weight="bold" color={active ? dash.cyanDeep : dash.muted} style={s.pillText}>{tab.count}</TextNew>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Live / Draft / Review tabs with a sliding 3pt cyan indicator. */
export function DashTabsNew({ tabs, active, onChange }: { tabs: DashTab[]; active: string; onChange: (k: string) => void }) {
  const reduced = useReducedMotion();
  const { width: screenW } = useWindowDimensions();
  // 20pt gap at design width; tighter on small phones (360pt) so all three tabs fit.
  const gap = screenW < 380 ? 12 : 20;
  const [frames, setFrames] = useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    const f = frames[active];
    if (!f) return;
    if (!placed.current || reduced) {
      x.value = f.x;
      w.value = f.width;
      placed.current = true;
      return;
    }
    const cfg = { duration: 300, easing: easeInOut };
    x.value = withTiming(f.x, cfg);
    w.value = withTiming(f.width, cfg);
  }, [active, frames, reduced, x, w]);

  const ind = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

  return (
    <View accessibilityRole="tablist" style={s.bar}>
      <View style={[s.row, { gap }]}>
        {tabs.map((t) => (
          <TabItem
            key={t.key}
            tab={t}
            active={t.key === active}
            onPress={() => onChange(t.key)}
            onLayout={(e) => {
              const { x: fx, width } = e.nativeEvent.layout;
              setFrames((prev) => (prev[t.key]?.x === fx && prev[t.key]?.width === width ? prev : { ...prev, [t.key]: { x: fx, width } }));
            }}
          />
        ))}
      </View>
      <Animated.View pointerEvents="none" style={[s.indicator, ind]} />
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: dash.surface, borderBottomWidth: 1, borderBottomColor: dash.line },
  row: { flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 12, paddingBottom: 13 },
  label: { fontSize: 16, lineHeight: 21 },
  pill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  pillText: { fontSize: 12, lineHeight: 16 },
  indicator: { position: 'absolute', left: 0, bottom: -1, height: 3, borderRadius: 2, backgroundColor: dash.cyan },
});
