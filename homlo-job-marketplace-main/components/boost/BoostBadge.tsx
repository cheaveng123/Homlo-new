import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { AdsIcon } from '@/src/components/icons/AdsIcon';
import { BoostIcon } from '@/src/components/icons/BoostIcon';
import { useBoostCountdown } from './useBoostCountdown';

// Mapped to the existing Lagoon & Sunrise theme tokens (key names kept).
export const boostColors = {
  employerBg: '#FDF0D9',
  employerBorder: '#E8870F',
  employerText: '#7A4300',
  employerIcon: '#E8870F',
  adBg: 'rgba(20,39,43,0.06)',
  adBorder: 'rgba(20,39,43,0.18)',
  adText: '#4A564E',
};

type Props =
  | { audience: 'employee' }                                                    // job seekers: neutral "Ad" tag
  | { audience: 'employer'; endsAt: string; serverNow?: string; onExpire?: () => void };

export function BoostBadge(props: Props) {
  if (props.audience === 'employee') {
    return (
      <View
        style={[s.adPill, { backgroundColor: boostColors.adBg, borderColor: boostColors.adBorder }]}
        accessibilityLabel="Sponsored listing"
      >
        <AdsIcon size={13} />
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
  adPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, paddingLeft: 6, paddingRight: 8, height: 22, borderRadius: 999,
            borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  adText: { fontSize: 11, fontWeight: '700', color: boostColors.adText },
});
