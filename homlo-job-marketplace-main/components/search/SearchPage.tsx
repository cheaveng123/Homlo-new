// Search page (opened from the Home / Explore search pill), in the current
// Homlo style: round back button + search field, a "Search area" card, recent
// searches as rows with remove, and the 19 job fields as a 2-column grid with
// their secondary (duotone line) icons. Same props as SearchScreenNew (presentational).
import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { JobFieldGlyph } from '@/components/shared/JobFieldGlyphs';
import { F } from '@/components/vista/category/tokens';
import { BackGlyph } from '@/components/vista/category/glyphs';
import type { SuggestionNew, TrendingNew } from '@/src/new/screens/SearchScreenNew';

const LINE = '#E3E9EC';

type Props = {
  query: string; onChangeQuery: (q: string) => void; onSubmit: (q: string) => void; onCancel: () => void;
  recent: string[]; onPressRecent: (q: string) => void;
  suggestions: SuggestionNew[]; onPressSuggestion: (s: SuggestionNew) => void;
  trending: TrendingNew[]; onPressTrending: (t: TrendingNew) => void;
  onBack?: () => void; locationLabel?: string; onPressLocation?: () => void;
  onClearRecent?: () => void; onRemoveRecent?: (q: string) => void;
};

const enter = (i: number) =>
  FadeInDown.delay(i * 70).duration(durations.enter).easing(SMOOTH).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- glyphs ---------- */
const st = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const SearchGlyph = ({ size = 20, color = palette.muted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} strokeWidth={1.9} {...st}>
    <Circle cx={11} cy={11} r={6.5} /><Path d="m16 16 4 4" />
  </Svg>
);
const ClearGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={9} fill="#C9D3D8" />
    <Path d="m9 9 6 6M15 9l-6 6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
const HistoryGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" stroke={palette.slate} strokeWidth={1.8} {...st}>
    <Path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><Path d="M3.5 4.5V8H7" /><Path d="M12 8v4.2l2.8 1.7" />
  </Svg>
);
const CloseGlyph = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" stroke={palette.muted} strokeWidth={2.2} {...st}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
const PinGlyph = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" stroke={palette.cyanDeep} strokeWidth={1.9} {...st}>
    <Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" /><Circle cx={12} cy={11} r={2} />
  </Svg>
);
const ChevronGlyph = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" stroke={palette.navy} strokeWidth={2} {...st}>
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);
const TrendGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" stroke={palette.cyanDeep} strokeWidth={1.9} {...st}>
    <Path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </Svg>
);

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.secRow}>
      <Text style={s.secTitle} accessibilityRole="header">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={s.secAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchPage(p: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const input = useRef<TextInput>(null);
  const e = (i: number) => (reduce ? undefined : enter(i));
  const recent = p.recent.slice(0, 6);
  const { width } = useWindowDimensions();
  const tileW = (width - 32 - 10) / 2;

  return (
    <View style={[s.page, { paddingTop: insets.top + 8 }]}>
      {/* back + search field */}
      <View style={s.top}>
        <Pressable onPress={p.onBack ?? p.onCancel} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [s.back, pressed && { opacity: 0.7 }]}>
          <BackGlyph size={22} color={palette.navy} />
        </Pressable>
        <Pressable onPress={() => input.current?.focus()} style={s.field}>
          <SearchGlyph />
          <TextInput
            ref={input}
            autoFocus
            value={p.query}
            onChangeText={p.onChangeQuery}
            onSubmitEditing={() => p.onSubmit(p.query)}
            returnKeyType="search"
            placeholder="Search jobs, skills or companies"
            placeholderTextColor={palette.muted}
            style={s.input}
            accessibilityLabel="Search jobs"
          />
          {p.query ? (
            <Pressable onPress={() => p.onChangeQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <ClearGlyph />
            </Pressable>
          ) : null}
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* search area */}
        {p.locationLabel ? (
          <Animated.View entering={e(0)} style={s.gutter}>
            <PressableScale scale={0.985} onPress={() => { haptic.selection(); p.onPressLocation?.(); }} accessibilityRole="button" accessibilityLabel={`Search area, ${p.locationLabel}. Change`} style={s.area}>
              <View style={s.areaTile}><PinGlyph /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.areaKicker}>Search area</Text>
                <Text style={s.areaLabel} numberOfLines={1}>{p.locationLabel}</Text>
              </View>
              <Text style={s.areaChange}>Change</Text>
              <ChevronGlyph />
            </PressableScale>
          </Animated.View>
        ) : null}

        {/* recent searches */}
        {recent.length > 0 ? (
          <Animated.View entering={e(1)}>
            <SectionHead title="Recent searches" action={p.onClearRecent ? 'Clear all' : undefined} onAction={p.onClearRecent} />
            <View style={[s.gutter]}>
              <View style={s.card}>
                {recent.map((r, i) => (
                  <View key={r} style={[s.recentRow, i > 0 && s.rowSep]}>
                    <Pressable onPress={() => p.onPressRecent(r)} accessibilityRole="button" accessibilityLabel={`Search ${r}`} style={({ pressed }) => [s.recentMain, pressed && { opacity: 0.7 }]}>
                      <HistoryGlyph />
                      <Text style={s.recentText} numberOfLines={1}>{r}</Text>
                    </Pressable>
                    {p.onRemoveRecent ? (
                      <Pressable onPress={() => p.onRemoveRecent?.(r)} accessibilityRole="button" accessibilityLabel={`Remove ${r} from recent searches`} style={s.remove}>
                        <CloseGlyph />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* popular categories */}
        {p.suggestions.length > 0 ? (
          <Animated.View entering={e(2)}>
            <SectionHead title="Popular categories" />
            <View style={s.grid}>
              {p.suggestions.map((sug) => {
                return (
                  <View key={sug.id} style={{ width: tileW }}>
                  <PressableScale
                    scale={0.97}
                    onPress={() => { haptic.selection(); p.onPressSuggestion(sug); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${sug.label}`}
                    style={s.tile}
                  >
                    <View style={s.tileArt}>
                      <JobFieldGlyph id={sug.id} size={24} />
                    </View>
                    <Text style={s.tileText} numberOfLines={2}>{sug.label}</Text>
                  </PressableScale>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {/* trending (only when the route supplies items) */}
        {p.trending.length > 0 ? (
          <Animated.View entering={e(3)}>
            <SectionHead title="Trending" />
            <View style={s.gutter}>
              <View style={s.card}>
                {p.trending.map((t, i) => (
                  <Pressable key={t.id} onPress={() => p.onPressTrending(t)} style={({ pressed }) => [s.recentRow, s.recentMain, i > 0 && s.rowSep, pressed && { opacity: 0.7 }]}>
                    <TrendGlyph />
                    <Text style={s.recentText} numberOfLines={1}>{t.label}</Text>
                    {t.deltaLabel ? <Text style={s.delta}>{t.deltaLabel}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.page },
  gutter: { paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: palette.cyan, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: F.m, fontSize: 15.5, color: palette.ink, paddingVertical: 0 },
  area: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: '#E6EDEF',
  },
  areaTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.cyanTint, alignItems: 'center', justifyContent: 'center' },
  areaKicker: { fontFamily: F.m, fontSize: 12, color: palette.muted },
  areaLabel: { fontFamily: F.hb, fontSize: 15, color: palette.navy },
  areaChange: { fontFamily: F.hb, fontSize: 13, color: palette.navy },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 24, marginBottom: 10 },
  secTitle: { fontFamily: F.h, fontSize: 18, color: palette.navy },
  secAction: { fontFamily: F.hb, fontSize: 13.5, color: palette.cyanDeep },
  card: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: '#E6EDEF', overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  recentMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, minHeight: 52 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE4E7' },
  recentText: { flex: 1, fontFamily: F.m, fontSize: 15, color: palette.ink },
  remove: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  delta: { marginRight: 14, fontFamily: F.s, fontSize: 12, color: palette.cyanDeep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  tile: {
    width: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#E6EDEF',
  },
  tileArt: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, fontFamily: F.hb, fontSize: 14, lineHeight: 18, color: palette.navy },
});
