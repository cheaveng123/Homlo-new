// Job type picker: 4-column grid, all types visible at once (no scrolling).
// Each item is a round, icon-only tile: the Home illustration on white inside a
// faint 1.5pt edge (no colored fill). Selected: 2.5pt white gap + 2pt cyan-deep
// ring, a cyan-deep check badge in the same color, bold cyan-deep label.
// Only the selected illustration plays its loop.
// `collapse` (0..1, driven by scroll) shrinks circles to 46pt and hides labels.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { SMOOTH, PressableScale } from '@/src/design/motion';
import { palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { TypeArt } from '@/src/new/components/home/HomePartsNew';
import { F } from '@/components/vista/category/tokens';
import { CheckIcon } from './glyphs';

export type PickerType = { key: string; label: string };

const GAP = 8;
const GUTTER = 16;
const MAX = 72;
const MIN = 46;
const ART = 70; // Home illustrations draw in a 70pt box
const RING = 4.5; // 2.5 white gap + 2 ring

type Props = {
  types: PickerType[];
  selected: string;
  onSelect: (key: string) => void;
  collapse: SharedValue<number>;
};

function Item({ type, selected, size, onSelect, collapse }: {
  type: PickerType; selected: boolean; size: number; onSelect: (key: string) => void; collapse: SharedValue<number>;
}) {
  const reduce = useReducedMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    sel.set(reduce ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 270, easing: SMOOTH }));
  }, [selected, reduce, sel]);

  const square = useAnimatedStyle(() => {
    const s = interpolate(collapse.value, [0, 1], [size, MIN]);
    return { width: s, height: s, borderRadius: s / 2 };
  });
  // No background, so the illustration can fill most of the circle.
  const art = useAnimatedStyle(() => {
    const s = interpolate(collapse.value, [0, 1], [size, MIN]);
    return { transform: [{ scale: (s * 0.74) / ART }] };
  });
  const ring = useAnimatedStyle(() => {
    const s = interpolate(collapse.value, [0, 1], [size, MIN]);
    return { opacity: sel.value, borderRadius: s / 2 + RING };
  });
  // The faint edge gives way to the ring when selected.
  const edge = useAnimatedStyle(() => ({ borderColor: sel.value > 0.5 ? 'transparent' : palette.line }));
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: sel.value }], opacity: sel.value }));
  const label = useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    height: interpolate(collapse.value, [0, 1], [18, 0]),
    marginTop: interpolate(collapse.value, [0, 1], [7, 0]),
  }));

  return (
    <PressableScale
      scale={0.97}
      onPress={() => { if (!selected) { haptic.selection(); onSelect(type.key); } }}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={type.label}
      style={s.item}
    >
      <View>
        <Animated.View pointerEvents="none" style={[s.ring, ring]} />
        <Animated.View style={[s.square, square, edge]}>
          <Animated.View style={[s.art, art]}>
            <TypeArt id={type.key} play={selected} onLight />
          </Animated.View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[s.badge, badge]}>
          <CheckIcon />
        </Animated.View>
      </View>
      <Animated.View style={[s.labelWrap, label]}>
        <Text style={[s.label, selected && s.labelOn]} numberOfLines={1}>{type.label}</Text>
      </Animated.View>
    </PressableScale>
  );
}

export function TypePicker({ types, selected, onSelect, collapse }: Props) {
  const { width } = useWindowDimensions();
  const col = (width - GUTTER * 2 - GAP * (types.length - 1)) / types.length;
  const size = Math.min(MAX, col - RING * 2);
  return (
    <View style={s.row} accessibilityRole="tablist">
      {types.map((t) => (
        <View key={t.key} style={s.col}>
          <Item type={t} selected={t.key === selected} size={size} onSelect={onSelect} collapse={collapse} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, paddingTop: 14 + RING, paddingBottom: 6 },
  col: { flex: 1, alignItems: 'center', minWidth: 0 },
  item: { alignItems: 'center' },
  square: {
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: palette.surface, borderWidth: 1.5,
  },
  art: { width: ART, height: ART },
  ring: {
    position: 'absolute', top: -RING, left: -RING, right: -RING, bottom: -RING,
    borderWidth: 2, borderColor: palette.cyanDeep,
  },
  badge: {
    position: 'absolute', top: -5, right: -5, width: 22, height: 22, borderRadius: 11,
    backgroundColor: palette.cyanDeep, borderWidth: 2, borderColor: palette.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  labelWrap: { overflow: 'hidden', alignItems: 'center' },
  label: { fontFamily: F.m, fontSize: 13.5, color: palette.ink },
  labelOn: { fontFamily: F.hb, color: palette.cyanDeep },
});
