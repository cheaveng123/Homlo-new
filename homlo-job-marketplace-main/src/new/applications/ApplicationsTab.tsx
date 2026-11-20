import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIconNameNew } from "../icons/AppIconNew";
import { ChipNew, EmptyStateNew, FieldNew, SkeletonNew } from "../components/PrimitivesNew";
import { NoApplicationsEmpty } from "./NoApplicationsEmpty";
import { copy } from "./copy";
import { TextNew } from "../components/TextNew";
import { useEnterNew } from "../theme/motionNew";
import { ApplicationCard } from "./ApplicationCard";
import type { ApplicationState } from "./statusMap";
import type { ApplicationVM } from "./useMyApplications";
import { mapBackendStatus } from "./status";
import type { ApplicationListItem } from "./types";
import { appColors } from "./theme";

type FilterId = "all" | ApplicationState;

const FILTERS: { id: FilterId; label: string; icon?: AppIconNameNew }[] = [
  { id: "all", label: "All", icon: "brief" },
  { id: "waiting", label: "Waiting", icon: "clock" },
  { id: "accepted", label: "Accepted", icon: "chk" },
  { id: "declined", label: "Declined", icon: "x" },
];

type Props = {
  applications: ApplicationVM[];
  isLoading: boolean;
  error: string | null;
  showTitle?: boolean;
  signedOut?: boolean;
  onRetry: () => void;
  onPressApplication: (applicationId: string) => void;
  onPressMessage: (applicationId: string) => void;
  onExplore: () => void;
  onSignIn: () => void;
};

export function ApplicationsTab({
  applications,
  isLoading,
  error,
  showTitle = true,
  signedOut = false,
  onRetry,
  onPressApplication,
  onPressMessage,
  onExplore,
  onSignIn,
}: Props) {
  const enter = useEnterNew();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((item) => {
      if (filter !== "all" && item.state !== filter) return false;
      if (!needle) return true;
      return (
        item.job_title.toLowerCase().includes(needle) ||
        (item.employer_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [applications, filter, query]);

  const hasApplications = applications.length > 0;
  const hasFilters = filter !== "all" || query.trim().length > 0;

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.titleRow}>
          <TextNew variant="section" weight="bold">
            My Applications
          </TextNew>
          {hasApplications && (
            <TextNew variant="meta" color={appColors.muted}>
              {applications.length} {applications.length === 1 ? "application" : "applications"}
            </TextNew>
          )}
        </View>
      )}

      {signedOut ? (
        <EmptyStateNew
          icon="user"
          title="Sign in to see your applications"
          actionLabel="Sign in"
          onAction={onSignIn}
        />
      ) : isLoading && !hasApplications ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonNew height={58} radius={8} width={58} />
              <View style={styles.skeletonBody}>
                <SkeletonNew height={14} width="70%" />
                <SkeletonNew height={12} width="45%" />
                <SkeletonNew height={24} radius={12} width={96} />
              </View>
            </View>
          ))}
        </View>
      ) : error && !hasApplications ? (
        <EmptyStateNew
          icon="x"
          tone="clay"
          title={error}
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : (
        <>
          <View style={styles.search}>
            <FieldNew
              accessibilityLabel="Search applications"
              autoCapitalize="none"
              leftIcon="search"
              onChangeText={setQuery}
              placeholder="Search applications"
              returnKeyType="search"
              value={query}
            />
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.filters}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {FILTERS.map((item) => (
              <ChipNew
                key={item.id}
                icon={item.icon}
                label={item.label}
                onPress={() => setFilter(item.id)}
                selected={filter === item.id}
                size="lg"
              />
            ))}
          </ScrollView>

          {visible.length === 0 ? (
            hasApplications || hasFilters ? (
              <EmptyStateNew
                icon="search"
                title="No matching applications"
                actionLabel="Clear filters"
                onAction={() => {
                  setQuery("");
                  setFilter("all");
                }}
              />
            ) : (
              <NoApplicationsEmpty
                title={copy.emptyTitle}
                body={copy.emptyBody}
                actionLabel="Explore jobs"
                onAction={onExplore}
              />
            )
          ) : (
            <View style={styles.list}>
              {visible.map((item, index) => {
                const listItem: ApplicationListItem = {
                  id: item.id,
                  jobTitle: item.job_title,
                  employerName: item.employer_name ?? null,
                  jobImageUri: item.banner_image ?? null,
                  status: mapBackendStatus(item.status),
                  appliedAt: item.created_at,
                };
                return (
                  <Animated.View key={item.id} entering={enter(index)}>
                    <ApplicationCard
                      item={listItem}
                      index={index}
                      onPress={() => onPressApplication(item.id)}
                      onMessage={() => onPressMessage(item.id)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  titleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  search: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  list: {
    paddingTop: 16,
  },
  skeletons: {
    gap: 12,
    padding: 16,
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
});
