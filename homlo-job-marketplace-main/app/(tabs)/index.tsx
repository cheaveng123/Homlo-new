import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, FadeInDown, interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import * as Location from "expo-location";

import { type Job } from "@/components/job-store";
import { JobCard } from "@/components/job-card";
import { SectionHeading } from "@/components/section-heading";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { haptic } from "@/lib/haptics";
import { reverseOpenStreetMapPlace } from "@/lib/openstreetmap-geocoding";
import { defaultSearchCenter } from "@/lib/job-geography";
import { useListingLoading } from "@/hooks/use-listing-loading";
import { JobListingSkeleton } from "@/components/job-listing-skeleton";
import { useHomeFeed } from "@/hooks/use-home-feed";

const exploreItems: { label: string; icon: "clock" | "graduationcap.fill" | "calendar" | "mappin" | "bag" | "fork.knife"; params: Record<string, string> }[] = [
  { label: "Part-time", icon: "clock", params: { employmentType: "Part-time" } },
  { label: "Internships", icon: "graduationcap.fill", params: { employmentType: "Internship" } },
  { label: "Weekend", icon: "calendar", params: { employmentType: "Weekend" } },
  { label: "Remote", icon: "mappin", params: { arrangement: "Remote" } },
  { label: "Retail", icon: "bag", params: { category: "Retail" } },
  { label: "Hospitality", icon: "fork.knife", params: { category: "Hospitality" } },
];

const typewriterSuggestions = ["Find a part-time role", "Search jobs near Phnom Penh", "Try remote opportunities", "Search by skill or company"];

const heroHeight = 178;
const currentTime = () => Date.now();

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const [searchTop, setSearchTop] = useState(70);
  const [exploreActionOffset, setExploreActionOffset] = useState(111);

  const [locationState, setLocationState] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [locationLabel, setLocationLabel] = useState("Phnom Penh");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(defaultSearchCenter);

  useEffect(() => {
    let active = true;
    (async () => {
      let status: "granted" | "denied" | "undetermined" = "undetermined";
      try {
        status = (await Location.getForegroundPermissionsAsync()).status;
      } catch {
        status = "undetermined";
      }
      if (status !== "granted") {
        try {
          status = (await Location.requestForegroundPermissionsAsync()).status;
        } catch {
          status = "denied";
        }
        if (status !== "granted") {
          if (active) setLocationState("denied");
          return;
        }
      }
      if (!active) return;
      let position: Location.LocationObject | null = null;
      try {
        position = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      } catch {
        try {
          position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {}
      }
      if (!active) return;
      const lat = position?.coords?.latitude;
      const lng = position?.coords?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && position) {
        setCoordinates({ latitude: lat, longitude: lng });
        setLocationState("granted");
        reverseOpenStreetMapPlace({ latitude: lat, longitude: lng })
          .then((place) => {
            if (active) setLocationLabel(place.city || place.label || "Current location");
          })
          .catch(() => {});
      } else {
        setLocationState("granted");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const {
    nearby: nearbyJobs,
    recommended: recommendedFeedJobs,
    featured: featuredJobs,
    specialized,
    specializedLoading,
    remote: remoteJobs,
    more: moreJobs,
    loading: feedLoading,
  } = useHomeFeed({
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    radiusKm: 50,
  });
  const isListingLoading = useListingLoading() || feedLoading;

  const pinTop = insets.top > 0 ? 16 : 12;
  const morphTrigger = Math.max(0, searchTop + exploreActionOffset - pinTop);
  const morphEnd = morphTrigger + 76;
  const heroWidth = Math.max(280, screenWidth - 40);
  const compactWidth = Math.min(190, screenWidth - 64);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const navLockRef = useRef<{ target: string; until: number } | null>(null);

  const openSearch = (params?: Record<string, string>) => {
    haptic.light();
    const now = Date.now();
    if (navLockRef.current && navLockRef.current.target === "/search-results" && navLockRef.current.until > now) return;
    navLockRef.current = { target: "/search-results", until: now + 700 };
    router.push({ pathname: "/search-results", params } as never);
  };

  const openQuickSearch = (params: Record<string, string>) => {
    haptic.light();
    const now = currentTime();
    if (navLockRef.current && navLockRef.current.target === "/search-results" && navLockRef.current.until > now) return;
    navLockRef.current = { target: "/search-results", until: now + 700 };
    router.push({ pathname: "/search-results", params } as never);
  };

  const openDetailSearch = () => {
    haptic.light();
    const now = Date.now();
    if (navLockRef.current && navLockRef.current.target === "/detailed-search" && navLockRef.current.until > now) return;
    navLockRef.current = { target: "/detailed-search", until: now + 700 };
    router.push("/detailed-search" as never);
  };

  const guardedPush = (target: string) => {
    const now = Date.now();
    if (navLockRef.current && navLockRef.current.target === target && navLockRef.current.until > now) return;
    navLockRef.current = { target, until: now + 700 };
    router.push(target as never);
  };

  const selectCurrentLocation = async () => {
    haptic.light();
    setLocationState("loading");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationState("denied");
      openSearch();
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const place = await reverseOpenStreetMapPlace({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      const label = place.city || place.label || "Current location";
      setLocationLabel(label);
      setCoordinates({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      setLocationState("granted");
      haptic.success();
      openSearch({ location: label });
    } catch {
      setLocationState("denied");
      openSearch();
    }
  };

  const flowHeroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [morphTrigger, morphTrigger + 12], [1, 0], Extrapolation.CLAMP),
  }));

  const pinnedShellStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [morphTrigger - 2, morphTrigger + 6], [0, 1], Extrapolation.CLAMP),
    width: interpolate(scrollY.value, [morphTrigger, morphEnd], [heroWidth, compactWidth], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [morphTrigger, morphEnd], [heroHeight, 50], Extrapolation.CLAMP),
    borderRadius: interpolate(scrollY.value, [morphTrigger, morphEnd], [17, 25], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(scrollY.value, [morphTrigger, morphEnd], ["#FFFFFF", "#16803C"]),
    shadowOpacity: interpolate(scrollY.value, [morphTrigger, morphEnd], [0.05, 0.18], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.value, [morphTrigger, morphEnd], [3, 16], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [morphTrigger, morphEnd], [searchTop - morphTrigger, pinTop], Extrapolation.CLAMP) }],
  }));

  const pinnedHeroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [morphTrigger, morphTrigger + 12], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [morphTrigger, morphTrigger + 12], [0, -4], Extrapolation.CLAMP) }],
  }));

  const compactSearchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [morphTrigger + 4, morphEnd], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [morphTrigger + 4, morphEnd], [0.92, 1], Extrapolation.CLAMP) }],
  }));

  const confirmLogout = () =>
    Alert.alert("Log out of Homlo?", "You can sign back in whenever you are ready.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => void logout() },
    ]);

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <View style={styles.screen}>
        <Animated.ScrollView
          contentContainerStyle={styles.content}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.logo}>Homlo</Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Saved jobs"
                onPress={() => router.push("/saved" as never)}
                style={({ pressed }) => [styles.headerButton, pressed && styles.iconPressed]}
              >
                <IconSymbol name="heart" size={22} color="#16211F" />
              </Pressable>
              <Pressable
                accessibilityLabel="Profile menu"
                onPress={() => setProfileMenuVisible((visible) => !visible)}
                style={({ pressed }) => [styles.profileButton, pressed && styles.iconPressed]}
              >
                <IconSymbol name="person.fill" size={20} color="#0B4E47" />
              </Pressable>
            </View>
            {profileMenuVisible ? (
              <>
                <Pressable accessibilityLabel="Close account menu" onPress={() => setProfileMenuVisible(false)} style={styles.menuBackdrop} />
                <Animated.View entering={FadeInDown.duration(160)} style={styles.profileMenu}>
                  <Pressable
                    onPress={() => {
                      setProfileMenuVisible(false);
                      router.push("/profile" as never);
                    }}
                    style={styles.menuItem}
                  >
                    <IconSymbol name="gearshape" size={18} color="#16803C" />
                    <Text style={styles.menuText}>Settings</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setProfileMenuVisible(false);
                      router.push("/account-plans" as never);
                    }}
                    style={styles.menuItem}
                  >
                    <IconSymbol name="star.fill" size={18} color="#16803C" />
                    <Text style={styles.menuText}>Upgrade Account</Text>
                  </Pressable>
                  <View style={styles.menuDivider} />
                  <Pressable
                    onPress={() => {
                      setProfileMenuVisible(false);
                      confirmLogout();
                    }}
                    style={styles.menuItem}
                  >
                    <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#A53B3B" />
                    <Text style={styles.menuLogoutText}>Log Out</Text>
                  </Pressable>
                </Animated.View>
              </>
            ) : null}
          </View>

          <Animated.View onLayout={(event) => setSearchTop(event.nativeEvent.layout.y)} style={[styles.searchFlow, flowHeroStyle]}>
            <HeroContent
              locationLabel={locationLabel}
              locationState={locationState}
              onOpenSearch={() => openSearch()}
              onOpenQuickSearch={openDetailSearch}
              onLocation={selectCurrentLocation}
            />
          </Animated.View>

          <View style={styles.sectionWrap}>
            <SectionHeading action="See all" onAction={() => openSearch()} title="What are you looking for?" />
            <FlatList
              contentContainerStyle={styles.exploreList}
              data={exploreItems}
              horizontal
              keyExtractor={(item) => item.label}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => openQuickSearch(item.params)}
                  style={({ pressed }) => [styles.exploreCard, pressed && styles.explorePressed]}
                >
                  <IconSymbol name={item.icon} size={24} color="#16803C" />
                  <Text style={styles.exploreLabel}>{item.label}</Text>
                </Pressable>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {isListingLoading ? (
            <View style={styles.loadingSection}>
              <SectionHeading action="View all" onAction={() => openSearch()} title="Jobs near you" />
              <JobListingSkeleton count={4} />
            </View>
          ) : (
            <>
              <JobFeedSection
                action="View all"
                empty={{ message: "There are no open roles within 50 km right now.", title: "No jobs nearby" }}
                jobs={nearbyJobs}
                onAction={() => openSearch()}
                title="Jobs near you"
              />
              {user || recommendedFeedJobs.length > 0 ? (
                <Animated.View entering={FadeInDown.duration(220)}>
                  <JobFeedSection
                    action="View all"
                    empty={{
                      message: user ? "We're finding the right roles for your profile." : "Sign in so Homlo can rank the right roles for you.",
                      title: user ? "Picked for your profile" : "Personal picks, tailored for you",
                    }}
                    jobs={recommendedFeedJobs}
                    onAction={() => openSearch()}
                    title="Recommended for you"
                  />
                </Animated.View>
              ) : null}
              <JobFeedSection
                action="View all"
                empty={{ message: "Employers rotate featured opportunities here.", title: "No featured roles right now" }}
                emphasized
                jobs={featuredJobs}
                onAction={() => openSearch()}
                title="Featured opportunities"
              />
              {specialized
                ? specialized.map((section) => (
                    <JobFeedSection
                      key={section.field.id}
                      action={`View ${section.field.title.toLowerCase()} jobs`}
                      jobs={section.jobs}
                      onAction={() => openQuickSearch({ category: section.field.searchCategory })}
                      title={section.field.title}
                    />
                  ))
                : specializedLoading
                  ? (
                    <View style={styles.loadingSection}>
                      <JobListingSkeleton count={3} />
                    </View>
                  )
                  : null}
              <JobFeedSection
                action="View remote jobs"
                empty={{ message: "No remote roles open right now.", title: "No remote roles" }}
                jobs={remoteJobs}
                onAction={() => openQuickSearch({ arrangement: "Remote" })}
                title="Remote opportunities"
              />
              <JobFeedSection
                action="View all"
                empty={{ message: "Check back soon for new roles.", title: "Nothing more to show" }}
                jobs={moreJobs}
                onAction={() => openSearch()}
                title="More opportunities"
              />
            </>
          )}

          <ScalePressable hapticFeedback onPress={() => guardedPush("/employer")} style={styles.postCard}>
            <View style={styles.rocketCircle}>
              <IconSymbol name="paperplane.fill" size={23} color="#16803C" />
            </View>
            <View style={styles.postCopy}>
              <Text style={styles.postTitle}>Hiring for your team?</Text>
              <Text style={styles.postText}>Create a job that reaches the right candidates.</Text>
            </View>
            <View style={styles.postButton}>
              <Text style={styles.postButtonText}>Post a job</Text>
            </View>
          </ScalePressable>
        </Animated.ScrollView>

        <View pointerEvents="box-none" style={styles.pinnedLayer}>
          <Animated.View pointerEvents="auto" style={[styles.pinnedShell, pinnedShellStyle]}>
            <Animated.View style={[styles.pinnedHero, pinnedHeroStyle]}>
              <HeroContent
                locationLabel={locationLabel}
                locationState={locationState}
                onOpenSearch={() => openSearch()}
                onOpenQuickSearch={openDetailSearch}
                onLocation={selectCurrentLocation}
              />
            </Animated.View>
            <Animated.View style={[styles.compactSearch, compactSearchStyle]}>
              <Pressable accessibilityLabel="Search jobs" onPress={() => openSearch()} style={styles.compactPressable}>
                <IconSymbol name="magnifyingglass" size={20} color="#FFFFFF" />
                <Text style={styles.compactSearchText}>Search jobs</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function HeroContent({
  locationLabel,
  locationState,
  onOpenSearch,
  onOpenQuickSearch,
  onLocation,
}: {
  locationLabel: string;
  locationState: "idle" | "loading" | "granted" | "denied";
  onOpenSearch: () => void;
  onOpenQuickSearch: () => void;
  onLocation: () => void;
}) {
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [typedSuggestion, setTypedSuggestion] = useState("");
  const locationText =
    locationState === "loading"
      ? "Finding your location…"
      : locationState === "denied"
        ? "Select your location"
        : locationState === "granted"
          ? locationLabel
          : "Select current location";

  useEffect(() => {
    const suggestion = typewriterSuggestions[suggestionIndex];
    let character = 0;
    const timer = setInterval(() => {
      character += 1;
      setTypedSuggestion(suggestion.slice(0, character));
      if (character >= suggestion.length) {
        clearInterval(timer);
        setTimeout(() => setSuggestionIndex((current) => (current + 1) % typewriterSuggestions.length), 900);
      }
    }, 56);
    return () => clearInterval(timer);
  }, [suggestionIndex]);

  return (
    <View style={styles.heroSearch}>
      <Pressable accessibilityLabel="What are you looking for?" onPress={onOpenQuickSearch} style={({ pressed }) => [styles.searchRow, pressed && styles.iconPressed]}>
        <View style={styles.searchIconWell}>
          <IconSymbol name="magnifyingglass" size={20} color="#16803C" />
        </View>
        <View style={styles.searchCopy}>
          <Text style={styles.searchLabel}>What are you looking for?</Text>
          <Text style={styles.searchValue}>Find jobs, skills, or companies</Text>
        </View>
        <IconSymbol name="arrow.right" size={16} color="#94A098" />
      </Pressable>
      <View style={styles.divider} />
      <ScalePressable accessibilityLabel="Select current location" hapticFeedback onPress={onLocation} style={styles.locationButton}>
        <IconSymbol name="mappin.and.ellipse" size={18} color="#16803C" />
        <Text numberOfLines={1} style={styles.locationButtonText}>
          {locationText}
        </Text>
        <Text style={styles.locationButtonHint}>{locationState === "granted" ? "Current" : "Select"}</Text>
        <IconSymbol name="chevron.right" size={17} color="#66736A" />
      </ScalePressable>
      <Pressable accessibilityLabel="Search jobs" onPress={onOpenSearch} style={({ pressed }) => [styles.searchButton, pressed && styles.iconPressed]}>
        <View style={styles.searchButtonIcon}>
          <IconSymbol name="magnifyingglass" size={17} color="#16803C" />
        </View>
        <Text numberOfLines={1} style={styles.searchButtonText}>
          {typedSuggestion || typewriterSuggestions[0]}
        </Text>
        <IconSymbol name="arrow.right" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function JobFeedSection({
  action,
  emphasized = false,
  empty,
  jobs: sectionJobs,
  onAction,
  title,
}: {
  action: string;
  emphasized?: boolean;
  empty?: { message: string; title: string };
  jobs: Job[];
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.feedSection}>
      <SectionHeading action={action} onAction={onAction} title={title} />
      {sectionJobs.length > 0
        ? sectionJobs.map((job) => <JobCard emphasized={emphasized} job={job} key={job.id} />)
        : empty
          ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyMessage}>{empty.message}</Text>
            </View>
          )
          : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F8F6", flex: 1, position: "relative" },
  content: { backgroundColor: "#F7F8F6", padding: 20, paddingBottom: 24 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  logo: { color: "#16803C", fontSize: 27, fontWeight: "700", letterSpacing: -1.1 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 6 },
  headerButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  profileButton: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 19, height: 38, justifyContent: "center", width: 38 },
  menuBackdrop: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 8 },
  profileMenu: { backgroundColor: "#FFFFFF", borderColor: "#DCE5DF", borderRadius: 14, borderWidth: 1, elevation: 7, padding: 6, position: "absolute", right: 20, shadowColor: "#173C25", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 12, top: 52, width: 190, zIndex: 9 },
  menuItem: { alignItems: "center", borderRadius: 9, flexDirection: "row", gap: 10, minHeight: 42, paddingHorizontal: 10 },
  menuText: { color: "#17201A", fontSize: 13, fontWeight: "600" },
  menuLogoutText: { color: "#A53B3B", fontSize: 13, fontWeight: "600" },
  menuDivider: { backgroundColor: "#E8EEE9", height: 1, marginHorizontal: 10 },
  iconPressed: { opacity: 0.5, transform: [{ scale: 0.93 }] },

  searchFlow: { alignSelf: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 17, borderWidth: 1, height: heroHeight, marginTop: 14, overflow: "hidden", width: "100%", zIndex: 1 },
  heroSearch: { flex: 1, padding: 12 },
  searchRow: { alignItems: "center", flexDirection: "row", minHeight: 54, paddingHorizontal: 2 },
  searchIconWell: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  searchCopy: { flex: 1, marginLeft: 10 },
  searchLabel: { color: "#17201A", fontSize: 17, fontWeight: "600", letterSpacing: -0.2, lineHeight: 22 },
  searchValue: { color: "#66736A", fontSize: 13, lineHeight: 18, marginTop: 1 },
  divider: { backgroundColor: "#E2E8E5", height: 1, marginHorizontal: 2 },
  locationButton: { alignItems: "center", flexDirection: "row", gap: 7, height: 42, paddingHorizontal: 3 },
  locationButtonText: { color: "#17201A", flex: 1, fontSize: 13, fontWeight: "500" },
  locationButtonHint: { color: "#94A098", fontSize: 11 },
  searchButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 17, flexDirection: "row", gap: 8, justifyContent: "flex-start", marginTop: 9, minHeight: 48, paddingHorizontal: 10 },
  searchButtonIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 30, justifyContent: "center", width: 30 },
  searchButtonText: { color: "#FFFFFF", flex: 1, fontSize: 13.5, fontWeight: "600" },

  sectionWrap: { marginTop: 25 },
  loadingSection: { marginTop: 24, paddingTop: 23 },
  exploreList: { gap: 10, paddingRight: 3 },
  exploreCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 12, borderWidth: 1, height: 86, justifyContent: "center", paddingHorizontal: 11, width: 88 },
  explorePressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  exploreLabel: { color: "#17201A", fontSize: 11, fontWeight: "500", marginTop: 7, textAlign: "center" },

  feedSection: { marginTop: 24, paddingTop: 23 },
  postCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 9, padding: 14 },
  rocketCircle: { alignItems: "center", backgroundColor: "#EDF7EF", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  postCopy: { flex: 1, marginLeft: 11 },
  postTitle: { color: "#17201A", fontSize: 13, fontWeight: "600", lineHeight: 17 },
  postText: { color: "#66736A", fontSize: 11.5, lineHeight: 15, marginTop: 4 },
  postButton: { backgroundColor: "#16803C", borderRadius: 10, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 11 },
  postButtonText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "600" },

  emptyCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E0E8E4", borderRadius: 14, borderWidth: 1, marginBottom: 14, padding: 16 },
  emptyTitle: { color: "#17201A", fontSize: 14, fontWeight: "600" },
  emptyMessage: { color: "#66736A", fontSize: 12, lineHeight: 17, marginTop: 4 },

  pinnedLayer: { alignItems: "center", left: 0, pointerEvents: "box-none", position: "absolute", right: 0, top: 0, zIndex: 300 },
  pinnedShell: { alignSelf: "center", overflow: "hidden", position: "absolute", shadowColor: "#0F5C2B", shadowOffset: { width: 0, height: 5 }, shadowRadius: 14, zIndex: 300 },
  pinnedHero: { flex: 1 },
  compactSearch: { height: 50, left: 0, position: "absolute", right: 0, top: 0 },
  compactPressable: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" },
  compactSearchText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
