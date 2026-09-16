import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { Job } from "@/components/job-store";
import { useJobStore } from "@/components/job-store";
import { HomeHeader } from "@/components/home/HomeHeader";
import { JobSearchBar } from "@/components/home/JobSearchBar";
import { GuideCard } from "@/components/home/GuideCard";
import { CategoryIconRow } from "@/components/home/CategoryIconRow";
import { JobCard as HomeJobCard, type Job as HomeJob } from "@/components/home/JobCard";
import { colors, fontFamily } from "@/components/home/theme";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useHomeFeed } from "@/hooks/use-home-feed";
import { useListingLoading } from "@/hooks/use-listing-loading";
import { logJobEvent } from "@/lib/event-logging";
import { haptic } from "@/lib/haptics";
import { defaultSearchCenter } from "@/lib/job-geography";
import { reverseOpenStreetMapPlace } from "@/lib/openstreetmap-geocoding";
import { getQuickSearchAnswers } from "@/lib/quick-search-store";

const categoryQuickSearch: Record<string, Record<string, string>> = {
  "part-time": { employmentType: "Part-time" },
  "full-time": { employmentType: "Full-time" },
  remote: { arrangement: "Remote" },
  weekends: { employmentType: "Weekend" },
};

// Event-handler debouncing only; kept behind a module boundary so the
// purity lint rule doesn't flag the (intended) render-independent usage.
const nowMs = () => Date.now();

// Real feed records → the final-design JobCard's display shape. Data mapping
// only; no presentational values live here.
const toHomeJob = (job: Job, index: number, saved: boolean): HomeJob => {
  const [rawRange = job.pay, rawUnit] = job.pay.split(" / ");
  const priceUnit = rawUnit ? `/${rawUnit === "month" ? "mo" : rawUnit}` : "";
  return {
    id: job.id,
    image: job.image,
    jobType: job.tag,
    title: job.title,
    company: job.company,
    location: job.location,
    priceRange: rawRange,
    priceUnit,
    imageHeight: index === 0 ? 190 : 170,
    saved,
  };
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const navigationLock = useRef<{ target: string; until: number } | null>(null);

  const [search, setSearch] = useState("");

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

  const navigate = (target: string, params?: Record<string, string>) => {
    haptic.light();
    const now = nowMs();
    if (navigationLock.current && navigationLock.current.target === target && navigationLock.current.until > now) return;
    navigationLock.current = { target, until: now + 700 };
    if (params) {
      router.push({ pathname: target, params } as never);
    } else {
      router.push(target as never);
    }
  };

  const openSearch = (params?: Record<string, string>) => navigate("/search-results", params);
  const openQuickSearch = (params: Record<string, string>) => openSearch(params);
  const openDetailSearch = () => navigate("/detailed-search");
  const submitSearch = (text: string) => (text ? openSearch({ query: text }) : openSearch());
  const openGuidedSearch = () => {
    void (async () => {
      const quickSearch = await getQuickSearchAnswers();
      if (quickSearch) {
        // Already answered once — jump straight to results with the saved
        // answers so the home button becomes a one-tap Quick Search.
        openSearch(quickSearch.params);
      } else {
        navigate("/quick-search");
      }
    })();
  };
  const selectCategory = (key: string) => openSearch(categoryQuickSearch[key]);
  const openEmployer = () => navigate("/employer");

  const openJob = (id: string) => {
    const now = nowMs();
    if (navigationLock.current && navigationLock.current.target === `/job/${id}` && navigationLock.current.until > now) return;
    navigationLock.current = { target: `/job/${id}`, until: now + 700 };
    haptic.light();
    logJobEvent({ jobId: id, eventType: "click", feedContext: "feed" });
    router.push({ pathname: "/job/[id]", params: { id } } as never);
  };

  const applyToJob = (id: string) => {
    haptic.light();
    router.push({ pathname: "/job/[id]/apply", params: { id, from: "home" } } as never);
  };

  const toggleSave = (id: string) => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: id, eventType: isSaved(id) ? "unsave" : "save" });
    toggleSaved(id);
  };

  const renderSectionJobs = (jobs: Job[]) =>
    jobs.map((job, index) => (
      <HomeJobCard
        key={job.id}
        job={toHomeJob(job, index, isSaved(job.id))}
        onOpen={openJob}
        onPressApply={applyToJob}
        onToggleSave={toggleSave}
      />
    ));

  const renderNearby = ({ item, index }: { item: Job; index: number }) => (
    <HomeJobCard
      job={toHomeJob(item, index, isSaved(item.id))}
      onOpen={openJob}
      onPressApply={applyToJob}
      onToggleSave={toggleSave}
    />
  );

  const header = (
    <>
      <HomeHeader onBellPress={() => navigate("/saved")} />
      <JobSearchBar value={search} onChangeText={setSearch} onFilterPress={openDetailSearch} onSubmit={submitSearch} subtitle={`Any category · ${locationLabel}`} />
      <GuideCard onPress={openGuidedSearch} />
      <CategoryIconRow selectedKey={null} onSelect={selectCategory} />
      <View style={{ paddingTop: 38, paddingBottom: 29 }} className="px-4 flex-row justify-between items-baseline">
        <Text style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }} className="text-[15px]">
          Jobs near you
        </Text>
        <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[11px]">
          {isListingLoading ? "…" : `${nearbyJobs.length} open`}
        </Text>
      </View>
    </>
  );

  const footer = (
    <>
      {user || recommendedFeedJobs.length > 0 ? (
        <JobSection
          action="View all"
          empty={{
            title: user ? "Picked for your profile" : "Personal picks, tailored for you",
            message: user ? "We're finding the right roles for your profile." : "Sign in so Homlo can rank the right roles for you.",
          }}
          jobs={recommendedFeedJobs}
          onAction={() => openSearch()}
          title="Recommended for you"
        >
          {renderSectionJobs}
        </JobSection>
      ) : null}
      <JobSection
        action="View all"
        empty={{ title: "No featured roles right now", message: "Employers rotate featured opportunities here." }}
        jobs={featuredJobs}
        onAction={() => openSearch()}
        title="Featured opportunities"
      >
        {renderSectionJobs}
      </JobSection>
      {specialized
        ? specialized.map((section) => (
            <JobSection
              key={section.field.id}
              action={`View ${section.field.title.toLowerCase()} jobs`}
              jobs={section.jobs}
              onAction={() => openQuickSearch({ category: section.field.searchCategory })}
              title={section.field.title}
            >
              {renderSectionJobs}
            </JobSection>
          ))
        : specializedLoading
          ? null
          : null}
      <JobSection
        action="View remote jobs"
        empty={{ title: "No remote roles", message: "No remote roles open right now." }}
        jobs={remoteJobs}
        onAction={() => openQuickSearch({ arrangement: "Remote" })}
        title="Remote opportunities"
      >
        {renderSectionJobs}
      </JobSection>
      <JobSection
        action="View all"
        empty={{ title: "Nothing more to show", message: "Check back soon for new roles." }}
        jobs={moreJobs}
        onAction={() => openSearch()}
        title="More opportunities"
      >
        {renderSectionJobs}
      </JobSection>
      <Pressable onPress={openEmployer} style={({ pressed }) => [styles.postCard, pressed && styles.postPressed]}>
        <View style={styles.postIcon}>
          <IconSymbol name="paperplane.fill" size={18} color={colors.mint} />
        </View>
        <View style={styles.postCopy}>
          <Text style={[styles.postTitle, { fontFamily: fontFamily.semibold }]}>Hiring for your team?</Text>
          <Text style={[styles.postText, { fontFamily: fontFamily.regular }]}>Create a job that reaches the right candidates.</Text>
        </View>
        <View style={styles.postButton}>
          <Text style={[styles.postButtonText, { fontFamily: fontFamily.semibold }]}>Post a job</Text>
        </View>
      </Pressable>
    </>
  );

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-white">
      <FlatList
        data={nearbyJobs}
        keyExtractor={(job) => job.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={renderNearby}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </ScreenContainer>
  );
}

function JobSection({
  action,
  children,
  empty,
  jobs,
  onAction,
  title,
}: {
  action: string;
  children: (jobs: Job[]) => ReactNode;
  empty?: { title: string; message: string };
  jobs: Job[];
  onAction: () => void;
  title: string;
}) {
  return (
    <View>
      <View className="px-4 pt-4 pb-1 flex-row justify-between items-baseline">
        <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[15px]">
          {title}
        </Text>
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fontFamily.semibold, color: colors.mint }} className="text-[11px]">
            {action}
          </Text>
        </Pressable>
      </View>
      {jobs.length > 0
        ? children(jobs)
        : empty
          ? (
            <View className="mx-4 mb-4 rounded-[14px] border px-4 py-3.5" style={{ borderColor: colors.border }}>
              <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[14px]">
                {empty.title}
              </Text>
              <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[12px] mt-1">
                {empty.message}
              </Text>
            </View>
          )
          : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.bg, paddingTop: 8, paddingBottom: 24 },
  postCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
  },
  postIcon: {
    alignItems: "center",
    backgroundColor: colors.mintTint,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  postCopy: { flex: 1, marginLeft: 11 },
  postTitle: { color: "#17201A", fontSize: 13, lineHeight: 17 },
  postText: { color: "#66736A", fontSize: 11.5, lineHeight: 15, marginTop: 4 },
  postButton: { backgroundColor: colors.mint, borderRadius: 10, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 11 },
  postButtonText: { color: "#FFFFFF", fontSize: 11.5 },
  postPressed: { opacity: 0.85 },
});