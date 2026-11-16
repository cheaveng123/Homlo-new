import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNameNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { ChipNew, EmptyStateNew, RoundButtonNew, SkeletonNew } from '../components/PrimitivesNew';
import { SearchPillNew } from '../components/SearchPillNew';
import { JobResultCardNew } from '../components/JobPartsNew';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';
import { JobSummaryNew, ScreenStateNew } from '../types/jobNew';

export type ResultFilterNew = { id: string; label: string; icon?: AppIconNameNew }; // All, Full-time, Part-time, Remote, Weekends (use the app's real filters)

type Props = {
  state: ScreenStateNew; query: string; onBack: () => void; onEditQuery: () => void; onPressFilter: () => void;
  // When provided the query pill is edited in place (keeps the app's live,
  // debounced search). Otherwise it is a tap-to-edit affordance.
  onChangeQuery?: (q: string) => void;
  filters: ResultFilterNew[]; activeFilterId: string; onSelectFilter: (id: string) => void;
  resultCount: number; sortLabel?: string; onPressSort?: () => void;
  results: JobSummaryNew[]; onPressJob: (id: string) => void; onToggleLike: (id: string) => void;
  onClearFilters: () => void; onRetry: () => void;
};

export function SearchResultsScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white, paddingTop: insets.top + 8 }}>
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
        <RoundButtonNew icon="back" onPress={p.onBack} accessibilityLabel={copy.common.back} />
        <View style={{ flex: 1 }}>
          <SearchPillNew
            onPress={p.onEditQuery}
            editable={!!p.onChangeQuery}
            value={p.query}
            onChangeText={p.onChangeQuery}
            onSubmitEditing={p.onEditQuery}
            inputPlaceholder={p.query}
            onRightPress={p.onPressFilter}
            height={48}
            right="filter"
            placeholder={<TextNew variant="body" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{p.query}</TextNew>}
          />
        </View>
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ marginTop: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {p.filters.map((f) => (
            <ChipNew key={f.id} size="lg" label={f.label} icon={f.id === p.activeFilterId ? 'chk' : f.icon} selected={f.id === p.activeFilterId} onPress={() => p.onSelectFilter(f.id)} />
          ))}
        </ScrollView>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, marginBottom: 4 }}>
        <TextNew variant="meta" color={colorsNew.muted}>{copy.results.found(p.resultCount)}</TextNew>
        {!!p.sortLabel && <ChipNew size="lg" height={36} icon="sort" label={p.sortLabel} onPress={p.onPressSort} />}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {p.state === 'loading' && [0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
            <SkeletonNew width={112} height={112} radius={16} />
            <View style={{ flex: 1, gap: 8 }}><SkeletonNew height={18} /><SkeletonNew width="60%" height={14} /><SkeletonNew width="40%" height={14} /></View>
          </View>
        ))}
        {p.state === 'empty' && <EmptyStateNew icon="search" title={copy.results.empty} actionLabel={copy.results.emptyAction} onAction={p.onClearFilters} />}
        {p.state === 'error' && <EmptyStateNew icon="x" title={copy.results.error} actionLabel={copy.results.errorAction} onAction={p.onRetry} tone="clay" />}
        {p.state === 'ready' && p.results.map((j, i) => (
          <Animated.View key={j.id} entering={enter(i + 2)}>
            <JobResultCardNew job={j} onPress={() => p.onPressJob(j.id)} onToggleLike={() => p.onToggleLike(j.id)} />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
