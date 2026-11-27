import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radii, type } from './theme';
import { ClockIcon, BriefcaseIcon, CalendarIcon, HomeIcon } from './icons';

const ITEMS = [
  { key: 'part-time', label: 'Part-time', Icon: ClockIcon },
  { key: 'full-time', label: 'Full-time', Icon: BriefcaseIcon },
  { key: 'weekends', label: 'Weekends', Icon: CalendarIcon },
  { key: 'remote', label: 'Remote', Icon: HomeIcon },
] as const;

export function QuickSearchRow({ onSelect }: { onSelect?: (key: string) => void }) {
  return (
    <View style={styles.row}>
      {ITEMS.map(({ key, label, Icon }) => (
        <Pressable key={key} style={styles.item} onPress={() => onSelect?.(key)}>
          <View style={styles.tile}>
            <Icon size={18} color={colors.green} />
          </View>
          <Text style={type.quickLabel}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  tile: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radii.quickTile,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
