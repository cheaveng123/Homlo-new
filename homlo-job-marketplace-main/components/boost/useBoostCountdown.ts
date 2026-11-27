import { useEffect, useEffectEvent, useState } from 'react';

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
  const end = endsAt ? Date.parse(endsAt) : 0;
  const [now, setNow] = useState(() => (serverNow ? Date.parse(serverNow) : Date.now()));

  useEffect(() => {
    if (!end) return;
    // Server-clock offset, measured when the server time arrives.
    const offset = serverNow ? Date.parse(serverNow) - Date.now() : 0;
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [end, serverNow]);

  const remainingMs = end ? end - now : 0;
  const expired = !!end && remainingMs <= 0;
  // Always calls the latest onExpire without re-running when it changes.
  const fireExpire = useEffectEvent(() => onExpire?.());
  useEffect(() => {
    if (expired) fireExpire();
  }, [expired]);

  return { remainingMs, label: formatRemaining(remainingMs), expired };
}
