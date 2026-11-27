// Form-page pieces for profile detail pages (Edit profile, About you, Location),
// in the current Homlo style: white top bar with a round back button and a
// centered navy title, short intro line, white grouped cards with labelled
// inputs, and a pinned bottom bar for the primary action.
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRouter } from '@/lib/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { BackGlyph } from '@/components/vista/category/glyphs';

const LINE = '#E3E9EC';

export const enter = (i: number) =>
  FadeInDown.delay(i * 70).duration(durations.enter).easing(SMOOTH).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- screen frame ---------- */
export function FormScreen({ title, subtitle, footer, children }: {
  title: string; subtitle?: string; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={s.page}>
      <View style={[s.bar, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [s.back, pressed && { opacity: 0.7 }]}>
          <BackGlyph size={22} color={palette.navy} />
        </Pressable>
        <Text style={s.barTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {subtitle ? <Animated.Text entering={enter(0)} style={s.subtitle}>{subtitle}</Animated.Text> : null}
          {children}
        </ScrollView>
        {footer ? <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---------- card with an optional small heading ---------- */
export function FormCard({ title, children, index = 1 }: { title?: string; children: React.ReactNode; index?: number }) {
  return (
    <Animated.View entering={enter(index)} style={s.cardWrap}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      <View style={s.card}>{children}</View>
    </Animated.View>
  );
}

/* ---------- labelled input ---------- */
export function FormField({ label, helper, icon, counter, locked, ...input }: {
  label: string; helper?: string; icon?: React.ReactNode; counter?: string; locked?: boolean;
} & TextInputProps) {
  const [focus, setFocus] = useState(false);
  const disabled = input.editable === false;
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputBox, focus && s.inputFocus, disabled && s.inputDisabled, input.multiline && s.inputMulti]}>
        {icon ? <View style={s.inputIcon}>{icon}</View> : null}
        <TextInput
          {...input}
          placeholderTextColor={palette.muted}
          style={[s.input, input.multiline && s.inputMultiText, disabled && { color: palette.muted }]}
          onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        />
        {locked ? <LockGlyph /> : null}
      </View>
      {helper || counter ? (
        <View style={s.helperRow}>
          {helper ? <Text style={s.helper}>{helper}</Text> : <View />}
          {counter ? <Text style={s.counter}>{counter}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- choice card (radio) ---------- */
export function ChoiceRow({ title, subtitle, icon, selected, onPress, last }: {
  title: string; subtitle: string; icon: React.ReactNode; selected: boolean; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => { if (!selected) { haptic.selection(); onPress(); } }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [s.choice, !last && s.choiceSep, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.choiceIcon, selected && { backgroundColor: palette.cyanTint }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.choiceTitle}>{title}</Text>
        <Text style={s.choiceSub}>{subtitle}</Text>
      </View>
      <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
    </Pressable>
  );
}

/* ---------- info note ---------- */
export function InfoNote({ children, index = 3 }: { children: React.ReactNode; index?: number }) {
  return (
    <Animated.View entering={enter(index)} style={s.note}>
      <InfoGlyph />
      <Text style={s.noteText}>{children}</Text>
    </Animated.View>
  );
}

/* ---------- pinned save button ---------- */
export function SaveButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      scale={0.97}
      disabled={disabled}
      onPress={() => { haptic.selection(); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={[s.save, disabled && s.saveOff]}
    >
      <Text style={[s.saveText, disabled && { color: palette.muted }]}>{label}</Text>
    </PressableScale>
  );
}

/* ---------- glyphs ---------- */
const LockGlyph = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={palette.muted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 11h12v9H6z" />
    <Path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </Svg>
);
const InfoGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.cyanDeep} strokeWidth={1.9} strokeLinecap="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 11v5M12 8h.01" />
  </Svg>
);

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.page },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: palette.page },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: F.h, fontSize: 17, color: palette.navy },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  subtitle: { fontFamily: F.m, fontSize: 14, lineHeight: 20, color: palette.muted, marginBottom: 6 },
  cardWrap: { marginTop: 16 },
  cardTitle: { fontFamily: F.hb, fontSize: 13, color: palette.muted, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: '#E6EDEF', padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontFamily: F.hb, fontSize: 13, color: palette.navy },
  inputBox: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  inputFocus: { borderColor: palette.cyan, borderWidth: 1.5 },
  inputDisabled: { backgroundColor: palette.page },
  inputMulti: { alignItems: 'flex-start', paddingVertical: 10 },
  inputIcon: { width: 20, alignItems: 'center' },
  input: { flex: 1, fontFamily: F.m, fontSize: 15, color: palette.ink, paddingVertical: 10 },
  inputMultiText: { minHeight: 132, textAlignVertical: 'top', lineHeight: 21, paddingVertical: 0 },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  helper: { flex: 1, fontFamily: F.m, fontSize: 12, lineHeight: 17, color: palette.muted },
  counter: { fontFamily: F.m, fontSize: 12, color: palette.muted },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  choiceSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE4E7' },
  choiceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.page, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontFamily: F.hb, fontSize: 15, color: palette.navy },
  choiceSub: { marginTop: 1, fontFamily: F.m, fontSize: 12.5, color: palette.muted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9D3D8', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: palette.cyanDeep },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.cyanDeep },
  note: { flexDirection: 'row', gap: 10, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: palette.cyanTint },
  noteText: { flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 19, color: palette.cyanDeep },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: LINE },
  save: { height: 52, borderRadius: 14, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  saveOff: { backgroundColor: palette.page, borderWidth: 1, borderColor: LINE },
  saveText: { fontFamily: F.h, fontSize: 15, color: '#FFFFFF' },
});
