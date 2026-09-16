/**
 * Two-step handoff between the Edit job screen and its picker routes
 * (`/employer/job/[id]/edit/category` and `/employer/job/[id]/edit/location`).
 *
 * Routes in Expo Router cannot return a result value to the screen that pushed
 * them, so the pickers write their selection here and the edit screen re-applies
 * it via `useFocusEffect` when the user navigates back. Every write keys the
 * draft to the job id and the edit screen clears it after applying.
 *
 * Category is a session-only selection: the `categories` lookup table is not
 * seeded, so the post-job wizard always saves `categoryId: null`. The picker
 * therefore only drives the on-screen value; it is never persisted.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const JOB_EDIT_DRAFT_KEY = "homlo-employer-job-edit-draft";

export type JobEditDraft = {
  jobId: string;
  category: string | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
};

const EMPTY_DRAFT: JobEditDraft = {
  jobId: "",
  category: null,
  locationLabel: "",
  latitude: null,
  longitude: null,
};

async function readRaw(): Promise<JobEditDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(JOB_EDIT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JobEditDraft>;
    if (!parsed || typeof parsed.jobId !== "string" || !parsed.jobId) return null;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return null;
  }
}

/** Returns the draft for this job, or null when absent / stale. */
export async function readJobEditDraft(jobId: string): Promise<JobEditDraft | null> {
  const draft = await readRaw();
  return draft?.jobId === jobId ? draft : null;
}

/** Overwrites part of the edit draft for a job and returns the merged draft. */
export async function writeJobEditDraft(
  jobId: string,
  patch: Partial<Omit<JobEditDraft, "jobId">>,
): Promise<JobEditDraft> {
  const current = await readRaw();
  const next = { ...EMPTY_DRAFT, ...(current ?? {}), ...patch, jobId };
  await AsyncStorage.setItem(JOB_EDIT_DRAFT_KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

/** Clears the draft. When a jobId is given, only clears it if it matches. */
export async function clearJobEditDraft(jobId?: string): Promise<void> {
  const draft = await readRaw();
  if (jobId && draft?.jobId !== jobId) return;
  await AsyncStorage.removeItem(JOB_EDIT_DRAFT_KEY).catch(() => undefined);
}