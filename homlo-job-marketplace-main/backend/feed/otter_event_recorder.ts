/**
 * otter_event_recorder.ts
 * Client-side, anonymous behavior logging for the feed. Plain TypeScript: no Expo, no react-native import.
 *
 * What it records (and only this): impression / view / dwell_15s / save / apply, each tied to a random
 * session id that rotates after 30 min of inactivity. No user id, no profile, no device id, no location.
 *
 * RULES FOR WHERE TO CALL IT (important for data quality):
 *  - Call ONLY from the job-seeker side. Never log when an employer views their own listing or dashboard.
 *  - impression: when a card has been >=50% visible for >=1s (see impressionViewabilityConfig).
 *  - view: once when Job Detail opens.  dwell: startDwell() on Job Detail focus, call the returned stop() on blur.
 *  - save: when the user saves a job (not on unsave).  apply: when the application is successfully submitted.
 */
import type { EventInput, EventType } from './finch_shared_shapes';

export interface EventBatch {
  sessionId: string;
  events: EventInput[];
}

export interface RecorderOptions {
  /** Sends one batch. Must reject/throw on failure so the batch is retried. */
  send: (batch: EventBatch) => Promise<void>;
  flushEveryMs?: number;
  maxBatch?: number;
  maxQueue?: number;
  sessionIdleMs?: number;
  dwellMs?: number;
  now?: () => number;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class JobEventRecorder {
  private queue: EventInput[] = [];
  private seen = new Set<string>();
  private sessionId: string;
  private lastActivity: number;
  private flushHandle: unknown = null;
  private flushing = false;
  private disposed = false;

  private readonly send: RecorderOptions['send'];
  private readonly flushEveryMs: number;
  private readonly maxBatch: number;
  private readonly maxQueue: number;
  private readonly sessionIdleMs: number;
  private readonly dwellMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;

  constructor(opts: RecorderOptions) {
    this.send = opts.send;
    this.flushEveryMs = opts.flushEveryMs ?? 5000;
    this.maxBatch = Math.min(opts.maxBatch ?? 50, 100); // the server rejects batches over 100
    this.maxQueue = opts.maxQueue ?? 500;
    this.sessionIdleMs = opts.sessionIdleMs ?? 30 * 60 * 1000;
    this.dwellMs = opts.dwellMs ?? 15000;
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.lastActivity = this.now();
    this.sessionId = this.newSessionId();
  }

  impression(jobId: string): void {
    this.record(jobId, 'impression', true);
  }
  view(jobId: string): void {
    this.record(jobId, 'view', true);
  }
  save(jobId: string): void {
    this.record(jobId, 'save', false);
  }
  apply(jobId: string): void {
    this.record(jobId, 'apply', false);
  }

  /** Starts a dwell timer. Call the returned function when the user leaves the screen. */
  startDwell(jobId: string): () => void {
    if (this.disposed) return () => {};
    let done = false;
    const handle = this.setTimer(() => {
      if (!done) {
        done = true;
        this.record(jobId, 'dwell_15s', true);
      }
    }, this.dwellMs);
    return () => {
      if (!done) {
        done = true;
        this.clearTimer(handle);
      }
    };
  }

  /** Hook this to your app's background event (react-native: AppState 'change' to 'background'). */
  onBackground(): void {
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    this.cancelTimer();
    const batch = this.queue.splice(0, this.maxBatch);
    try {
      await this.send({ sessionId: this.sessionId, events: batch });
    } catch {
      // Put the batch back at the front and try again later. Oldest events are dropped if the queue overflows.
      this.queue = [...batch, ...this.queue].slice(-this.maxQueue);
    } finally {
      this.flushing = false;
    }
    if (this.queue.length > 0 && !this.disposed) this.scheduleFlush();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  /** For tests / debugging. */
  get pending(): number {
    return this.queue.length;
  }
  get currentSessionId(): string {
    return this.sessionId;
  }

  // ---------- internals ----------

  private record(jobId: string, type: EventType, dedupe: boolean): void {
    if (this.disposed || !jobId) return;
    this.rotateSessionIfIdle();
    if (dedupe) {
      const key = `${type}:${jobId}`;
      if (this.seen.has(key)) return;
      this.seen.add(key);
    }
    this.queue.push({ jobId, type });
    if (this.queue.length > this.maxQueue) this.queue.splice(0, this.queue.length - this.maxQueue);
    if (this.queue.length >= this.maxBatch) void this.flush();
    else this.scheduleFlush();
  }

  private rotateSessionIfIdle(): void {
    const t = this.now();
    if (t - this.lastActivity > this.sessionIdleMs) {
      this.sessionId = this.newSessionId();
      this.seen.clear();
    }
    this.lastActivity = t;
  }

  private newSessionId(): string {
    const rand = () => Math.floor(this.random() * 36 ** 6).toString(36).padStart(6, '0');
    return `s${this.now().toString(36)}${rand()}${rand()}`;
  }

  private scheduleFlush(): void {
    if (this.flushHandle !== null || this.disposed) return;
    this.flushHandle = this.setTimer(() => {
      this.flushHandle = null;
      void this.flush();
    }, this.flushEveryMs);
  }

  private cancelTimer(): void {
    if (this.flushHandle !== null) {
      this.clearTimer(this.flushHandle);
      this.flushHandle = null;
    }
  }
}

/** Pass to FlatList's `viewabilityConfig`. Define it ONCE (module level); FlatList breaks if it changes between renders. */
export const impressionViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 1000,
} as const;

/**
 * Build the callback for FlatList's `onViewableItemsChanged`. Create it ONCE (useRef/useCallback with no deps),
 * for the same reason as above.
 */
export function makeOnViewableItemsChanged<T>(recorder: JobEventRecorder, getJobId: (item: T) => string | undefined) {
  return (info: { viewableItems: Array<{ item?: T; isViewable?: boolean }> }): void => {
    for (const v of info.viewableItems) {
      if (v.isViewable && v.item !== undefined) {
        const id = getJobId(v.item);
        if (id) recorder.impression(id);
      }
    }
  };
}
