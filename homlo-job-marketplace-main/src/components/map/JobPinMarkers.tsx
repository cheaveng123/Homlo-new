// MapLibre job pins rendered as MarkerViews (real React views), so each pin can
// animate. Every job keeps its own pin at every zoom level (no grouping); the
// selected one is drawn on top.
import React from "react";
import { Pressable } from "react-native";

import { MapLibre } from "../../native-support";
import type { Coordinate } from "../../types";
import { JobMapPin } from "./JobMapPin";

export type MarkerJob = Coordinate & {
  id: string;
  title: string;
  category?: string | null;
  label?: string | null;
};

export type JobPinMarkersProps<T extends MarkerJob> = {
  jobs: T[];
  selectedId: string | null;
  onPinPress: (job: T) => void;
  /** Icon-only pins (zoomed out); the selected job keeps its price. */
  compact?: boolean;
};

export function JobPinMarkers<T extends MarkerJob>({ jobs, selectedId, onPinPress, compact = false }: JobPinMarkersProps<T>) {
  if (!MapLibre) return null;
  const { MarkerView } = MapLibre;

  // Selected last so it renders above overlapping neighbours.
  const ordered = selectedId
    ? [...jobs.filter((j) => j.id !== selectedId), ...jobs.filter((j) => j.id === selectedId)]
    : jobs;

  return (
    <>
      {ordered.map((job, index) => (
        <MarkerView
          key={job.id}
          coordinate={[job.longitude, job.latitude]}
          anchor={{ x: 0.5, y: 1 }}
          allowOverlap
          isSelected={job.id === selectedId}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${job.title}${job.label ? `, ${job.label}` : ""}`}
            hitSlop={6}
            onPress={() => onPinPress(job)}
          >
            <JobMapPin
              category={job.category}
              label={compact && job.id !== selectedId ? null : job.label}
              selected={job.id === selectedId}
              index={index}
            />
          </Pressable>
        </MarkerView>
      ))}
    </>
  );
}
