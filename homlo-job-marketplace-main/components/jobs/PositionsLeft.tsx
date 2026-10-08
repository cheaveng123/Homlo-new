import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { jobCardTokens as t } from './jobCardTokens';

interface Props {
  left: number;
  total?: number | null;
}

const MAX_BARS = 6;

// Mini container: one bar per position, filled for each open one.
// 3+ left = mint, 1-2 left = orange, 0 = muted "Filled".
export function PositionsLeft({ left, total }: Props) {
  const safeLeft = Math.max(0, left);
  const all = Math.max(total ?? safeLeft, safeLeft, 1);
  const bars = Math.min(all, MAX_BARS);
  const filled = safeLeft === 0 ? 0 : Math.max(1, Math.round((safeLeft / all) * bars));

  const state = safeLeft === 0 ? 'filled' : safeLeft <= 2 ? 'low' : 'ok';
  const bg = state === 'filled' ? t.color.filledBg : state === 'low' ? t.color.lowBg : t.color.mintTint;
  const fg = state === 'filled' ? t.color.muted : state === 'low' ? t.color.lowFg : t.color.mintDark;
  const barOn = state === 'low' ? t.color.lowBar : t.color.mint;
  const barOff = state === 'low' ? t.color.lowBar + '33' : t.color.mint + '33';

  return (
    <View
      style={[styles.wrap, { backgroundColor: bg }]}
      accessible
      accessibilityLabel={safeLeft === 0 ? 'All positions filled' : `${safeLeft} of ${all} positions left`}
    >
      {state !== 'filled' && (
        <View style={styles.bars}>
          {Array.from({ length: bars }).map((_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i < filled ? barOn : barOff }]} />
          ))}
        </View>
      )}
      <Text style={[styles.label, { color: fg }]}>{state === 'filled' ? 'Filled' : `${safeLeft} left`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: t.radius.pill,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 8,
  },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 5, height: 11, borderRadius: 2 },
  label: { fontFamily: t.font.bold, fontSize: 11 },
});
