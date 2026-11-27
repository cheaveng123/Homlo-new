import { copy } from './copy';
import type { ApplicationStatus, DateInput } from './types';

// ONE place for the status mapping. Never rename backend statuses.
// The mapped state names are accepted too, so already-mapped values pass through.
const WAITING = ['applied', 'reviewed', 'waiting'];
const ACCEPTED = ['interview', 'hired', 'accepted'];
const DECLINED = ['declined', 'withdrawn', 'rejected'];

export function mapBackendStatus(raw: string | null | undefined): ApplicationStatus {
  const s = (raw ?? '').toLowerCase();
  if (ACCEPTED.includes(s)) return 'accepted';
  if (DECLINED.includes(s)) return 'declined';
  if (!WAITING.includes(s) && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn('[applications] Unknown status, showing as Waiting:', s);
  }
  return 'waiting';
}

export function statusLabel(status: ApplicationStatus): string {
  if (status === 'accepted') return copy.statusAccepted;
  if (status === 'declined') return copy.statusDeclined;
  return copy.statusWaiting;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function formatAppliedShort(v: DateInput, now: Date = new Date()): string | null {
  const d = toDate(v);
  if (!d) return null;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return copy.today;
  if (diff === 1) return copy.yesterday;
  if (diff < 7) return copy.daysAgo(diff);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatAppliedLong(v: DateInput): string | null {
  const d = toDate(v);
  if (!d) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}