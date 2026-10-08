// JobFormFields: form parts for the Edit Job screen: FieldWrap, TextField, ChipGroup, DropdownField, Stepper, ToggleRow
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, KeyboardTypeOptions } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { colors, font } from './job-management-tokens';

export function FieldWrap({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField({
  value, onChangeText, multiline, keyboardType, style,
}: { value: string; onChangeText: (t: string) => void; multiline?: boolean; keyboardType?: KeyboardTypeOptions; style?: any }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      keyboardType={keyboardType}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      placeholderTextColor={colors.muted}
      style={[
        styles.input,
        multiline && { minHeight: 84, textAlignVertical: 'top', lineHeight: 20 },
        focus && { backgroundColor: colors.white, borderColor: colors.mint },
        style,
      ]}
    />
  );
}

// Chips. If onOtherPress is given, a last "Other" chip is added; once a custom value is chosen it shows that value.
export function ChipGroup({
  options, value, onChange, onOtherPress,
}: { options: string[]; value: string; onChange: (v: string) => void; onOtherPress?: () => void }) {
  const custom = !!onOtherPress && !options.includes(value);
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} label={o} on={o === value} onPress={() => onChange(o)} />
      ))}
      {onOtherPress ? <Chip label={custom ? value : 'Other'} on={custom} onPress={onOtherPress} /> : null}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && { backgroundColor: colors.forest }]}>
      <Text style={[styles.chipTx, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function DropdownField({ value, onPress, style }: { value: string; onPress: () => void; style?: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.input, styles.dd, style]}>
      <Text style={styles.ddTx}>{value}</Text>
      <AppIcon name="chevron" size={18} color={colors.muted} style={{ transform: [{ rotate: '90deg' }] }} />
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <View style={styles.step}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepVal}>{value}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.tog}>
      <Text style={styles.togTx}>{label}</Text>
      <Pressable
        onPress={() => onChange(!value)}
        style={[styles.sw, { backgroundColor: value ? colors.mint : colors.toggleOff }]}
      >
        <View style={[styles.thumb, value ? { right: 3 } : { left: 3 }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.b600, fontSize: 12, color: colors.muted, marginBottom: 6, paddingLeft: 4 },
  input: {
    backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: font.b400, fontSize: 14, color: colors.forest, borderWidth: 1.5, borderColor: 'transparent',
  },
  dd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ddTx: { fontFamily: font.b400, fontSize: 14, color: colors.forest },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.bg },
  chipTx: { fontFamily: font.b600, fontSize: 13, color: colors.muted },
  step: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 18, padding: 6 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontFamily: font.b600, fontSize: 18, color: colors.forest, lineHeight: 22 },
  stepVal: { fontFamily: font.h700, fontSize: 17, color: colors.forest },
  tog: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  togTx: { flex: 1, marginRight: 12, fontFamily: font.b600, fontSize: 14, color: colors.forest },
  sw: { width: 46, height: 28, borderRadius: 14 },
  thumb: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
});