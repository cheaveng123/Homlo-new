import { StyleSheet, Text, View } from 'react-native';
import { formatPositionsLabel } from '@/lib/positions';
import { jobCardTokens as t } from './jobCardTokens';

interface Props {
  left: number;
  total?: number | null;
}

const MAX_BARS = 6;

// Mini container: one bar per position, filled for each accepted position.
// 3+ open = mint, 1-2 open = orange, 0 = muted.
export function PositionsLeft({ left, total }: Props) {
  if (total == null || total <= 0) return null;
  const all = Math.max(total, 1);
  const safeLeft = Math.max(0, Math.min(left, all));
  const accepted = all - safeLeft;
  const bars = Math.min(all, MAX_BARS);
  const filled = Math.round((accepted / all) * bars);

  const state = safeLeft === 0 ? 'filled' : safeLeft <= 2 ? 'low' : 'ok';
  const bg = state === 'filled' ? t.color.filledBg : state === 'low' ? t.color.lowBg : t.color.mintTint;
  const fg = state === 'filled' ? t.color.muted : state === 'low' ? t.color.lowFg : t.color.mintDark;
  const barOn = state === 'low' ? t.color.lowBar : t.color.mint;
  const barOff = state === 'low' ? t.color.lowBar + '33' : t.color.mint + '33';

  return (
    <View
      style={[styles.wrap, { backgroundColor: bg }]}
      accessible
      accessibilityLabel={`${accepted} of ${all} positions filled`}
    >
      <View style={styles.bars}>
        {Array.from({ length: bars }).map((_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i < filled ? barOn : barOff }]} />
        ))}
      </View>
      <Text style={[styles.label, { color: fg }]}>{formatPositionsLabel(accepted, all)}</Text>
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
