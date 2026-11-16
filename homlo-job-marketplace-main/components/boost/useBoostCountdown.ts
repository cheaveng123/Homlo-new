import { useEffect, useMemo, useState } from 'react';

/** "2d 4h", "5h 12m", "18m", "<1m". Returns null when finished. */
export function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '<1m';
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

/** Counts down to endsAt using the SERVER clock (serverNow) so a wrong phone clock can't lie. */
export function useBoostCountdown(endsAt?: string | null, serverNow?: string | null, onExpire?: () => void) {
  const offset = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
  const end = endsAt ? Date.parse(endsAt) : 0;
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    if (!end) return;
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 15_000);
    return () => clearInterval(id);
  }, [end, offset]);

  const remainingMs = end ? end - now : 0;
  const expired = !!end && remainingMs <= 0;
  useEffect(() => { if (expired) onExpire?.(); }, [expired]);

  return { remainingMs, label: formatRemaining(remainingMs), expired };
}
