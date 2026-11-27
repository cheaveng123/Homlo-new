import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import { AdsIcon } from '@/src/components/icons/AdsIcon';
import { BoostIcon } from '@/src/components/icons/BoostIcon';
import { useBoostCountdown } from './useBoostCountdown';

// Mapped to the existing Lagoon & Sunrise theme tokens (key names kept).
export const boostColors = {
  employerBg: '#FDF0D9',
  employerBorder: '#E8870F',
  employerText: '#7A4300',
  employerIcon: '#E8870F',
  adBg: 'rgba(18,48,60,0.06)',
  adBorder: 'rgba(18,48,60,0.18)',
  adText: '#5D7480',
};

type Props =
  | { audience: 'employee' }                                                    // job seekers: neutral "Ad" tag
  | { audience: 'employer'; endsAt: string; serverNow?: string; onExpire?: () => void };

export function BoostBadge(props: Props) {
  if (props.audience === 'employee') {
    return (
      <View
        style={s.adPill}
        accessibilityLabel="Sponsored listing"
      >
        <LinearGradient colors={['#F7B23B', '#E8870F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }} style={StyleSheet.absoluteFill} />
        <AdsIcon size={13} color="#FFFFFF" accent="rgba(255,255,255,0.85)" />
        <Text style={s.adText}>Ads</Text>
      </View>
    );
  }
  return <EmployerBadge {...props} />;
}

function EmployerBadge({ endsAt, serverNow, onExpire }: { endsAt: string; serverNow?: string; onExpire?: () => void }) {
  const { label, expired } = useBoostCountdown(endsAt, serverNow, onExpire);
  if (expired || !label) return null;          // vanishes the moment time is up
  return (
    <View style={[s.pill, { backgroundColor: boostColors.employerBg, borderColor: boostColors.employerBorder }]}
          accessibilityLabel={`Boosted, ${label} left`}>
      <BoostIcon size={16} />
      <Text style={[s.txt, { color: boostColors.employerText }]}>Boosted · {label} left</Text>
    </View>
  );
}

/** Spread onto the employer's own job card container so boosted jobs stand out in the Live tab. */
export const ownerBoostedCardStyle = { borderWidth: 1.5, borderColor: boostColors.employerBorder } as const;

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
          paddingHorizontal: 8, height: 22, borderRadius: 999, borderWidth: 1 },
  txt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
  adPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, paddingLeft: 7, paddingRight: 9, height: 22, borderRadius: 999,
            overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  adText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
