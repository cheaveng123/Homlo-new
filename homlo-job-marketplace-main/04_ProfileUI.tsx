// → components/profile/ProfileUI.tsx
// Shared building blocks for the profile screen and every profile detail page.
// Needs: expo-linear-gradient, expo-router, react-native-reanimated, react-native-safe-area-context
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Switch,
  KeyboardAvoidingView, Platform, TextInputProps, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  Easing, SlideInDown, interpolate, useAnimatedStyle, useReducedMotion,
  useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { AppIcon, IconName } from '../ui/AppIcon';
import { C, F, shadow } from '../../lib/profileTheme';

/* ───────── Detail page frame (back button + title, NO avatar/banner here) ───────── */
export function DetailScreen({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={s.page}>
      <LinearGradient colors={['#CFEAEA', '#E6F4F4', C.bg]} style={s.wash} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.head}>
            <RoundButton icon="back" onPress={() => router.back()} />
            <Text style={s.title}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function RoundButton({ icon, onPress, size = 44, style }: {
  icon: IconName; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress} hitSlop={8}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2 }, pressed && { transform: [{ scale: 0.975 }] }, style]}
    >
      <AppIcon name={icon} size={size > 40 ? 20 : 17} color={C.fg} />
    </Pressable>
  );
}

/* ───────── Groups & rows ───────── */
export const GroupLabel = ({ children }: { children: string }) => <Text style={s.groupLabel}>{children}</Text>;
export const Hint = ({ children }: { children: React.ReactNode }) => <Text style={s.hint}>{children}</Text>;

type Pos = 'first' | 'mid' | 'last' | 'only';
export function Group({ children }: { children: React.ReactNode }) {
  const kids = React.Children.toArray(children).filter(Boolean) as React.ReactElement<any>[];
  return (
    <View style={{ gap: 4 }}>
      {kids.map((k, i) =>
        React.cloneElement(k, { pos: kids.length === 1 ? 'only' : i === 0 ? 'first' : i === kids.length - 1 ? 'last' : 'mid' }),
      )}
    </View>
  );
}

const radii = (pos?: Pos): ViewStyle => {
  switch (pos) {
    case 'first': return { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 };
    case 'last': return { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 };
    case 'only': return { borderRadius: 20 };
    default: return { borderRadius: 16 };
  }
};

export function Row({ icon, label, onPress, right, danger, pos }: {
  icon: IconName; label: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; pos?: Pos;
}) {
  const color = danger ? C.danger : C.forest;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, radii(pos), pressed && { transform: [{ scale: 0.975 }] }]}>
      <AppIcon name={icon} size={24} color={color} />
      <Text style={[s.rowText, danger && { color: C.danger }]}>{label}</Text>
      <View style={s.rowRight}>
        {right}
        {!danger && <AppIcon name="chevron" size={18} color="#9AA59E" />}
      </View>
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, pos }: {
  title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void; pos?: Pos;
}) {
  return (
    <View style={[s.row, { height: 68 }, radii(pos)]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowText}>{title}</Text>
        <Text style={s.sub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.primary, false: '#D5DDD8' }} ios_backgroundColor="#D5DDD8" thumbColor="#fff" />
    </View>
  );
}

export function Tag({ children, tone = 'mint' }: { children: string; tone?: 'mint' | 'warn' | 'neutral' }) {
  const t = { mint: [C.mint100, C.primary], warn: [C.warnBg, C.warn], neutral: [C.neutralBg, C.muted] }[tone];
  return (
    <View style={[s.tag, { backgroundColor: t[0] }]}>
      <Text style={[s.tagT, { color: t[1] }]}>{children}</Text>
    </View>
  );
}

/* ───────── Form pieces ───────── */
export function Field({ label, prefix, ...input }: { label: string; prefix?: string } & TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[s.field, focus && { borderColor: C.mint }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {prefix ? <Text style={[s.input, { fontFamily: F.b600 }]}>{prefix}</Text> : null}
        <TextInput
          {...input} placeholderTextColor="#9AA59E" style={[s.input, { flex: 1 }, input.multiline && { height: 110, textAlignVertical: 'top', lineHeight: 22 }]}
          onFocus={(e) => { setFocus(true); input.onFocus?.(e); }} onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        />
      </View>
    </View>
  );
}

export function OptionRow({ title, subtitle, selected, onPress, icon, badge }: {
  title: string; subtitle?: string; selected: boolean; onPress: () => void; icon?: IconName; badge?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[s.opt, selected && s.optSel]}>
      {icon ? <AppIcon name={icon} size={24} color={C.forest} /> : null}
      {badge ? <View style={s.badge}><Text style={s.badgeT} numberOfLines={1}>{badge}</Text></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowText}>{title}</Text>
        {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
      </View>
      <View style={[s.radio, selected && { borderWidth: 6, borderColor: C.primary }]} />
    </Pressable>
  );
}

/* ───────── Buttons (with optional subtle shine) ───────── */
const VARIANTS = {
  solid: { box: { backgroundColor: C.primary, ...shadowPrimary() }, fg: '#fff' },
  outline: { box: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.primary }, fg: C.primary },
  soft: { box: { backgroundColor: '#F1F4F2' }, fg: C.fg },
  light: { box: { backgroundColor: '#fff' }, fg: C.forest },
} as const;
function shadowPrimary(): ViewStyle {
  return { shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 4 };
}

export function Button({ label, onPress, icon, variant = 'solid', shine, full, style }: {
  label: string; onPress?: () => void; icon?: IconName; variant?: keyof typeof VARIANTS;
  shine?: boolean; full?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress} onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => [s.btn, v.box, full && { alignSelf: 'stretch' }, pressed && { transform: [{ scale: 0.975 }] }, style]}
    >
      {icon ? <AppIcon name={icon} size={18} color={v.fg} /> : null}
      <Text style={[s.btnT, { color: v.fg }]}>{label}</Text>
      {shine ? <Shine width={w} /> : null}
    </Pressable>
  );
}

// A soft diagonal light sweep every ~4s. No sparkles, no glow. Off when Reduce Motion is on.
function Shine({ width }: { width: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce || !width) return;
    t.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 3100 }),
      ), -1,
    );
  }, [reduce, width]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-width * 0.6, width * 1.3]) }, { skewX: '-20deg' }],
  }));
  if (reduce || !width) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: width * 0.36 }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/* ───────── Bottom sheet (no sheet library in the project) ───────── */
export function Sheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.shWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.duration(260)} style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.shTitle}>{title}</Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 },
  title: { fontFamily: F.h800, fontSize: 22, color: C.fg },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  round: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow },
  groupLabel: { fontFamily: F.b600, fontSize: 11.5, letterSpacing: 0.9, color: C.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  hint: { fontFamily: F.b400, fontSize: 13, lineHeight: 19, color: C.muted, marginHorizontal: 4, marginTop: 6, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', height: 58, paddingHorizontal: 16 },
  rowText: { fontFamily: F.b500, fontSize: 15, color: C.fg },
  rowRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontFamily: F.b400, fontSize: 12.5, color: C.muted, marginTop: 1 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  tagT: { fontFamily: F.b600, fontSize: 11 },
  field: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  fieldLabel: { fontFamily: F.b400, fontSize: 11.5, color: C.muted, marginBottom: 2 },
  input: { fontFamily: F.b500, fontSize: 15, color: C.fg, paddingVertical: 2 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  optSel: { borderColor: C.mint, backgroundColor: '#F0FAFA' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CFD8D3' },
  badge: { minWidth: 38, height: 38, paddingHorizontal: 4, borderRadius: 12, backgroundColor: C.mint100, alignItems: 'center', justifyContent: 'center' },
  badgeT: { fontFamily: F.h700, fontSize: 12, color: C.forest },
  btn: { height: 48, paddingHorizontal: 26, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  btnT: { fontFamily: F.b600, fontSize: 15 },
  shWrap: { flex: 1, backgroundColor: 'rgba(10,25,18,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 8 },
  grab: { width: 40, height: 4, borderRadius: 9, backgroundColor: '#D5DDD8', alignSelf: 'center', marginBottom: 10 },
  shTitle: { fontFamily: F.h800, fontSize: 19, color: C.fg, marginBottom: 6 },
});
