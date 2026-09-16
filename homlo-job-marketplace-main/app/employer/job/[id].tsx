import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, ScrollView, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  DollarSign,
  Eye,
  MapPin,
  Pause,
  Play,
  Star,
  Trash2,
  UserSearch,
  Users,
} from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import ApplicantCard from "@/components/ApplicantCard";
import JobOptionsMenu from "@/components/JobOptionsMenu";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import {
  buildJobSavePayload,
  editableFieldsFromJob,
  normalizeEmployerJob,
  normalizeJobApplicant,
} from "@/lib/job-management";
import { trpc } from "@/lib/trpc";
import type { ApplicationStatus, EmployerJob } from "@/backend/domain/models";

const applicantFilters = ["All", "New", "Reviewing", "Interview"] as const;
type ApplicantFilter = (typeof applicantFilters)[number];

function displayStatus(status: ApplicationStatus): ApplicantFilter {
  switch (status) {
    case "applied":
      return "New";
    case "reviewed":
      return "Reviewing";
    case "interview":
    case "hired":
      return "Interview";
    default:
      return "All";
  }
}

function jobPay(job: EmployerJob) {
  const interval = job.payType === "hourly" ? "hour" : job.payType === "daily" ? "day" : "project";
  return `${job.payCurrency} ${Number(job.payAmount).toLocaleString()} / ${interval}`;
}

export default function JobManagementDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [filter, setFilter] = useState<ApplicantFilter>("All");

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const saveJob = trpc.homlo.employer.saveJob.useMutation();
  const softDeleteJob = trpc.homlo.employer.softDeleteJob.useMutation();

  const job = useMemo(() => {
    const rawJobs = ((jobsQuery.data as { jobs?: unknown[] } | undefined)?.jobs ?? []).filter(
      (candidate) => candidate && typeof candidate === "object" && "id" in candidate,
    );
    const row = rawJobs.find((candidate) => (candidate as { id?: unknown }).id === id);
    return row ? normalizeEmployerJob(row as never) : null;
  }, [jobsQuery.data, id]);

  const applicationsQuery = trpc.homlo.employer.applications.useQuery(
    { jobId: id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(id && job && user) },
  );
  const applicants = useMemo(() => {
    const rows = (applicationsQuery.data as { applications?: unknown[] } | undefined)?.applications ?? [];
    return rows.map((row) => normalizeJobApplicant(row as never));
  }, [applicationsQuery.data]);

  const visibleApplicants = useMemo(
    () => applicants.filter((applicant) => filter === "All" || displayStatus(applicant.status) === filter),
    [applicants, filter],
  );

  const refetchAfterChange = () => {
    void applicationsQuery.refetch();
    void jobsQuery.refetch();
  };

  function handleBoost() {
    if (!job) return;
    router.push({
      pathname: "/employer/boost/[id]",
      params: {
        id: job.id,
        title: job.title,
        company: user?.name ?? "Your company",
        city: job.locationLabel ?? "Remote",
        salary: jobPay(job),
      },
    } as never);
  }

  function handlePauseOrReopen() {
    if (!job) return;
    const isOpen = job.status === "open";
    const nextStatus = isOpen ? "closed" : "open";
    Alert.alert(
      isOpen ? "Close this job?" : "Reopen this job?",
      isOpen
        ? "The listing will stop accepting new applications."
        : "The listing will become visible to applicants again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOpen ? "Close job" : "Reopen job",
          onPress: () => {
            void saveJob
              .mutateAsync(
                buildJobSavePayload(editableFieldsFromJob(job), {
                  jobId: job.id,
                  imageUrl: job.imageUrl,
                  status: nextStatus,
                }),
              )
              .then(() => {
                haptic.success();
                void jobsQuery.refetch();
              })
              .catch(() => {
                haptic.selection();
                Alert.alert("Couldn't update the job", "Try again in a moment.");
              });
          },
        },
      ],
    );
  }

  function handleDelete() {
    if (!job) return;
    Alert.alert(
      "Delete this job?",
      "This hides the listing. Applicants who already applied will still see your job title on their own history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void softDeleteJob
              .mutateAsync({ jobId: job.id })
              .then(() => {
                haptic.success();
                router.replace("/employer" as never);
              })
              .catch(() => {
                haptic.selection();
                Alert.alert("Couldn't delete the job", "Try again in a moment.");
              });
          },
        },
      ],
    );
  }

  if (jobsQuery.isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator color="#16803C" />
        <Text className="mt-3 text-sm text-muted">Loading job</Text>
      </ScreenContainer>
    );
  }
  if (!user) {
    return <MissingJob onBack={() => router.replace("/login" as never)} text="Sign in to access this protected employer workspace." />;
  }
  if (!job) {
    return <MissingJob onBack={() => router.replace("/employer" as never)} text="This listing is no longer available." />;
  }

  const isOpen = job.status === "open";

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12 }}>
        {/* Top bar */}
        <View className="flex-row items-center justify-between mb-3 px-1">
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={20} color="#17201A" />
          </TouchableOpacity>
          <Text className="text-[15px] font-semibold text-foreground">Job management</Text>
          <JobOptionsMenu
            job={job}
            onJobUpdated={() => void jobsQuery.refetch()}
            onJobDeleted={() => router.replace("/employer" as never)}
          />
        </View>

        {/* Hero image */}
        <View className="rounded-2xl overflow-hidden h-[150px] mb-3 bg-primary">
          {job.imageUrl ? (
            <ImageBackground source={{ uri: job.imageUrl }} className="flex-1" resizeMode="cover">
              <HeroOverlay job={job} isOpen={isOpen} />
            </ImageBackground>
          ) : (
            <View className="flex-1 items-center justify-center">
              <BookOpen size={40} color="#EAF3DE" />
              <HeroOverlay job={job} isOpen={isOpen} />
            </View>
          )}
        </View>

        {/* Stat grid */}
        <View className="flex-row flex-wrap gap-2.5 mb-4">
          <StatTile icon={<MapPin size={18} color="#16803C" />} label="Location" value={job.locationLabel ?? "—"} />
          <StatTile icon={<DollarSign size={18} color="#16803C" />} label="Pay rate" value={jobPay(job)} />
          <StatTile
            icon={<Users size={18} color="#16803C" />}
            label="Roles filled"
            value={`${job.rolesFilled} of ${job.rolesTotal}`}
          />
          <StatTile icon={<Eye size={18} color="#16803C" />} label="Views" value={String(job.viewsCount)} />
        </View>

        {/* Action row */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={handleBoost}
            className="flex-[2] bg-primary rounded-2xl py-3 flex-row items-center justify-center gap-1.5"
          >
            <Star size={16} color="#EAF3DE" />
            <Text className="text-white text-[13px] font-semibold">Boost job</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePauseOrReopen}
            className="flex-1 bg-surface border border-border rounded-2xl py-3 items-center justify-center"
          >
            {isOpen ? <Pause size={16} color="#17201A" /> : <Play size={16} color="#17201A" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            className="flex-1 bg-surface border border-border rounded-2xl py-3 items-center justify-center"
          >
            <Trash2 size={16} color="#A32D2D" />
          </TouchableOpacity>
        </View>

        {/* Applicant filters */}
        {applicants.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-3.5">
            {applicantFilters.map((option) => {
              const active = filter === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setFilter(option)}
                  className={`rounded-full px-3 py-1.5 ${active ? "bg-primary" : "bg-surface border border-border"}`}
                >
                  <Text className={`text-xs font-medium ${active ? "text-white" : "text-muted"}`}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Applications */}
        <View className="border-t border-border pt-3.5">
          <View className="flex-row items-center gap-2 mb-3">
            <Text className="text-[15px] font-semibold text-foreground">Applications</Text>
            <View className="bg-surface border border-border rounded-full px-2 py-0.5">
              <Text className="text-xs text-muted">{applicants.length}</Text>
            </View>
          </View>

          {applicants.length === 0 ? (
            <View className="items-center bg-surface border border-border rounded-2xl py-7 px-4">
              <UserSearch size={26} color="#94A098" />
              <Text className="text-sm font-semibold text-foreground mt-2.5 mb-1">No applications yet</Text>
              <Text className="text-xs text-muted text-center leading-5">
                When people apply, they will appear here.
              </Text>
            </View>
          ) : (
            visibleApplicants.map((applicant) => (
              <ApplicantCard
                key={applicant.id}
                applicant={applicant}
                jobId={job.id}
                onStatusChange={() => refetchAfterChange()}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function HeroOverlay({ job, isOpen }: { job: EmployerJob; isOpen: boolean }) {
  return (
    <View className="flex-1 justify-between">
      {/* scrim: uniform dark wash + a heavier band at the bottom so the title stays readable */}
      <View className="absolute inset-0 bg-black/25" />
      <View className="absolute inset-x-0 bottom-0 h-14 bg-black/45" />

      {/* top row: Live pill (top-left) + Protected listing pill (top-right) */}
      <View className="relative z-10 flex-row items-center justify-between px-2.5 pt-2.5">
        <View className="flex-row items-center gap-1.5 bg-primary rounded-full px-2.5 py-1">
          <View className="w-1.5 h-1.5 rounded-full bg-white" />
          <Text className="text-[11px] font-semibold text-white">{isOpen ? "Live" : "Closed"}</Text>
        </View>
        <View className="bg-black/40 rounded-full px-2.5 py-1">
          <Text className="text-[11px] font-medium text-white/90">Protected listing</Text>
        </View>
      </View>

      {/* title pinned to the bottom */}
      <View className="relative z-10 px-3 pb-3">
        <Text className="text-[16px] font-semibold text-white" numberOfLines={2}>
          {job.title}
        </Text>
      </View>
    </View>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="w-[47%] bg-surface border border-border rounded-2xl px-3 py-2.5 flex-row items-center gap-2">
      {icon}
      <View className="flex-1">
        <Text className="text-[11px] text-muted">{label}</Text>
        <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MissingJob({ onBack, text }: { onBack: () => void; text: string }) {
  return (
    <ScreenContainer className="items-center justify-center p-6">
      <Text className="text-sm font-semibold text-foreground text-center">{text}</Text>
      <TouchableOpacity onPress={onBack} className="mt-4 bg-primary rounded-2xl px-6 py-3">
        <Text className="text-white text-sm font-semibold">Back to listed jobs</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}