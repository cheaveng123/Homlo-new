import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { boostColors } from './BoostBadge';
import { ChargingBoltIcon } from './ChargingBoltIcon';
import { useBoostCountdown } from './useBoostCountdown';

export interface OwnerBoostState {
  serverNow: string | null; status: 'active' | 'scheduled' | 'none';
  startsAt: string | null; endsAt: string | null; planKey: string | null; queued: number;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Goes on the employer's job management page. Pass the result of GET /api/boosts/job/:id. */
export function EmployerBoostPanel({ boost, onExpire }: { boost: OwnerBoostState | null; onExpire?: () => void }) {
  const active = boost?.status === 'active';
  const { label, remainingMs, expired } = useBoostCountdown(active ? boost!.endsAt : null, boost?.serverNow, onExpire);
  if (!boost || boost.status === 'none' || (active && expired)) return null;

  if (boost.status === 'scheduled') {
    return (
      <View style={s.card}>
        <View style={s.row}><AppIcon name="clock" size={18} color={boostColors.employerIcon} />
          <Text style={s.title}>Boost scheduled</Text></View>
        <Text style={s.sub}>Starts {fmt(boost.startsAt!)} · ends {fmt(boost.endsAt!)}</Text>
      </View>
    );
  }
  const total = Date.parse(boost.endsAt!) - Date.parse(boost.startsAt!);
  const pct = Math.min(1, Math.max(0, 1 - remainingMs / total));
  return (
    <View style={s.card}>
      <View style={s.row}>
        <ChargingBoltIcon size={20} color={boostColors.employerIcon} />
        <Text style={s.title}>Boost active</Text>
        <Text style={s.left}>{label} left</Text>
      </View>
      <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%` }]} /></View>
      <View style={s.dates}>
        <View><Text style={s.k}>Started</Text><Text style={s.v}>{fmt(boost.startsAt!)}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={s.k}>Ends</Text><Text style={s.v}>{fmt(boost.endsAt!)}</Text></View>
      </View>
      {boost.queued > 0 && <Text style={s.sub}>{boost.queued} more boost{boost.queued > 1 ? 's' : ''} queued after this one</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: boostColors.employerBg, borderColor: boostColors.employerBorder, borderWidth: 1,
          borderRadius: 20, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: boostColors.employerText },
  left: { fontSize: 15, fontWeight: '800', color: boostColors.employerText },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(196,83,31,0.18)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: boostColors.employerIcon },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  k: { fontSize: 11, color: boostColors.employerText, opacity: 0.7, fontWeight: '600' },
  v: { fontSize: 13, color: boostColors.employerText, fontWeight: '700' },
  sub: { fontSize: 12, color: boostColors.employerText, opacity: 0.85 },
});
