// Bottom sheet for choosing a Phnom Penh area. Scrim fades in, sheet slides up
// (SMOOTH, ~300 ms). Tap the scrim to close.
// Uses entering/exiting layout animations rather than an animated transform so
// the sheet's resting position is its real layout (iOS Fabric hit-tests stale
// Reanimated transforms, which made row taps fall through to the scrim).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SMOOTH } from '@/src/design/motion';
import { CheckGlyph, PinGlyph } from './glyphs';
import { AP, F, LINE } from './tokens';

export type AreaRow = { key: string | undefined; label: string; count: number };

type Props = {
  open: boolean;
  subject: string; // lower-case noun, e.g. "it & technology" or "part-time jobs"
  rows: AreaRow[];
  selected: string | undefined;
  onPick: (area: string | undefined) => void;
  onClose: () => void;
};

const OPEN_MS = 300;
const CLOSE_MS = 240;

export function AreaSheet({ open, subject, rows, selected, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(open);

  // Mount as soon as it opens (state adjusted during render, not in an effect).
  if (open && !mounted) setMounted(true);

  // Keep the Modal up until the exit animation has played.
  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), reduce ? 0 : CLOSE_MS + 20);
    return () => clearTimeout(t);
  }, [open, mounted, reduce]);

  if (!mounted) return null;

  const scrimIn = reduce ? undefined : FadeIn.duration(OPEN_MS).easing(SMOOTH);
  const scrimOut = reduce ? undefined : FadeOut.duration(CLOSE_MS).easing(SMOOTH);
  const sheetIn = reduce ? undefined : SlideInDown.duration(OPEN_MS).easing(SMOOTH);
  const sheetOut = reduce ? undefined : SlideOutDown.duration(CLOSE_MS).easing(SMOOTH);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {open ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={scrimIn} exiting={scrimOut} style={[StyleSheet.absoluteFill, s.scrim]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close area picker" />
          </Animated.View>
          <Animated.View
            entering={sheetIn}
            exiting={sheetOut}
            style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}
            accessibilityViewIsModal
          >
            <View style={s.grab} />
            <Text style={s.title} accessibilityRole="header">Choose area</Text>
            <Text style={s.sub}>Jobs in {subject} by area of Phnom Penh.</Text>
            {rows.map((row, i) => {
              const on = row.key === selected;
              return (
                <Pressable
                  key={row.label}
                  onPress={() => onPick(row.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${row.label}, ${row.count} ${row.count === 1 ? 'job' : 'jobs'}`}
                  style={({ pressed }) => [s.row, i < rows.length - 1 && s.divider, pressed && { opacity: 0.7 }]}
                >
                  <View style={[s.tile, { backgroundColor: on ? AP.tint : AP.bg }]}>
                    <PinGlyph size={20} color={AP.cyanDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{row.label}</Text>
                    <Text style={s.count}>{row.count} {row.count === 1 ? 'job' : 'jobs'}</Text>
                  </View>
                  {on ? <CheckGlyph size={20} color={AP.navy} /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(18,48,60,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5DEE2', alignSelf: 'center', marginBottom: 14 },
  title: { fontFamily: F.h, fontSize: 20, color: AP.navy },
  sub: { fontFamily: F.m, fontSize: 13, color: AP.muted, marginTop: 2, marginBottom: 8 },
  row: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.hb, fontSize: 15, color: AP.navy },
  count: { fontFamily: F.m, fontSize: 12, color: AP.muted },
});
