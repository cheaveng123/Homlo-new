import React from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "@/lib/router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { AppIconNew } from "../icons/AppIconNew";
import { ButtonNew, EmptyStateNew, IconDiscNew, RoundButtonNew } from "../components/PrimitivesNew";
import { TextNew } from "../components/TextNew";
import { useEnterNew } from "../theme/motionNew";
import { StatusBadge } from "./StatusBadge";
import { useApplication, type ApplicationVM } from "./useMyApplications";
import { openApplicationChat, openApplications, openExplore, openJob, openLogin } from "./routes";
import { SectionCard, SectionLabel, applicationUiStyles } from "./ui";
import { appColors } from "./theme";

const PANEL_COPY: Record<
  ApplicationVM["state"],
  { title: string; body: string; icon: "clock" | "chk" | "x"; tone: "sunrise" | "lagoon" | "clay" }
> = {
  waiting: {
    title: "Waiting for the employer",
    body: "Your application is with the employer. We'll let you know when there's an update.",
    icon: "clock",
    tone: "sunrise",
  },
  accepted: {
    title: "Your application was accepted",
    body: "Message the employer to confirm the details and next steps.",
    icon: "chk",
    tone: "lagoon",
  },
  declined: {
    title: "This application wasn't successful",
    body: "This role didn't work out this time. Keep exploring other jobs.",
    icon: "x",
    tone: "clay",
  },
};

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const { user, authLoading, application, isLoading, isRefreshing, error, refetch } =
    useApplication(applicationId);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else openApplications(router);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <RoundButtonNew accessibilityLabel="Go back" icon="back" onPress={goBack} size={44} />
      <TextNew variant="header" weight="bold">
        Application
      </TextNew>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!authLoading && !user) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyStateNew
          icon="user"
          title="Sign in to view this application"
          actionLabel="Sign in"
          onAction={() => openLogin(router)}
        />
      </View>
    );
  }

  if (isLoading && !application) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={appColors.primary} />
        </View>
      </View>
    );
  }

  if (error && !application) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyStateNew
          icon="x"
          tone="clay"
          title={error}
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyStateNew
          icon="brief"
          title="Application not found"
          actionLabel="Back to applications"
          onAction={goBack}
        />
      </View>
    );
  }

  const employer = application.employer_name?.trim() || null;
  const fallbackLetter = (employer ?? application.job_title).charAt(0).toUpperCase();
  const panel = PANEL_COPY[application.state];
  const isDeclined = application.state === "declined";

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        refreshControl={
          <RefreshControl
            colors={[appColors.primary]}
            onRefresh={() => void refetch()}
            refreshing={isRefreshing}
            tintColor={appColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(0)} style={styles.statusRow}>
          <StatusBadge status={application.state} />
          {!!application.appliedLabel && (
            <TextNew variant="meta" color={appColors.muted}>
              Applied {application.appliedLabel}
            </TextNew>
          )}
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SectionCard style={styles.jobCard}>
            <View style={styles.jobRow}>
              <View style={styles.jobImageWrap}>
                {application.banner_image ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: application.banner_image }}
                    style={styles.jobImage}
                  />
                ) : (
                  <TextNew variant="hero" weight="bold" color={appColors.fallbackInk}>
                    {fallbackLetter}
                  </TextNew>
                )}
              </View>
              <View style={styles.jobBody}>
                <TextNew variant="section" weight="bold" numberOfLines={2}>
                  {application.job_title}
                </TextNew>
                {!!employer && (
                  <TextNew variant="meta" color={appColors.muted} numberOfLines={1} style={styles.jobMeta}>
                    {employer}
                  </TextNew>
                )}
                {!!application.arrangementLabel && (
                  <View style={styles.metaRow}>
                    <AppIconNew color={appColors.muted} name="pin" size={14} />
                    <TextNew variant="caption" color={appColors.muted} numberOfLines={1}>
                      {application.arrangementLabel}
                    </TextNew>
                  </View>
                )}
                {!!application.payLabel && (
                  <View style={styles.metaRow}>
                    <AppIconNew color={appColors.muted} name="mon" size={14} />
                    <TextNew variant="caption" weight="semibold" color={appColors.ink}>
                      {application.payLabel}
                    </TextNew>
                  </View>
                )}
              </View>
            </View>
            <View style={applicationUiStyles.divider} />
            <View style={styles.jobAction}>
              <ButtonNew
                accessibilityLabel={`View job ${application.job_title}`}
                label="View job"
                onPress={() => openJob(router, application.job_id)}
                rightIcon="chev"
                variant="tint"
              />
            </View>
          </SectionCard>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SectionLabel>Your application</SectionLabel>
          <SectionCard style={styles.messageCard}>
            <TextNew variant="caption" weight="semibold" color={appColors.muted}>
              Message
            </TextNew>
            <TextNew variant="body" style={styles.messageText}>
              {application.message?.trim() || "No message added."}
            </TextNew>
          </SectionCard>
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <SectionLabel>Status</SectionLabel>
          <SectionCard style={styles.panel}>
            <IconDiscNew icon={panel.icon} tone={panel.tone} />
            <View style={styles.panelBody}>
              <TextNew variant="title" weight="semibold">
                {panel.title}
              </TextNew>
              <TextNew variant="meta" color={appColors.muted} style={styles.panelText}>
                {panel.body}
              </TextNew>
            </View>
          </SectionCard>
        </Animated.View>

        <TextNew variant="caption" color={appColors.subtle} style={styles.note}>
          Homlo will update this application when the employer changes its status.
        </TextNew>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {isDeclined ? (
          <ButtonNew label="Find similar jobs" onPress={() => openExplore(router)} />
        ) : (
          <ButtonNew
            accessibilityLabel={employer ? `Message ${employer}` : "Message employer"}
            label="Message employer"
            onPress={() => openApplicationChat(router, application.id)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: appColors.bg,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingTop: 8,
  },
  jobCard: {
    padding: 16,
  },
  jobRow: {
    flexDirection: "row",
    gap: 12,
  },
  jobImageWrap: {
    alignItems: "center",
    backgroundColor: appColors.fallbackBg,
    borderRadius: 10,
    height: 64,
    justifyContent: "center",
    overflow: "hidden",
    width: 64,
  },
  jobImage: {
    height: "100%",
    width: "100%",
  },
  jobBody: {
    flex: 1,
    minWidth: 0,
  },
  jobMeta: {
    marginTop: 4,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  jobAction: {
    paddingTop: 12,
  },
  messageCard: {
    padding: 16,
  },
  messageText: {
    marginTop: 6,
  },
  panel: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  panelBody: {
    flex: 1,
    minWidth: 0,
  },
  panelText: {
    marginTop: 4,
  },
  note: {
    lineHeight: 18,
    marginTop: 20,
    textAlign: "center",
  },
  bottomBar: {
    backgroundColor: appColors.surface,
    borderTopColor: appColors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
});
