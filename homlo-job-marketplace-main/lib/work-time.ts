/**
 * Work time for a job listing: which days, and the clock-in / clock-out time.
 * Both parts are optional ("N/A"): null means the employer did not set it.
 *
 * Stored on `jobs` as `work_days text[]` (mon..sun), `clock_in time` and
 * `clock_out time` (migration 20261120150000_job_work_time.sql).
 */

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

const SHORT: Record<WeekDay, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export function isWeekDay(value: unknown): value is WeekDay {
  return typeof value === 'string' && (WEEK_DAYS as readonly string[]).includes(value);
}

/** Keeps known days only, in week order, without duplicates. */
export function normalizeWorkDays(days: readonly unknown[] | null | undefined): WeekDay[] {
  if (!Array.isArray(days)) return [];
  const set = new Set(days.map((d) => (typeof d === 'string' ? d.trim().toLowerCase().slice(0, 3) : d)).filter(isWeekDay));
  return WEEK_DAYS.filter((d) => set.has(d));
}

/** "HH:MM" (24h), or null. Accepts "8:00", "08:00:00" (Postgres time). */
export function normalizeClock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "Mon–Fri", "Sat & Sun", "Every day", "Mon, Wed, Fri". Empty -> null. */
export function formatWorkDays(days: readonly unknown[] | null | undefined): string | null {
  const list = normalizeWorkDays(days);
  if (list.length === 0) return null;
  if (list.length === 7) return 'Every day';
  if (list.length === 2 && list[0] === 'sat' && list[1] === 'sun') return 'Sat & Sun';
  const idx = list.map((d) => WEEK_DAYS.indexOf(d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (consecutive && list.length >= 3) return `${SHORT[list[0]]}–${SHORT[list[list.length - 1]]}`;
  return list.map((d) => SHORT[d]).join(', ');
}

/** "08:30" -> "8:30 AM". */
export function formatClock(value: string | null | undefined): string | null {
  const v = normalizeClock(value);
  if (!v) return null;
  const [h, m] = v.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "8:00 AM – 5:00 PM", null when either side is missing. */
export function formatWorkHours(clockIn: string | null | undefined, clockOut: string | null | undefined): string | null {
  const a = formatClock(clockIn);
  const b = formatClock(clockOut);
  return a && b ? `${a} – ${b}` : null;
}

/** True when clock-out is earlier than clock-in (an overnight shift). */
export function isOvernight(clockIn: string | null | undefined, clockOut: string | null | undefined): boolean {
  const a = normalizeClock(clockIn);
  const b = normalizeClock(clockOut);
  return !!a && !!b && b < a;
}

/** Shift length in hours (overnight wraps), or null. */
export function shiftHours(clockIn: string | null | undefined, clockOut: string | null | undefined): number | null {
  const a = normalizeClock(clockIn);
  const b = normalizeClock(clockOut);
  if (!a || !b) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let diff = toMin(b) - toMin(a);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

/** One line for cards and the job page: "Mon–Fri · 8:00 AM – 5:00 PM". Null when nothing is set. */
export function formatWorkTime(
  days: readonly unknown[] | null | undefined,
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): string | null {
  const parts = [formatWorkDays(days), formatWorkHours(clockIn, clockOut)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
