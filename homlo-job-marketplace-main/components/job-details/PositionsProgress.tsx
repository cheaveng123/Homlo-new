/**
 * PositionsProgress.tsx
 *
 * Replaces the old "OPEN" badge/dot slots indicator on the Job Detail
 * screen. Centered plain-language text, plus a bordered container below
 * it holding a segmented fill bar (one segment per position).
 *
 * Usage, directly below the existing stat card on Job Detail:
 *
 *   <PositionsProgress positionsTotal={job.positionsTotal} positionsFilled={job.positionsFilled} />
 */

import { View, Text, StyleSheet } from 'react-native';
import { formatPositionsLabel } from '@/lib/positions';
import { colors, positionsBlock } from './jobDetailTokens';

interface PositionsProgressProps {
  positionsTotal: number;
  positionsFilled: number;
}

export function PositionsProgress({ positionsTotal, positionsFilled }: PositionsProgressProps) {
  const accepted = Math.max(0, Math.min(positionsFilled, positionsTotal));
  const label = formatPositionsLabel(accepted, positionsTotal);
  const segments = Array.from({ length: positionsTotal }, (_, i) => i < accepted);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.container}>
        <View style={styles.track}>
          {segments.map((filled, i) => (
            <View key={i} style={[styles.segment, filled && styles.segmentFilled]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 5,
    marginBottom: 20,
  },
  label: {
    textAlign: 'center',
    fontSize: positionsBlock.textFontSize,
    color: positionsBlock.textColor,
    marginBottom: 8,
  },
  container: {
    borderWidth: positionsBlock.containerBorderWidth,
    borderColor: colors.line,
    borderRadius: positionsBlock.containerBorderRadius,
    paddingVertical: positionsBlock.containerPaddingVertical,
    paddingHorizontal: positionsBlock.containerPaddingHorizontal,
    backgroundColor: colors.surface,
  },
  track: {
    flexDirection: 'row',
    gap: positionsBlock.segmentGap,
  },
  segment: {
    flex: 1,
    height: positionsBlock.segmentHeight,
    borderRadius: positionsBlock.segmentRadius,
    backgroundColor: colors.line,
  },
  segmentFilled: {
    backgroundColor: colors.accent,
  },
});
