/**
 * One list screen for all three of Applications, Jobs posted and Live now.
 *
 * Those three screens differ only in which jobs they include and how they sort
 * them, so they share this component and `EmployerJobCard` rather than each
 * growing their own copy. The route owns the filtering; this owns the chrome,
 * the states and the list.
 *
 * No statistics, charts or summary strips live here by design — the prompt put
 * those on the New applicants screen only, and these three stay clean lists.
 */
import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';

import { ScalePressable } from '@/components/ui/scale-pressable';
import { JobListingSkeleton } from '@/components/job-listing-skeleton';
import { colors, fontFamily } from '@/components/home/theme';
import { EmployerJobCard } from '@/components/employer-job/EmployerJobCard';
import type { EmployerApplication } from '@/hooks/use-employer-applications';
import type { EmployerJob } from '@/backend/domain/models';

export type EmployerJobsListScreenProps = {
  title: string;
  /** One line under the title, e.g. "Sorted by most applicants first". */
  subtitle?: string;
  jobs: EmployerJob[];
  applicationsByJob: Map<string, EmployerApplication[]>;
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  emptyTitle: string;
  emptyBody: string;
};

export function EmployerJobsListScreen({
  title,
  subtitle,
  jobs,
  applicationsByJob,
  isLoading,
  isError,
  refreshing,
  onRefresh,
  onRetry,
  emptyTitle,
  emptyBody,
}: EmployerJobsListScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }: { item: EmployerJob }) => (
      <EmployerJobCard job={item} applications={applicationsByJob.get(item.id) ?? []} />
    ),
    [applicationsByJob],
  );

  // Rows are not a fixed height: the title wraps to one or two lines and the
  // footer only appears once a job has applicants, so `getItemLayout` would be
  // a lie here. The lists are small (one entry per job, unpaginated because no
  // employer read model has a limit).
  const keyExtractor = useCallback((item: EmployerJob) => item.id, []);

  if (isError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title={title} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&rsquo;t load this list</Text>
          <Text style={styles.errorBody}>Check your connection and try again.</Text>
          <ScalePressable
            onPress={onRetry}
            hapticFeedback
            style={styles.retry}
            containerStyle={styles.retryWrap}
            accessibilityRole="button"
            accessibilityLabel="Retry loading"
          >
            <Text style={styles.retryText}>Retry</Text>
          </ScalePressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={isLoading ? [] : jobs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <Header title={title} subtitle={subtitle} onBack={() => router.back()} />
        }
        ListEmptyComponent={
          isLoading ? (
            <JobListingSkeleton count={4} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyBody}>{emptyBody}</Text>
            </View>
          )
        }
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 32,
          // Keeps the last card clear of the home indicator.
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mint}
            colors={[colors.mint]}
          />
        }
      />
    </View>
  );
}

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <ScalePressable
        onPress={onBack}
        hapticFeedback
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <AppIcon name="back" size={20} color={colors.ink} />
      </ScalePressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  // 44x44 minimum touch target.
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.interRegular,
    fontSize: 13,
    color: colors.sub,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  errorTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
  },
  errorBody: {
    marginTop: 6,
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    color: colors.sub,
    textAlign: 'center',
  },
  retryWrap: { marginTop: 18 },
  retry: {
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
  },
  retryText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 15,
    color: colors.white,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
    textAlign: 'center',
  },
});