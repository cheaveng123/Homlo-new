/**
 * components/chat/QuickReplyChips.tsx
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, type } from '../../theme/tokens';

type Props = {
  chips: string[];
  onPressChip?: (chip: string) => void;
};

export default function QuickReplyChips({ chips, onPressChip }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => (
        <Pressable key={chip} style={styles.chip} onPress={() => onPressChip?.(chip)}>
          <Text style={[type.quickReplyChip, styles.chipText]}>{chip}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mint300,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipText: {
    color: colors.mint700,
  },
});
