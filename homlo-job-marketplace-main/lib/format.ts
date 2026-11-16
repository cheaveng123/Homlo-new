export function formatPostedAgo(isoDate: string): string {
  const days = Math.floor(Math.max(0, Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Posted 1 week ago";
  if (weeks < 5) return `Posted ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "Posted 1 month ago" : `Posted ${months} months ago`;
}

export function formatSpots(spotsRemaining: number): string {
  return spotsRemaining === 1 ? "1 spot left" : `${spotsRemaining} spots left`;
}

/**
 * Compact relative time for list rows — "2h ago", "3d ago".
 *
 * Deliberately separate from `formatPostedAgo`, which is day-granular and
 * carries a "Posted " prefix suited to job cards. Applicant rows want hour
 * granularity and no prefix, because the row's own label supplies the context.
 */
export function formatRelativeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Date.now() - then);
  const minutes = Math.floor(seconds / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(days / 365)}y ago`;
}