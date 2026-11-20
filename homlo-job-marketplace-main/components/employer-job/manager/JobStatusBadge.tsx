/**
 * Listing status badge for the employer's job cards: a small icon that says what
 * the state means (live signal, hourglass, lock…), a title-case label, and a
 * quiet tinted chip. Static, no animation.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type ListingStatus = 'open' | 'filled' | 'closed' | 'expired' | 'cancelled' | 'draft';

type Tone = { label: string; bg: string; border: string; fg: string };
const TONES: Record<ListingStatus, Tone> = {
  open: { label: 'Open', bg: '#FFFFFF', border: '#C3E6EF', fg: '#0B6F8A' },
  filled: { label: 'Filled', bg: '#FFFFFF', border: '#D3DEE8', fg: '#14324A' },
  closed: { label: 'Closed', bg: '#FFFFFF', border: '#E0E5E9', fg: '#4A5A64' },
  expired: { label: 'Expired', bg: '#FFFFFF', border: '#E9E0D2', fg: '#7A5B32' },
  cancelled: { label: 'Cancelled', bg: '#FFFFFF', border: '#F2D3CE', fg: '#A8392B' },
  draft: { label: 'Draft', bg: '#FFFFFF', border: '#F6E2B8', fg: '#8A5A0B' },
};

function Glyph({ status, color }: { status: ListingStatus; color: string }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (status) {
    case 'open':
      return <Svg {...p}><Circle cx={12} cy={12} r={2.6} fill={color} stroke="none" /><Path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></Svg>;
    case 'filled':
      return <Svg {...p}><Circle cx={12} cy={12} r={9} /><Path d="m8 12.3 2.8 2.8L16.2 9.6" /></Svg>;
    case 'closed':
      return <Svg {...p}><Path d="M6.5 11h11v8.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5Z" /><Path d="M8.8 11V8a3.2 3.2 0 0 1 6.4 0v3" /></Svg>;
    case 'expired':
      return <Svg {...p}><Path d="M7 3h10M7 21h10M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21" /></Svg>;
    case 'cancelled':
      return <Svg {...p}><Circle cx={12} cy={12} r={9} /><Path d="m9 9 6 6M15 9l-6 6" /></Svg>;
    default:
      return <Svg {...p}><Path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" /><Path d="m14 8 3 3" /></Svg>;
  }
}

export function JobStatusBadge({ status, positionsAvailable }: { status: ListingStatus; positionsAvailable?: number }) {
  const t = TONES[status];
  const showSeats = status === 'open' && typeof positionsAvailable === 'number';
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityLabel={`Status: ${t.label}`}>
      <Glyph status={status} color={t.fg} />
      <Text style={[s.label, { color: t.fg }]}>{t.label}</Text>
      {showSeats && (
        <>
          <View style={[s.sep, { backgroundColor: t.border }]} />
          <Text style={[s.seats, { color: t.fg }]}>{positionsAvailable} {positionsAvailable === 1 ? 'seat' : 'seats'} left</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1 },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5 },
  sep: { width: 1, height: 12 },
  seats: { fontFamily: 'Inter_500Medium', fontSize: 12, opacity: 0.85 },
});
