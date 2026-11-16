/**
 * JobStatusPill.tsx
 *
 * Small status pill for the EXISTING Job Detail screen. Place it above
 * the job title, in the existing header area — do not restructure the
 * layout around it.
 *
 * Usage:
 *
 *   <JobStatusPill status={job.status} positionsAvailable={job.positionsAvailable} />
 *   <Text style={styles.title}>{job.title}</Text>
 *
 * `status` should come from whatever the existing job status field is
 * called (e.g. job.status). Map your actual "open"/"filled" values onto
 * the `JobStatus` union below, or widen the union to match the real enum.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = {
  accent: '#0F6E56',
  accentSoft: '#E7F1EE',
  neutralBg: '#EFEFEE',
  neutralText: '#4B534F',
};

export type JobStatus = 'open' | 'filled';

export interface JobStatusPillProps {
  status: JobStatus;
  /** Only used when status === 'open', to render "N positions available". */
  positionsAvailable?: number;
}

export function JobStatusPill({ status, positionsAvailable }: JobStatusPillProps) {
  const isOpen = status === 'open';

  return (
    <View style={[styles.pill, isOpen ? styles.pillOpen : styles.pillFilled]}>
      <View style={[styles.dot, { backgroundColor: isOpen ? COLORS.accent : COLORS.neutralText }]} />
      <Text style={[styles.text, { color: isOpen ? COLORS.accent : COLORS.neutralText }]}>
        {isOpen ? 'OPEN' : 'FILLED'}
      </Text>
      {isOpen && typeof positionsAvailable === 'number' && (
        <Text style={styles.subText}>
          {'  \u2022  '}
          {positionsAvailable} {positionsAvailable === 1 ? 'position' : 'positions'} available
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 6,
  },
  pillOpen: { backgroundColor: COLORS.accentSoft },
  pillFilled: { backgroundColor: COLORS.neutralBg },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  subText: { fontSize: 12, color: COLORS.neutralText },
});

/**
 * If the existing Job Detail layout shows the "2 positions available" /
 * "All positions have been filled" line as separate body text rather than
 * inline in the pill (per the original spec), use this instead of the
 * `subText` above and drop the inline version:
 */
export function JobStatusLine({ status, positionsAvailable }: JobStatusPillProps) {
  const isOpen = status === 'open';
  return (
    <Text style={lineStyles.text}>
      {isOpen
        ? `${positionsAvailable ?? ''} position${positionsAvailable === 1 ? '' : 's'} available`
        : 'All positions have been filled'}
    </Text>
  );
}

const lineStyles = StyleSheet.create({
  text: {
    fontSize: 12.5,
    color: COLORS.neutralText,
    marginTop: 6,
  },
});
