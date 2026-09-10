import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "@/components/ui/text";

type SelectFieldProps = {
  accessibilityLabel: string;
  label?: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  value: string;
};

/** A large, mobile-friendly single-choice field for longer option sets. */
export function SelectField({ accessibilityLabel, label, onChange, options, placeholder, value }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const choose = (option: string) => { onChange(option); setOpen(false); };
  return <View>{label ? <Text style={styles.label}>{label}</Text> : null}<Pressable accessibilityLabel={accessibilityLabel} onPress={() => setOpen(true)} style={({ pressed }) => [styles.field, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.value, !value && styles.placeholder]}>{value || placeholder}</Text><IconSymbol name="chevron.down" size={21} color="#16803C" /></Pressable><Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}><View style={styles.overlay}><Pressable accessibilityLabel="Close options" onPress={() => setOpen(false)} style={styles.dismiss} /><View style={styles.sheet}><View style={styles.handle} /><View style={styles.header}><Text style={styles.title}>{label || placeholder}</Text><Pressable accessibilityLabel="Close options" onPress={() => setOpen(false)} style={styles.close}><IconSymbol name="chevron.down" size={20} color="#17201A" /></Pressable></View><ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator={false}>{options.map((option) => { const selected = option === value; return <Pressable key={option} onPress={() => choose(option)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>{selected ? <IconSymbol name="checkmark.circle.fill" size={20} color="#16803C" /> : null}</Pressable>; })}</ScrollView></View></View></Modal></View>;
}

const styles = StyleSheet.create({
  label: { color: "#17201A", fontSize: 13, fontWeight: "600", marginBottom: 8 }, field: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 11, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 14 }, value: { color: "#17201A", flex: 1, fontSize: 14, fontWeight: "500", paddingRight: 10 }, placeholder: { color: "#66736A", fontWeight: "400" }, pressed: { opacity: 0.72 }, overlay: { backgroundColor: "rgba(23,32,26,0.28)", flex: 1, justifyContent: "flex-end" }, dismiss: { flex: 1 }, sheet: { backgroundColor: "#F7F8F6", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "72%" }, handle: { alignSelf: "center", backgroundColor: "#C9D4CE", borderRadius: 3, height: 4, marginTop: 10, width: 38 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15 }, title: { color: "#17201A", fontSize: 18, fontWeight: "700" }, close: { alignItems: "center", height: 36, justifyContent: "center", width: 36 }, options: { paddingBottom: 20, paddingHorizontal: 20 }, option: { alignItems: "center", borderBottomColor: "#E2E8E5", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 56, paddingVertical: 10 }, optionSelected: { backgroundColor: "#EDF7EF", borderRadius: 9, borderBottomColor: "#EDF7EF", marginHorizontal: -8, paddingHorizontal: 8 }, optionText: { color: "#17201A", fontSize: 15, fontWeight: "500" }, optionTextSelected: { color: "#16803C", fontWeight: "700" },
});
