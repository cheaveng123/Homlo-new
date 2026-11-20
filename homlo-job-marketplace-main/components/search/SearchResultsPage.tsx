// Search results page in the current Homlo style: round back button, editable
// search field with a filter button, design-style filter chips (active = navy),
// a count line, and white result cards (photo, title, company, pay, spots
// left, type, save heart). Shimmer skeletons, line-art empty/error states.
// Same props as SearchResultsScreenNew (presentational only).
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { BackGlyph } from '@/components/vista/category/glyphs';
import { EmptyArt } from '@/components/vista/category/EmptyArt';
import { Placeholder } from '@/components/jobs-v2/jobtype/EmployerCard';
import { MegaphoneIcon, PersonIcon } from '@/components/jobs-v2/jobtype/glyphs';
import { SkeletonBlock } from '@/components/loading/HomloSkeletonKit';
import { useCopyNew } from '@/src/new/theme/copyNew';
import type { JobSummaryNew, ScreenStateNew } from '@/src/new/types/jobNew';
import type { ResultFilterNew } from '@/src/new/screens/SearchResultsScreenNew';

const LINE = '#E3E9EC';

type Props = {
  state: ScreenStateNew; query: string; onBack: () => void; onEditQuery: () => void; onPressFilter: () => void;
  onChangeQuery?: (q: string) => void;
  filters: ResultFilterNew[]; activeFilterId: string; onSelectFilter: (id: string) => void;
  resultCount: number; sortLabel?: string; onPressSort?: () => void;
  results: JobSummaryNew[]; onPressJob: (id: string) => void; onToggleLike: (id: string) => void;
  onClearFilters: () => void; onRetry: () => void;
};

const enter = (i: number) =>
  FadeInDown.delay(Math.min(i, 6) * 60).duration(durations.enter).easing(SMOOTH).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- glyphs ---------- */
const st = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const SearchGlyph = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" stroke={palette.muted} strokeWidth={1.9} {...st}>
    <Circle cx={11} cy={11} r={6.5} /><Path d="m16 16 4 4" />
  </Svg>
);
const FilterGlyph = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" stroke={palette.navy} strokeWidth={1.8} {...st}>
    <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><Circle cx={16} cy={7} r={2} /><Circle cx={8} cy={17} r={2} />
  </Svg>
);
const CheckGlyph = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" stroke="#FFFFFF" strokeWidth={2.4} {...st}><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
const HeartGlyph = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M12 20s-7.5-4.6-7.5-10.2a4.2 4.2 0 0 1 7.5-2.5 4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
      fill={on ? palette.navy : 'none'} stroke={on ? palette.navy : palette.muted} strokeWidth={1.9} strokeLinejoin="round" />
  </Svg>
);
const PinGlyph = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" stroke={palette.muted} strokeWidth={1.9} {...st}>
    <Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" /><Circle cx={12} cy={11} r={2} />
  </Svg>
);

/* ---------- result card ---------- */
function ResultCard({ job, onPress, onToggleLike }: { job: JobSummaryNew; onPress: () => void; onToggleLike: () => void }) {
  const [amount, unit] = job.payLabel.split('/').map((x) => x.trim());
  const spots = job.positionsTotal > 0 ? `${job.positionsLeft} of ${job.positionsTotal} spots left` : undefined;
  return (
    <PressableScale scale={0.985} onPress={() => { haptic.selection(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${job.title}${job.employerName ? ` at ${job.employerName}` : ''}`} style={c.card}>
      {job.imageUri ? (
        <Image source={{ uri: job.imageUri }} style={c.photo} accessibilityIgnoresInvertColors />
      ) : (
        <Placeholder label="Photo" style={c.photo} />
      )}
      <View style={c.body}>
        {job.boosted ? (
          <View style={c.ad}><MegaphoneIcon size={12} /><Text style={c.adText}>Ad</Text></View>
        ) : null}
        <Text style={c.title} numberOfLines={2}>{job.title}</Text>
        {job.employerName ? <Text style={c.company} numberOfLines={1}>{job.employerName}</Text> : null}
        {job.locationLabel ? (
          <View style={c.metaRow}><PinGlyph /><Text style={c.meta} numberOfLines={1}>{job.locationLabel}</Text></View>
        ) : null}
        <View style={c.bottom}>
          <Text style={c.pay}>
            {amount}{unit ? <Text style={c.unit}> /{unit}</Text> : null}
          </Text>
          {job.typeLabel ? <View style={c.chip}><Text style={c.chipText}>{job.typeLabel}</Text></View> : null}
        </View>
        {spots ? (
          <View style={c.metaRow}><PersonIcon size={15} /><Text style={c.spots}>{spots}</Text></View>
        ) : null}
      </View>
      <Pressable
        onPress={() => { haptic.selection(); onToggleLike(); }}
        accessibilityRole="button"
        accessibilityLabel={job.liked ? 'Remove from saved' : 'Save job'}
        accessibilityState={{ selected: !!job.liked }}
        style={c.heart}
      >
        <HeartGlyph on={!!job.liked} />
      </Pressable>
    </PressableScale>
  );
}

function SkeletonCard() {
  return (
    <View style={[c.card, { gap: 12 }]}>
      <SkeletonBlock width={92} height={92} borderRadius={14} />
      <View style={{ flex: 1, gap: 9, paddingTop: 4 }}>
        <SkeletonBlock width="80%" height={15} />
        <SkeletonBlock width="50%" height={12} />
        <SkeletonBlock width="40%" height={12} />
        <SkeletonBlock width="30%" height={15} />
      </View>
    </View>
  );
}

export function SearchResultsPage(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const e = (i: number) => (reduce ? undefined : enter(i));

  return (
    <View style={[s.page, { paddingTop: insets.top + 8 }]}>
      <View style={s.top}>
        <Pressable onPress={p.onBack} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [s.round, pressed && { opacity: 0.7 }]}>
          <BackGlyph size={22} color={palette.navy} />
        </Pressable>
        <View style={s.field}>
          <SearchGlyph />
          {p.onChangeQuery ? (
            <TextInput
              value={p.query}
              onChangeText={p.onChangeQuery}
              onSubmitEditing={p.onEditQuery}
              returnKeyType="search"
              placeholder="Search jobs"
              placeholderTextColor={palette.muted}
              style={s.input}
              accessibilityLabel="Search jobs"
            />
          ) : (
            <Pressable onPress={p.onEditQuery} style={{ flex: 1 }}><Text style={s.input} numberOfLines={1}>{p.query}</Text></Pressable>
          )}
        </View>
        <Pressable onPress={() => { haptic.selection(); p.onPressFilter(); }} accessibilityRole="button" accessibilityLabel="Filters" style={({ pressed }) => [s.filterBtn, pressed && { opacity: 0.7 }]}>
          <FilterGlyph />
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {p.filters.map((f) => {
            const on = f.id === p.activeFilterId;
            return (
              <PressableScale
                key={f.id}
                scale={0.97}
                onPress={() => { if (!on) { haptic.selection(); p.onSelectFilter(f.id); } }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.chip, on && s.chipOn]}
              >
                {on ? <CheckGlyph /> : null}
                <Text style={[s.chipText, on && s.chipTextOn]}>{f.label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.countRow}>
        <Text style={s.count}>{p.state === 'ready' ? copy.results.found(p.resultCount) : p.state === 'loading' ? 'Searching…' : ' '}</Text>
        {p.sortLabel ? (
          <Pressable onPress={p.onPressSort} accessibilityRole="button" style={s.sort}><Text style={s.sortText}>{p.sortLabel}</Text></Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 12 }} showsVerticalScrollIndicator={false}>
        {p.state === 'loading' ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />) : null}
        {p.state === 'empty' ? (
          <EmptyArt title={copy.results.empty} body="Try a different word, or clear the filters to see more jobs." actionLabel={copy.results.emptyAction} onAction={p.onClearFilters} />
        ) : null}
        {p.state === 'error' ? (
          <EmptyArt title={copy.results.error} body="We couldn't load jobs. Check your connection and try again." actionLabel={copy.results.errorAction} onAction={p.onRetry} />
        ) : null}
        {p.state === 'ready'
          ? p.results.map((j, i) => (
              <Animated.View key={j.id} entering={e(i)}>
                <ResultCard job={j} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />
              </Animated.View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.page },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: F.m, fontSize: 15.5, color: palette.ink, paddingVertical: 0 },
  filterBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  chip: { height: 38, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  chipOn: { backgroundColor: palette.navy, borderColor: palette.navy },
  chipText: { fontFamily: F.s, fontSize: 13.5, color: palette.ink },
  chipTextOn: { color: '#FFFFFF' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  count: { fontFamily: F.m, fontSize: 13, color: palette.muted },
  sort: { height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: LINE, justifyContent: 'center' },
  sortText: { fontFamily: F.s, fontSize: 12.5, color: palette.navy },
});

const c = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: '#E6EDEF',
    shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  photo: { width: 92, height: 92, borderRadius: 14 },
  body: { flex: 1, minWidth: 0, paddingRight: 30 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  adText: { fontFamily: F.hb, fontSize: 12, color: palette.amberInk },
  title: { fontFamily: F.h, fontSize: 15.5, lineHeight: 20, color: palette.navy },
  company: { marginTop: 2, fontFamily: F.m, fontSize: 13, color: palette.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { flexShrink: 1, fontFamily: F.m, fontSize: 12.5, color: palette.muted },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pay: { fontFamily: F.h, fontSize: 16, color: palette.navy },
  unit: { fontFamily: F.m, fontSize: 12, color: palette.muted },
  chip: { height: 24, borderRadius: 8, paddingHorizontal: 8, backgroundColor: palette.cyanTint, justifyContent: 'center' },
  chipText: { fontFamily: F.s, fontSize: 12, color: palette.cyanDeep },
  spots: { fontFamily: F.m, fontSize: 12.5, color: palette.muted },
  heart: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
