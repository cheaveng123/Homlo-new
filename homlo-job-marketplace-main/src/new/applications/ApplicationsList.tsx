import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeOut, interpolate, interpolateColor, LinearTransition,
  useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { ApplicationCard } from './ApplicationCard';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { StateMessage } from './StateMessage';
import { copy } from './copy';
import { statusLabel } from './status';
import { colors, fonts, radii, SIDE_MARGIN } from './theme';
import type { ApplicationListItem, ApplicationStatus } from './types';

type Filter = 'all' | ApplicationStatus;
const FILTERS: Filter[] = ['all', 'waiting', 'accepted', 'declined'];

function Chip({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
  const p = useSharedValue(selected ? 1 : 0);
  useEffect(() => { p.value = withTiming(selected ? 1 : 0, { duration: 180 }); }, [selected, p]);
  const a = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.card, colors.tint]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.border, colors.teal]),
    borderWidth: interpolate(p.value, [0, 1], [1, 1.6]),
  }));
  const countStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.page, colors.white]),
  }));
  return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, a as unknown as ViewStyle]}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, { color: selected ? colors.deep : colors.muted }]}>{label}</Text>
      <Animated.View style={[styles.count, countStyle]}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.countText, { color: selected ? colors.teal : colors.muted }]}>{count}</Text>
      </Animated.View>
    </PressableScale>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skCard}>
      <View style={styles.skTop}>
        <Skeleton style={{ width: 56, height: 56 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton style={{ height: 16, width: '80%' }} />
          <Skeleton style={{ height: 12, width: '50%' }} />
        </View>
      </View>
      <View style={styles.skBottom}>
        <Skeleton style={{ height: 28, width: 96, borderRadius: radii.badge }} />
        <Skeleton style={{ height: 14, width: 64 }} />
      </View>
    </View>
  );
}

export type ApplicationsListProps = {
  applications: ApplicationListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpen: (applicationId: string) => void;
  onMessage: (item: ApplicationListItem) => void;
};

// Everything under the three Inbox tabs. Plain .map() in a View: no nested FlatList.
export function ApplicationsList({ applications, isLoading, isError, onRetry, onOpen, onMessage }: ApplicationsListProps) {
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => ({
    all: applications.length,
    waiting: applications.filter((a) => a.status === 'waiting').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    declined: applications.filter((a) => a.status === 'declined').length,
  }), [applications]);
  const visible = useMemo(
    () => (filter === 'all' ? applications : applications.filter((a) => a.status === filter)),
    [applications, filter],
  );

  if (isLoading) {
    return <View style={[styles.list, { paddingTop: 16 }]}>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>;
  }
  if (isError) {
    return <StateMessage icon="alert" title={copy.errorTitle} body={copy.errorBody} actionLabel={copy.tryAgain} onAction={onRetry} />;
  }
  if (applications.length === 0) {
    return <StateMessage icon="inbox" title={copy.emptyTitle} body={copy.emptyBody} />;
  }

  return (
    <View>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(300)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f === 'all' ? copy.filterAll : statusLabel(f)} count={counts[f]} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </Animated.View>
      <View style={styles.list}>
        {visible.length === 0 ? (
          <StateMessage icon="inbox" title={copy.emptyFilterTitle} body={copy.emptyFilterBody} />
        ) : (
          visible.map((a, i) => (
            <Animated.View
              key={a.id}
              entering={reduced ? undefined : FadeInDown.delay(Math.min(i, 8) * 75).duration(420)}
              exiting={reduced ? undefined : FadeOut.duration(150)}
              layout={reduced ? undefined : LinearTransition.duration(250)}
              style={styles.item}
            >
              <ApplicationCard item={a} index={i} onPress={() => onOpen(a.id)} onMessage={() => onMessage(a)} />
            </Animated.View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: SIDE_MARGIN, paddingTop: 12, paddingBottom: 12 },
  chip: { height: 36, borderRadius: radii.chip, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  list: { paddingHorizontal: SIDE_MARGIN, paddingTop: 4 },
  item: { marginBottom: 12 },
  skCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.tile, padding: 12, marginBottom: 12 },
  skTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});