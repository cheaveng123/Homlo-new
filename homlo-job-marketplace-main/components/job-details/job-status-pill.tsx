/**
 * Small status pill for the Job Detail screens. Place it above the job title
 * in the existing header area — do not restructure the layout around it.
 *
 * Usage:
 *
 *   <JobStatusPill status={job.jobStatus} positionsAvailable={job.positionsAvailable} />
 *   <Text style={styles.title}>{job.title}</Text>
 *
 * `status` comes from the existing job-detail data chain (the same
 * usePublishedJobs feed that already supplies the title/description), so no
 * second fetch is needed. Curated/mock jobs without a status default to OPEN.
 */

import { View, Text, StyleSheet } from "react-native";
import { colors } from "./colors";

export type JobStatus = "open" | "filled" | "closed" | "expired" | "cancelled" | "draft";

const STATUS_LABEL: Record<JobStatus, string> = {
  open: "OPEN",
  filled: "FILLED",
  closed: "CLOSED",
  expired: "EXPIRED",
  cancelled: "CANCELLED",
  draft: "DRAFT",
};

export interface JobStatusPillProps {
  status: JobStatus;
  /** Only used when status === 'open', to render "N positions available". */
  positionsAvailable?: number;
}

export function JobStatusPill({ status, positionsAvailable }: JobStatusPillProps) {
  const isOpen = status === "open";

  return (
    <View style={[styles.pill, isOpen ? styles.pillOpen : styles.pillFilled]}>
      <View style={[styles.dot, { backgroundColor: isOpen ? colors.mintDeep : colors.muted }]} />
      <Text style={[styles.text, { color: isOpen ? colors.mintDeep : colors.muted }]}>
        {STATUS_LABEL[status]}
      </Text>
      {isOpen && typeof positionsAvailable === "number" && (
        <Text style={styles.subText}>
          {"  \u2022  "}
          {positionsAvailable} {positionsAvailable === 1 ? "position" : "positions"} available
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 6,
  },
  pillOpen: { backgroundColor: colors.mintTint },
  pillFilled: { backgroundColor: colors.placeholderBg },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  subText: { fontSize: 12, color: colors.muted },
});