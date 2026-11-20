// JobTypeScreen.tsx
// Job type page (opened from a Home Job type card). Matches the approved
// "Job type page" preview:
//   sticky header (back + search, 4-up type picker that collapses on scroll)
//   → filter row → "<Type> jobs" title → employer listings.
// Visual layer only: data, hooks and handlers come from app/jobs/ways-to-work.tsx.
import React, { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import { BackArrow, FilterIcon, PinIcon, SearchIcon } from './jobtype/glyphs';
import { TypePicker, type PickerType } from './jobtype/TypePicker';
import { EmployerCard, Reveal } from './jobtype/EmployerCard';
import { CountSkeleton, EmptyState, ErrorState, LoadingState } from './jobtype/States';
import { groupByEmployer, type EmployerGroup, type ListedJob } from './jobtype/model';

export type { ListedJob } from './jobtype/model';

type Props = {
  types: PickerType[];
  type: string;
  onSelectType: (key: string) => void;
  jobs: ListedJob[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
  onSearch?: () => void;
  onFilters?: () => void;
  onNearMe?: () => void;
  onOpenJob: (id: string) => void;
  onOpenEmployer?: (company: string) => void;
  isSaved: (id: string) => boolean;
  onToggleSave: (id: string) => void;
};

const COLLAPSE_AT = 90;
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<EmployerGroup>);

function Chip({ label, icon, onPress, accessibilityLabel }: {
  label?: string; icon?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      scale={0.97}
      onPress={() => { haptic.selection(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[s.chip, !label && s.chipIcon]}
    >
      {icon}
      {label ? <Text style={s.chipText}>{label}</Text> : null}
    </PressableScale>
  );
}

export default function JobTypeScreen({
  types, type, onSelectType, jobs, loading, error, onRetry, onBack, onSearch, onFilters, onNearMe,
  onOpenJob, onOpenEmployer, isSaved, onToggleSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const label = types.find((t) => t.key === type)?.label ?? 'Jobs';
  // Noun form for copy: "Weekend jobs", not "Weekends jobs".
  const noun = type === 'weekends' ? 'Weekend' : label;
  const groups = useMemo(() => groupByEmployer(jobs), [jobs]);
  const shiftLabel = type === 'weekends' ? 'Days' : 'Shift';

  // Picker collapses to a compact row after ~90pt of scroll.
  const scrollY = useSharedValue(0);
  const collapse = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const setCollapsed = useCallback((on: boolean) => {
    collapse.set(reduce ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 280, easing: SMOOTH }));
  }, [collapse, reduce]);
  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_AT,
    (on, prev) => { if (on !== prev && prev !== null) runOnJS(setCollapsed)(on); },
  );

  // A new type remounts the list at the top: reopen the picker with it.
  useEffect(() => {
    scrollY.set(0);
    setCollapsed(false);
  }, [type, scrollY, setCollapsed]);

  const openEmployer = useCallback((g: EmployerGroup) => onOpenEmployer?.(g.company), [onOpenEmployer]);

  const header = (
    <View>
      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {onFilters ? <Chip icon={<FilterIcon />} onPress={onFilters} accessibilityLabel="Filters" /> : null}
          {onNearMe ? <Chip label="Near me" icon={<PinIcon size={18} />} onPress={onNearMe} /> : null}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', palette.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.filterFade} />
      </View>
      <View style={s.sec}>
        <Text style={s.secTitle} accessibilityRole="header">{noun} jobs</Text>
        {loading ? <CountSkeleton /> : !error ? <Text style={s.secCount}>{jobs.length} open</Text> : null}
        <LinearGradient colors={[palette.line, 'rgba(230,237,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.secLine} />
      </View>
    </View>
  );

  const empty = loading ? (
    <View style={s.gutter}><LoadingState /></View>
  ) : error ? (
    <ErrorState onRetry={() => onRetry?.()} />
  ) : (
    <EmptyState typeLabel={noun} onAction={() => onSearch?.()} />
  );

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.bar}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={6} style={s.back}>
            <BackArrow />
          </Pressable>
          <Pressable
            onPress={() => { haptic.selection(); onSearch?.(); }}
            accessibilityRole="search"
            accessibilityLabel={`Search ${noun.toLowerCase()} jobs`}
            style={({ pressed }) => [s.search, pressed && { opacity: 0.85 }]}
          >
            <SearchIcon />
            <Text style={s.searchText} numberOfLines={1}>Search {noun.toLowerCase()} jobs</Text>
          </Pressable>
        </View>
        <TypePicker types={types} selected={type} onSelect={onSelectType} collapse={collapse} />
        <LinearGradient pointerEvents="none" colors={[palette.surface, 'rgba(255,255,255,0)']} style={s.headerFade} />
      </View>

      <AnimatedFlatList
        key={type}
        data={loading || error ? [] : groups}
        keyExtractor={(g) => g.key}
        renderItem={({ item, index }) => (
          <View style={s.gutter}>
            <Reveal index={index}>
              <EmployerCard
                group={item}
                shiftLabel={shiftLabel}
                last={index === groups.length - 1}
                isSaved={isSaved}
                onOpenEmployer={openEmployer}
                onOpenJob={onOpenJob}
                onToggleSave={onToggleSave}
              />
            </Reveal>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={s.list}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  header: { backgroundColor: palette.surface, paddingHorizontal: 16, zIndex: 2 },
  headerFade: { position: 'absolute', left: 0, right: 0, bottom: -14, height: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  search: {
    flex: 1, height: 48, borderRadius: 16, backgroundColor: palette.field,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  searchText: { flex: 1, fontFamily: F.b, fontSize: 16, color: palette.muted },
  list: { flex: 1 },
  gutter: { paddingHorizontal: 16 },
  filterWrap: { position: 'relative' },
  filters: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterFade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 32 },
  chip: {
    height: 44, borderRadius: 999, borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16,
  },
  chipIcon: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  chipText: { fontFamily: F.m, fontSize: 15.5, color: palette.ink },
  sec: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 4, paddingHorizontal: 16 },
  secTitle: { fontFamily: F.h, fontSize: 21, letterSpacing: -0.2, color: palette.ink },
  secCount: { fontFamily: F.b, fontSize: 14, color: palette.muted },
  secLine: { flex: 1, height: 1 },
});
