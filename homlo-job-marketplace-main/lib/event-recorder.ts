import { 
  JobEventRecorder, 
  impressionViewabilityConfig as importedImpressionViewabilityConfig, 
  makeOnViewableItemsChanged 
} from '@/backend/feed/otter_event_recorder';
import { getFeedClient } from '@/lib/feed-client';
import { AppState } from 'react-native';

// Re-export the impression viewability config
export const impressionViewabilityConfig = importedImpressionViewabilityConfig;

let eventRecorder: JobEventRecorder | null = null;

/**
 * Get or create the singleton event recorder for the app.
 * Call this once during app initialization (e.g., in _layout.tsx).
 */
export function getEventRecorder(): JobEventRecorder {
  if (!eventRecorder) {
    const client = getFeedClient();
    eventRecorder = new JobEventRecorder({
      send: (batch) => client.sendEvents(batch),
      flushEveryMs: 5000,
      sessionIdleMs: 30 * 60 * 1000,
    });

    // Flush on background
    AppState.addEventListener('change', (state) => {
      if (state !== 'active' && eventRecorder) {
        eventRecorder.onBackground();
      }
    });
  }
  return eventRecorder;
}

/**
 * Create the onViewableItemsChanged callback for FlatList.
 * Create ONCE (useRef/useCallback with no deps) for the same reason.
 */
export function makeImpressionHandler(getJobId: (item: any) => string | undefined) {
  const recorder = getEventRecorder();
  return makeOnViewableItemsChanged(recorder, getJobId);
}

/**
 * Record a job view event (when Job Detail opens).
 */
export function recordJobView(jobId: string): void {
  const recorder = getEventRecorder();
  recorder.view(jobId);
}

/**
 * Start dwell timer (when Job Detail gains focus).
 * Returns a stop function to call when leaving the screen.
 */
export function startJobDwell(jobId: string): () => void {
  const recorder = getEventRecorder();
  return recorder.startDwell(jobId);
}

/**
 * Record a job save event (when user saves a job, NOT on unsave).
 */
export function recordJobSave(jobId: string): void {
  const recorder = getEventRecorder();
  recorder.save(jobId);
}

/**
 * Record a job apply event (when application is successfully submitted).
 */
export function recordJobApply(jobId: string): void {
  const recorder = getEventRecorder();
  recorder.apply(jobId);
}

/**
 * Record a job impression (for non-FlatList scenarios, e.g., horizontal ScrollViews).
 * Call when a card has been >=50% visible for >=1s.
 */
export function recordJobImpression(jobId: string): void {
  const recorder = getEventRecorder();
  recorder.impression(jobId);
}

/**
 * Check if we should record events for this context.
 * Returns false when employer views their own listing/dashboard.
 */
export function shouldRecordEvents(userRole?: string | null): boolean {
  // Only record from job-seeker side
  return userRole !== 'employer' && userRole !== 'both';
}