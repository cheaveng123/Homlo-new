// OptionPickerSheet: bottom-sheet list picker (categories, employment types, pay period)
import React from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import BottomSheetModal from './BottomSheetModal';
import { colors, font } from './job-management-tokens';

type Props = {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export default function OptionPickerSheet({ visible, title, options, selected, onSelect, onClose }: Props) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.5 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          {options.map((o) => {
            const on = o === selected;
            return (
              <Pressable
                key={o}
                onPress={() => onSelect(o)}
                style={[styles.row, { backgroundColor: on ? colors.tint : colors.bg }]}
              >
                <Text style={[styles.tx, { color: on ? colors.mint : colors.forest }]}>{o}</Text>
                {on ? <AppIcon name="check" size={18} color={colors.mint} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.h800, fontSize: 21, color: colors.forest, textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  tx: { fontFamily: font.b600, fontSize: 14 },
});