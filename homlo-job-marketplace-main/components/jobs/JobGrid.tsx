import React from 'react';
import { StyleSheet, View } from 'react-native';
import { JobCard } from './JobCard';
import { jobCardTokens as t } from './jobCardTokens';
import type { JobCardData } from './jobCardTypes';
import type { View as RNView } from 'react-native';

interface Props {
  jobs: JobCardData[];
  savedIds?: ReadonlySet<string>;
  hideSave?: boolean;
  onPress?: (job: JobCardData, imageRef: React.RefObject<RNView | null>) => void;
  onToggleSave?: (job: JobCardData) => void;
}

// Plain (non-virtualized) 2-column grid for use INSIDE an existing ScrollView or
// FlatList header/footer, such as the home "Explore" section. Nesting a vertical
// FlatList inside a ScrollView triggers a VirtualizedList warning, so use this
// instead. For a full-screen, long list, use a FlatList with numColumns={2},
// columnWrapperStyle={{ gap: 12 }} and <JobCard variant="grid" />.
export function JobGrid({ jobs, savedIds, hideSave, onPress, onToggleSave }: Props) {
  const rows: JobCardData[][] = [];
  for (let i = 0; i < jobs.length; i += 2) rows.push(jobs.slice(i, i + 2));

  return (
    <View style={styles.wrap}>
      {rows.map((pair) => (
        <View key={pair[0].id} style={styles.row}>
          {pair.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              variant="grid"
              saved={savedIds?.has(job.id)}
              hideSave={hideSave}
              onPress={onPress}
              onToggleSave={onToggleSave}
            />
          ))}
          {pair.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: t.layout.gutter, gap: t.layout.gridRowGap },
  row: { flexDirection: 'row', gap: t.layout.gridGap },
  spacer: { flex: 1 },
});
