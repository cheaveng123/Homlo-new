function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Compact application date: Today, Yesterday, N days ago (2–6), else "12 Oct".
 * Invalid values return an empty string so callers can omit the row entirely.
 */
export function formatAppliedDate(value: string | null | undefined): string {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";

  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return `${then.getDate()} ${then.toLocaleDateString(undefined, { month: "short" })}`;
}

/** Pay label for cards and the detail page, e.g. "$15/hr" or "KHR 40,000/day". */
export function formatPay(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  payType: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return null;

  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
  const prefix = currency === "USD" ? "$" : currency ? `${currency} ` : "";
  const suffix = payType === "hourly" ? "/hr" : payType === "daily" ? "/day" : payType === "fixed" ? " fixed" : "";
  return `${prefix}${formatted}${suffix}`;
}

/** Location plus work arrangement, omitting whichever half is missing. */
export function formatArrangement(
  location: string | null | undefined,
  workArrangement: string | null | undefined,
): string | null {
  const parts = [location?.trim(), workArrangement?.trim()].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}
