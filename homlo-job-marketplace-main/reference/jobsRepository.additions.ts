/**
 * jobsRepository.additions.ts
 *
 * Two functions to add to the EXISTING jobs repository (the
 * database-agnostic layer already described for Homlo Jobs), not a new
 * repository file. Drop these into the same module as the other job
 * read/write functions so the Supabase client stays isolated there.
 *
 * The actual auto-close DECISION (checking hired-count vs positions,
 * flipping the job to "filled", firing notifications) happens in the
 * database via a trigger — see 001_auto_close_and_notifications.sql.
 * That keeps it atomic and correct even if two applications are accepted
 * at nearly the same time. The app only needs to read/write the toggle
 * itself and read the resulting status.
 */

import { supabase } from '../supabaseClient'; // adjust import to actual client path

export async function updateAutoCloseSetting(
  jobId: string,
  autoCloseEnabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ auto_close_enabled: autoCloseEnabled })
    .eq('id', jobId);

  if (error) throw error;
}

/**
 * Minimal shape needed by AutoCloseSetting / JobStatusPill. Merge with
 * whatever the existing `getJob` / `useJob` already returns rather than
 * making a second fetch.
 */
export interface JobStatusFields {
  status: 'open' | 'filled';
  positionsAvailable: number;
  autoCloseEnabled: boolean;
}

export function mapJobStatusFields(row: {
  status: string;
  positions_available: number;
  auto_close_enabled: boolean;
}): JobStatusFields {
  return {
    // if the existing schema already has more statuses (draft, review, closed),
    // treat anything that isn't the open-equivalent as "filled" for display
    // purposes only, or extend JobStatusPill's union to match exactly.
    status: row.status === 'open' ? 'open' : 'filled',
    positionsAvailable: row.positions_available,
    autoCloseEnabled: row.auto_close_enabled,
  };
}
