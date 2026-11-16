import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoundButtonNew } from "../components/PrimitivesNew";
import { TextNew } from "../components/TextNew";
import { ApplicationsTab } from "./ApplicationsTab";
import { openApplication, openApplicationChat, openExplore, openLogin } from "./routes";
import { useMyApplications } from "./useMyApplications";
import { appColors } from "./theme";

export function ApplicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authLoading, applications, isLoading, isRefreshing, error, refetch } =
    useMyApplications();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <RoundButtonNew
          accessibilityLabel="Go back"
          icon="back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}
          size={44}
        />
        <TextNew variant="header" weight="bold">
          My Applications
        </TextNew>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[appColors.primary]}
            enabled={Boolean(user)}
            onRefresh={() => void refetch()}
            refreshing={isRefreshing}
            tintColor={appColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ApplicationsTab
          applications={applications}
          error={error}
          isLoading={authLoading || isLoading}
          onExplore={() => openExplore(router)}
          onPressApplication={(id) => openApplication(router, id)}
          onPressMessage={(id) => openApplicationChat(router, id)}
          onRetry={() => void refetch()}
          onSignIn={() => openLogin(router)}
          showTitle={false}
          signedOut={!authLoading && !user}
        />
      </ScrollView>
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
  content: {
    paddingTop: 8,
  },
});
