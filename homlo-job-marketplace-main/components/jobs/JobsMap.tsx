// Stylised fallback map for platforms without the native map SDK (web).
// Native builds resolve `JobsMap.native.tsx`, which shows the real device
// location and real job coordinates. Both share `JobsMapProps`.
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { J, S } from '@/lib/jobsTheme';
import { F } from '@/lib/profileTheme';
import { useUserLocation } from '@/lib/use-user-location';
import type { JobsMapHandle, JobsMapJob, JobsMapProps } from './JobsMap.types';

const K = 34; // px per km in the stylised map
const ANGLES = [-2.3, -0.6, 0.9, 2.2, -1.4, 0.2, 1.8, -0.2, 2.7, 1.2];
const KM_PER_DEG_LAT = 111;
const KM_PER_DEG_LNG = 107;

function validPair(job: JobsMapJob): job is JobsMapJob & { latitude: number; longitude: number } {
  return (
    typeof job.latitude === 'number' &&
    typeof job.longitude === 'number' &&
    Number.isFinite(job.latitude) &&
    Number.isFinite(job.longitude)
  );
}

export const JobsMap = forwardRef<JobsMapHandle, JobsMapProps>(function JobsMap({ radiusKm, jobs, height = 400, center, onPressJob, fill }, ref) {
  // The stylised map has no camera; keep the handle so callers stay platform-agnostic.
  useImperativeHandle(ref, () => ({ centerOn: () => {}, recenter: () => {} }), []);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const origin = userLocation ?? center;
  const cx = box.w / 2, cy = box.h * 0.58, r = radiusKm * K;
  return (
    <View style={[m.map, fill ? { flex: 1 } : { height }]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[m.park, { left: -20, top: 90, width: 150, height: 100 }]} />
      <View style={[m.park, { right: -30, bottom: 70, width: 160, height: 120 }]} />
      <View style={[m.water, { right: -70, top: -70, width: 220, height: 220 }]} />
      <View style={[m.road, { left: -10, top: 200, width: '130%', height: 8, transform: [{ rotate: '-8deg' }] }]} />
      <View style={[m.road, { left: -10, top: 300, width: '130%', height: 6, transform: [{ rotate: '6deg' }] }]} />
      <View style={[m.road, { left: 130, top: -10, width: 8, height: '130%', transform: [{ rotate: '10deg' }] }]} />
      <View style={[m.road, { left: 270, top: -10, width: 6, height: '130%', transform: [{ rotate: '-6deg' }] }]} />

      {box.w > 0 && (<>
        <View style={[m.ring, { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r }]} />
        <View style={[m.halo, { left: cx - 15, top: cy - 15 }]} />
        <View style={[m.me, { left: cx - 9, top: cy - 9 }]} />
        {jobs.map((j, i) => {
          const a = ANGLES[i % ANGLES.length], d = (j.km ?? 0) * K;
          const placed = validPair(j) && origin;
          const dx = placed ? (j.longitude - origin.longitude) * KM_PER_DEG_LNG * K : Math.cos(a) * d;
          const dy = placed ? -(j.latitude - origin.latitude) * KM_PER_DEG_LAT * K : Math.sin(a) * d;
          return (
            <Pressable
              key={j.id}
              accessibilityRole="button"
              accessibilityLabel={`${j.pay} job`}
              onPress={() => onPressJob?.(j.id)}
              style={[m.pinWrap, { left: cx + dx - 50, top: cy + dy - 15 }]}
            >
              <View style={m.pin}><Text style={m.pinT}>{j.unit === '/hr' ? `${j.pay}/hr` : j.pay}</Text></View>
            </Pressable>
          );
        })}
      </>)}
    </View>
  );
});

const m = StyleSheet.create({
  map: { backgroundColor: '#E4EFEE', overflow: 'hidden' },
  park: { position: 'absolute', backgroundColor: '#CDE7DF', borderRadius: 24 },
  water: { position: 'absolute', backgroundColor: '#CFE3F0', borderRadius: 110 },
  road: { position: 'absolute', backgroundColor: '#fff' },
  ring: { position: 'absolute', backgroundColor: 'rgba(14,124,134,0.10)', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(14,124,134,0.6)' },
  halo: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(245,181,43,0.3)' },
  me: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: J.sun, borderWidth: 3, borderColor: '#fff' },
  pinWrap: { position: 'absolute', width: 100, alignItems: 'center' },
  pin: { backgroundColor: '#fff', paddingHorizontal: S.md, paddingVertical: 6, borderRadius: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  pinT: { fontFamily: F.b600, fontSize: 13, color: J.fg },
});
