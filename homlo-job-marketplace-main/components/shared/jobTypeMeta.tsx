import React from "react";

import { AppIcon, type IconName } from "@/components/ui/AppIcon";

import type { JobType, JobCategoryFilter } from "@/types/employer";

interface JobTypeMetaEntry {
  label: string;
  icon: IconName;
}

export const JOB_TYPE_META: Record<JobCategoryFilter, JobTypeMetaEntry> = {
  all: { label: "All", icon: "grid" },
  full_time: { label: "Full-time", icon: "brief" },
  part_time: { label: "Part-time", icon: "clock" },
  weekends: { label: "Weekends", icon: "calendar" },
  remote: { label: "Remote", icon: "home" },
};

/** Fixed tab order for the category bar — exactly 5 tabs, no more, no fewer. */
export const JOB_CATEGORY_TABS: JobCategoryFilter[] = ["all", "full_time", "part_time", "weekends", "remote"];

export function JobTypeIcon({
  type,
  size = 16,
  color,
}: {
  type: JobType;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const { icon } = JOB_TYPE_META[type];
  return <AppIcon name={icon} size={size} color={color} />;
}
