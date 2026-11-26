// Shared building blocks for the four jobs pages. Needs: expo-linear-gradient, expo-status-bar,
// react-native-svg, react-native-reanimated, react-native-safe-area-context.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import { StatusBar } from '@/lib/native/status-bar';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { J, S, R, TS, TINTS, shadowSm, shadowMd } from '@/lib/jobsTheme';
import { F } from '@/lib/profileTheme';

/* ───────────── Sunrise header: teal gradient, soft rays, small sun, hill edge ───────────── */
export function SunriseHeader({ title, onBack, onFilter, children }: {
  title: string; onBack?: () => void; onFilter?: () => void; children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cx = box.w * 0.9, cy = box.h * 0.58, L = 900;
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a0 = (i * 15 * Math.PI) / 180, a1 = ((i * 15 + 5) * Math.PI) / 180;
    return `M${cx} ${cy}L${cx + L * Math.cos(a0)} ${cy + L * Math.sin(a0)}L${cx + L * Math.cos(a1)} ${cy + L * Math.sin(a1)}Z`;
  }).join('');
  return (
    <View style={{ paddingBottom: 52 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <StatusBar style="light" />
      <LinearGradient colors={[J.headerFrom, J.primary]} locations={[0, 0.88]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={rays} fill="rgba(255,255,255,0.07)" />
          <Circle cx={cx} cy={cy} r={33} fill="rgba(245,181,43,0.28)" />
          <Circle cx={cx} cy={cy} r={15} fill={J.sun} />
        </Svg>
      )}
      <View style={[h.top, { paddingTop: insets.top + S.sm }]}>
        <HeaderButton icon="back" label="Back" onPress={onBack} />
        <Text style={h.title} numberOfLines={1}>{title}</Text>
        <HeaderButton icon="sliders" label="Filters" onPress={onFilter} />
      </View>
      {children}
      <View style={h.hill} pointerEvents="none">
        <Svg width="100%" height={34} viewBox="0 0 390 34" preserveAspectRatio="none">
          <Path d="M0 30Q195 -10 390 30V34H0z" fill="#fff" />
        </Svg>
      </View>
    </View>
  );
}

export const HeaderButton = ({ icon, label, onPress }: { icon: 'back' | 'sliders'; label: string; onPress?: () => void }) => (
  <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [h.btn, pressed && { transform: [{ scale: 0.975 }] }]}>
    <AppIcon name={icon} size={22} color="#fff" />
  </Pressable>
);

export const HeaderLead = ({ title, sub, maxWidth = 290 }: { title: string; sub?: string; maxWidth?: number }) => (
  <View style={{ paddingHorizontal: S.lg, paddingTop: S.lg, maxWidth }}>
    <Text style={h.lead}>{title}</Text>
    {sub ? <Text style={h.leadSub}>{sub}</Text> : null}
  </View>
);

/* ───────────── Match gauge (half circle) ───────────── */
export function Gauge({ value, size = 52 }: { value: number; size?: number }) {
  const r = size / 2 - 5, ht = Math.round(size * 0.62), c = Math.PI * r;
  const d = `M5 ${ht - 2}A${r} ${r} 0 0 1 ${size - 5} ${ht - 2}`;
  const big = size > 60;
  return (
    <View style={{ width: size, height: ht + (big ? 14 : 8) }}>
      <Svg width={size} height={ht}>
        <Path d={d} fill="none" stroke={J.track} strokeWidth={5} strokeLinecap="round" />
        <Path d={d} fill="none" stroke={J.primary} strokeWidth={5} strokeLinecap="round" strokeDasharray={[c, c]} strokeDashoffset={c * (1 - value / 100)} />
      </Svg>
      <Text style={[u.gaugeNum, big && { fontSize: TS.section }]}>{value}%</Text>
    </View>
  );
}

/* ───────────── Round selector with check badge (category / day / salary / radius) ───────────── */
export function SelectorCircle({ label, selected, onPress, tint = J.tint, size = 60, children }: {
  label?: string; selected: boolean; onPress: () => void; tint?: string; size?: number; children: React.ReactNode;
}) {
  const badge = size < 50 ? 18 : 22;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ width: label ? 72 : size, alignItems: 'center' }}>
      <View
        style={[u.sel, { width: size, height: size, borderRadius: size / 2, backgroundColor: selected ? '#fff' : tint },
          selected && { borderColor: J.primary, transform: [{ translateY: -2 }], ...selectedShadow }]}
      >
        {children}
        {selected && (
          <View style={[u.badge, { width: badge, height: badge, borderRadius: badge / 2, top: size < 50 ? -6 : -4, right: size < 50 ? -6 : -4 }]}>
            <AppIcon name="check" size={size < 50 ? 10 : 12} color={J.deep} strokeWidth={2.8} />
          </View>
        )}
      </View>
      {label ? <Text style={[u.selLabel, selected && { fontFamily: F.h700, color: J.deep }]} numberOfLines={1}>{label}</Text> : null}
    </Pressable>
  );
}
const selectedShadow = { shadowColor: J.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 4 };
export const SelectorText = ({ children, selected }: { children: string; selected?: boolean }) => (
  <Text style={{ fontFamily: F.h700, fontSize: TS.meta, color: J.deep }}>{children}</Text>
);

/* ───────────── Section title with sun dot ───────────── */
export const SectionTitle = ({ children }: { children: string }) => (
  <View style={u.ttl}>
    <View style={u.dotHalo}><View style={u.dot} /></View>
    <Text style={u.ttlT}>{children}</Text>
    <LinearGradient colors={[J.border, 'rgba(228,236,236,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
  </View>
);

/* ───────────── Job card ───────────── */
export function JobCard({ lead, title, subtitle, chips, extra, right, saved, onToggleSave, onPress, boosted }: {
  lead: React.ReactNode; title: string; subtitle: string; chips?: string[]; extra?: React.ReactNode; right?: React.ReactNode;
  saved?: boolean; onToggleSave?: () => void; onPress?: () => void; boosted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [u.card, pressed && !!onPress && { transform: [{ scale: 0.985 }] }]}>
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={u.cardT} numberOfLines={1}>{title}</Text>
        <Text style={u.cardS} numberOfLines={1}>{subtitle}</Text>
        {chips?.length ? <Chips items={chips} style={{ marginRight: 40 }} /> : null}
        {boosted ? (
          <View style={{ marginRight: 40 }}><View style={u.adPill}><Text style={u.adText}>Ads</Text></View></View>
        ) : null}
        {extra ? <View style={{ marginRight: 40 }}>{extra}</View> : null}
      </View>
      {/* The save button floats bottom-right; keep the right column clear of it. */}
      {right ? <View style={onToggleSave ? { paddingBottom: 44 } : null}>{right}</View> : null}
      {onToggleSave ? <SaveButton saved={!!saved} onPress={onToggleSave} /> : null}
    </Pressable>
  );
}

export const Chips = ({ items, style, tone = 'neutral' }: { items: string[]; style?: StyleProp<ViewStyle>; tone?: 'neutral' | 'tint' | 'white' }) => (
  <View style={[u.chips, style]}>
    {items.map((c) => (
      <View key={c} style={[u.chip, tone === 'tint' && { backgroundColor: J.tint }, tone === 'white' && { backgroundColor: '#fff' }]}>
        <Text style={u.chipT}>{c}</Text>
      </View>
    ))}
  </View>
);

export function SaveButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityLabel={saved ? 'Saved' : 'Save job'} style={[u.save, saved && { backgroundColor: J.deep }]}>
      <AppIcon name={saved ? 'check' : 'plus'} size={18} color="#fff" strokeWidth={2.2} />
    </Pressable>
  );
}

/* Leads for JobCard */
export const LogoSquare = ({ letter, tint = 0 }: { letter: string; tint?: number }) => (
  <LinearGradient colors={TINTS[tint % 4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={u.logo}>
    <Text style={u.logoT}>{letter}</Text>
  </LinearGradient>
);
export const LogoCircle = ({ letter, color }: { letter: string; color: string }) => (
  <View style={[u.logo, { borderRadius: 28, backgroundColor: color }]}><Text style={[u.logoT, { color: '#fff' }]}>{letter}</Text></View>
);
export const DateBlock = ({ day, time, tint = 0 }: { day: string; time: string; tint?: number }) => (
  <LinearGradient colors={TINTS[tint % 4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[u.logo, { width: 60 }]}>
    <Text style={u.dayT}>{day}</Text><Text style={u.timeT}>{time}</Text>
  </LinearGradient>
);

/* Right-column helpers */
export const ClayTag = ({ children }: { children: string }) => <View style={u.clay}><Text style={u.clayT}>{children}</Text></View>;
/** "0.4 km", "2.9 km", "12 km": one decimal under 10 km, whole numbers above. */
const kmText = (km: number) => (km < 10 ? `${(Math.round(km * 10) / 10).toFixed(1)} km` : `${Math.round(km)} km`);
export const DistanceBadge = ({ km, note }: { km: number; note: string }) => (
  <View style={{ alignItems: 'flex-end' }}>
    <View style={u.dist}><AppIcon name="pin" size={14} color={J.deep} /><Text style={u.distT}>{kmText(km)}</Text></View>
    <Text style={[u.cardS, { fontSize: TS.caption, marginTop: S.xs }]}>{note}</Text>
  </View>
);

/* ───────────── Sliding segmented control (N tabs) ───────────── */
export function Segmented({ items, index, onChange, style }: {
  items: string[]; index: number; onChange: (i: number) => void; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const segW = Math.max(0, (w - 8) / items.length);
  useEffect(() => { x.value = withTiming(index * segW, { duration: 300 }); }, [index, segW, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[u.seg, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[u.segInd, { width: segW }, ind]} />
      {items.map((t, i) => (
        <Pressable key={t} style={u.segItem} onPress={() => onChange(i)} accessibilityRole="tab" accessibilityState={{ selected: i === index }}>
          <Text style={[u.segT, i === index && { color: '#fff' }]}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MiniSegmented({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) {
  return (
    <View style={u.mini}>
      {items.map((t, i) => (
        <Pressable key={t} onPress={() => onChange(i)} style={[u.miniItem, i === index && u.miniOn]}>
          <Text style={[u.miniT, i === index && { color: J.deep }]}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* Squircle chip with check (role filters etc.) */
export const RoleChip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityState={{ selected }} style={[u.role, selected && { backgroundColor: J.tint, borderColor: J.primary }]}>
    {selected && <AppIcon name="check" size={16} color={J.deep} strokeWidth={2.4} />}
    <Text style={[u.roleT, selected && { color: J.deep }]}>{label}</Text>
  </Pressable>
);

/* ───────────── Weekend ticket ───────────── */
export function Ticket({ stub, stubSub, title, subtitle, chips, price, saved, onToggleSave }: {
  stub: string; stubSub: string; title: string; subtitle: string; chips: string[]; price: string; saved: boolean; onToggleSave: () => void;
}) {
  return (
    <View style={u.tk}>
      <View style={u.stub}><Text style={u.stubD}>{stub}</Text><Text style={u.stubS}>{stubSub}</Text></View>
      <View style={u.dashes} pointerEvents="none">
        {Array.from({ length: 30 }, (_, i) => <View key={i} style={u.dash} />)}
      </View>
      <View style={{ flex: 1, paddingLeft: S.lg, paddingRight: 44, minWidth: 0 }}>
        <Text style={u.cardT} numberOfLines={1}>{title}</Text>
        <Text style={[u.cardS, { color: '#6B5A3C' }]} numberOfLines={1}>{subtitle}</Text>
        <Chips items={chips} tone="white" />
      </View>
      <View style={[u.notch, { top: -8 }]} /><View style={[u.notch, { bottom: -8 }]} />
      <View style={{ position: 'absolute', right: S.md, top: S.md }}><ClayTag>{price}</ClayTag></View>
      <SaveButton saved={saved} onPress={onToggleSave} />
    </View>
  );
}

/* Remote working-hours bar (12 segments = 6 AM to 6 PM) */
export const HoursBar = ({ from, to }: { from: number; to: number }) => (
  <View>
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ flex: 1, maxWidth: 14, height: 6, borderRadius: 3, backgroundColor: i >= from && i < to ? J.primary : '#DCE8E8' }} />
      ))}
    </View>
    <Text style={[u.cardS, { fontSize: TS.caption, marginTop: S.xs }]}>Usual hours, 6 AM → 6 PM</Text>
  </View>
);

/* Floating white card that overlaps the header (hero, stats, segmented control) */
export const OverlapCard = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ marginTop: -30, marginHorizontal: S.lg, backgroundColor: '#fff', borderRadius: R.hero, padding: S.lg, ...shadowMd }, style]}>{children}</View>
);

const h = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg },
  title: { flex: 1, fontFamily: F.h800, fontSize: TS.header, color: '#fff' },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  lead: { fontFamily: F.h800, fontSize: TS.hero, lineHeight: 29, color: '#fff' },
  leadSub: { fontFamily: F.b400, fontSize: TS.body, color: 'rgba(255,255,255,0.92)', marginTop: 6 },
  hill: { position: 'absolute', left: 0, right: 0, bottom: -1 },
});

const u = StyleSheet.create({
  gaugeNum: { position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontFamily: F.h800, fontSize: TS.caption, color: J.deep },
  sel: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  badge: { position: 'absolute', backgroundColor: J.sun, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  selLabel: { fontFamily: F.b500, fontSize: TS.meta, color: J.fg, marginTop: 6, textAlign: 'center' },
  ttl: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xl, marginBottom: S.md, marginHorizontal: S.lg },
  dotHalo: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(245,181,43,0.28)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: J.sun },
  ttlT: { fontFamily: F.h800, fontSize: TS.section, color: J.fg },
  card: { flexDirection: 'row', gap: S.md, padding: 14, borderWidth: 1, borderColor: J.border, borderRadius: R.card, backgroundColor: '#fff', ...shadowSm },
  cardT: { fontFamily: F.h700, fontSize: TS.title, color: J.fg },
  cardS: { fontFamily: F.b400, fontSize: TS.meta, color: J.muted, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.sm },
  chip: { backgroundColor: J.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  chipT: { fontFamily: F.b500, fontSize: TS.caption, color: J.deep },
  adPill: { backgroundColor: J.sun, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  adText: { fontFamily: F.b600, fontSize: TS.caption, color: J.deep },
  save: { position: 'absolute', right: S.md, bottom: S.md, width: 36, height: 36, borderRadius: 18, backgroundColor: J.primary, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 56, height: 56, borderRadius: R.logo, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoT: { fontFamily: F.h800, fontSize: 22, color: J.deep },
  dayT: { fontFamily: F.h800, fontSize: TS.header, color: J.deep, lineHeight: 23 },
  timeT: { fontFamily: F.b600, fontSize: 11, color: J.deep },
  clay: { backgroundColor: J.clay, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  clayT: { fontFamily: F.b600, fontSize: TS.caption, color: '#fff' },
  dist: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: J.tint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  distT: { fontFamily: F.b600, fontSize: TS.caption, color: J.deep },
  seg: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: R.pill, padding: 4, ...shadowMd },
  segInd: { position: 'absolute', left: 4, top: 4, height: 48, borderRadius: R.pill, backgroundColor: J.primary },
  segItem: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  segT: { fontFamily: F.h700, fontSize: TS.meta, color: J.muted },
  mini: { flexDirection: 'row', backgroundColor: J.bg, borderRadius: R.pill, padding: 3, marginHorizontal: S.lg },
  miniItem: { flex: 1, height: 36, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  miniOn: { backgroundColor: '#fff', ...shadowSm },
  miniT: { fontFamily: F.b600, fontSize: TS.meta, color: J.muted },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: S.lg, borderRadius: R.chip, backgroundColor: J.bg, borderWidth: 1.5, borderColor: 'transparent' },
  roleT: { fontFamily: F.b600, fontSize: TS.meta, color: J.fg },
  tk: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 14, borderRadius: 18, backgroundColor: J.cream },
  stub: { width: 76, alignItems: 'center' },
  stubD: { fontFamily: F.h800, fontSize: TS.header, letterSpacing: 0.4, color: J.creamInk },
  stubS: { fontFamily: F.b600, fontSize: TS.caption, color: J.creamInk },
  dashes: { width: 2, alignSelf: 'stretch', overflow: 'hidden', gap: 4 },
  dash: { width: 2, height: 4, backgroundColor: 'rgba(122,67,0,0.35)' },
  notch: { position: 'absolute', left: 69, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
});