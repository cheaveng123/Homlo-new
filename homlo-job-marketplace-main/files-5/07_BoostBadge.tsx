import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useBoostCountdown } from './06_useBoostCountdown';

// TODO(agent): point these at the Lagoon & Sunrise tokens already in the app. Keep names, change values.
export const boostColors = {
  employerBg: '#FFF1E0', employerBorder: '#F4A340', employerText: '#B45F06', employerIcon: '#E8820C',
  adBg: 'rgba(23,32,26,0.06)', adBorder: 'rgba(23,32,26,0.18)', adText: '#4A564E',
};

type Props =
  | { audience: 'employee' }                                                    // job seekers: neutral "Ad" tag
  | { audience: 'employer'; endsAt: string; serverNow?: string; onExpire?: () => void };

export function BoostBadge(props: Props) {
  if (props.audience === 'employee') {
    return (
      <View style={[s.pill, { backgroundColor: boostColors.adBg, borderColor: boostColors.adBorder }]} accessibilityLabel="Ad">
        <Text style={[s.txt, { color: boostColors.adText }]}>Ad</Text>
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
      <Zap size={12} strokeWidth={2.4} color={boostColors.employerIcon} fill={boostColors.employerIcon} />
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
});
