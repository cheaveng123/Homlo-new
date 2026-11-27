import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNameNew, AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { ChipNew, IconDiscNew, PressableScaleNew, SectionTitleNew } from '../components/PrimitivesNew';
import { SearchPillNew } from '../components/SearchPillNew';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';

export type SuggestionNew = { id: string; label: string; kind: 'search' | 'place' | 'job' | 'company' };
export type TrendingNew = { id: string; label: string; deltaLabel?: string };
const KIND_ICON: Record<SuggestionNew['kind'], AppIconNameNew> = { search: 'search', place: 'pin', job: 'brief', company: 'bld' };

type Props = {
  query: string; onChangeQuery: (q: string) => void; onSubmit: (q: string) => void; onCancel: () => void;
  recent: string[]; onPressRecent: (q: string) => void;
  suggestions: SuggestionNew[]; onPressSuggestion: (s: SuggestionNew) => void;
  trending: TrendingNew[]; onPressTrending: (t: TrendingNew) => void;
  // Retained from the pre-redesign search detail: a location row, back button,
  // and recent-item removal ("clear all" via the section action, per-item via
  // long press).
  onBack?: () => void; locationLabel?: string; onPressLocation?: () => void;
  onClearRecent?: () => void; onRemoveRecent?: (q: string) => void;
};

export function SearchScreenNew(p: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white, paddingTop: insets.top + 8 }}>
      {!!p.onBack && (
        <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
          <PressableScaleNew onPress={p.onBack} style={{ minHeight: 44, justifyContent: 'center' }}>
            <TextNew variant="body" weight="semibold" color={colorsNew.primary}>{copy.common.back}</TextNew>
          </PressableScaleNew>
        </Animated.View>
      )}
      {!!p.locationLabel && (
        <Animated.View entering={enter(0)} style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <PressableScaleNew onPress={p.onPressLocation} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <AppIconNew name="pin" size={16} color={colorsNew.primary} />
            <TextNew variant="meta" weight="medium" color={colorsNew.primary}>{p.locationLabel}</TextNew>
            <AppIconNew name="down" size={14} color={colorsNew.primary} />
          </PressableScaleNew>
        </Animated.View>
      )}
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}>
          <SearchPillNew editable autoFocus value={p.query} onChangeText={p.onChangeQuery} onSubmitEditing={() => p.onSubmit(p.query)}
            inputPlaceholder={copy.search.placeholder} right={p.query ? 'clear' : 'none'} onRightPress={() => p.onChangeQuery('')} />
        </View>
        <PressableScaleNew onPress={p.onCancel} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
          <TextNew variant="body" weight="semibold" color={colorsNew.primary}>{copy.search.cancel}</TextNew>
        </PressableScaleNew>
      </Animated.View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {p.recent.length > 0 && (
          <Animated.View entering={enter(1)}>
            <SectionTitleNew title={copy.search.recent} glyph="recent" actionLabel={p.onClearRecent ? copy.common.clear : undefined} onAction={p.onClearRecent} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
              {p.recent.map((r) => <ChipNew key={r} size="lg" icon="hist" label={r} onPress={() => p.onPressRecent(r)} onLongPress={p.onRemoveRecent ? () => p.onRemoveRecent?.(r) : undefined} />)}
            </View>
          </Animated.View>
        )}
        <Animated.View entering={enter(2)}>
          <SectionTitleNew title={copy.search.suggestions} glyph="suggestions" />
          {p.suggestions.map((s) => (
            <PressableScaleNew key={s.id} onPress={() => p.onPressSuggestion(s)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
              <IconDiscNew icon={KIND_ICON[s.kind]} size={36} />
              <TextNew variant="title" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{s.label}</TextNew>
              <AppIconNew name="ul" size={18} color={colorsNew.muted} />
            </PressableScaleNew>
          ))}
        </Animated.View>
        <Animated.View entering={enter(3)}>
          <SectionTitleNew title={copy.search.trending} glyph="trending" />
          {p.trending.map((t) => (
            <PressableScaleNew key={t.id} onPress={() => p.onPressTrending(t)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
              <IconDiscNew icon="trend" size={36} />
              <TextNew variant="title" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{t.label}</TextNew>
              {!!t.deltaLabel && <ChipNew label={t.deltaLabel} />}
            </PressableScaleNew>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}