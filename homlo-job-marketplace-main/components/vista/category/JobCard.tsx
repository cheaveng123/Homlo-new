// One job card style for every category. Reveals once when it first enters the
// screen (opacity 0→1, translateY 16→0, 440 ms, stagger (index % 3) × 70 ms).
import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SMOOTH, smooth } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import type { VistaJob } from '../vistaCategoryData';
import { BookmarkGlyph, BriefcaseGlyph, ClockGlyph, LaptopGlyph } from './glyphs';
import { LogoMark } from './LogoMark';
import { AP, F, LINE, agoLabel, isNew, payParts, placeLabel, scheduleLabel } from './tokens';

type Props = {
  job: VistaJob;
  index: number;
  revealed: boolean;
  saved: boolean;
  onOpen: (job: VistaJob) => void;
  onToggleSave: (job: VistaJob) => void;
};

function TypeChip({ kind }: { kind: VistaJob['kind'] }) {
  if (kind === 'monthly') {
    return (
      <View style={[s.chip, { backgroundColor: '#E8EEF3' }]}>
        <BriefcaseGlyph size={13} color={AP.navy} />
        <Text style={[s.chipText, { color: AP.navy }]}>Full-time</Text>
      </View>
    );
  }
  const remote = kind === 'remote';
  return (
    <View style={[s.chip, { backgroundColor: AP.tint }]}>
      {remote ? <LaptopGlyph size={13} color={AP.cyanDeep} /> : <ClockGlyph size={13} color={AP.cyanDeep} />}
      <Text style={[s.chipText, { color: AP.cyanDeep }]}>{remote ? 'Remote' : 'Part-time'}</Text>
    </View>
  );
}

export const JobCard = memo(function JobCard({ job, index, revealed, saved, onOpen, onToggleSave }: Props) {
  const reduce = useReducedMotion();
  const shown = useSharedValue(reduce || revealed ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (!revealed || shown.value === 1) return;
    shown.set(withDelay((index % 3) * 70, withTiming(1, { duration: 440, easing: SMOOTH })));
  }, [revealed, index, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 16 }, { scale: press.value }],
  }));

  const { amount, unit } = payParts(job);
  const ago = agoLabel(job.postedAt);

  return (
    <Animated.View style={[s.card, style]}>
      <Pressable
        onPress={() => { haptic.selection(); onOpen(job); }}
        onPressIn={() => { if (!reduce) press.set(smooth(0.97, 140)); }}
        onPressOut={() => { press.set(smooth(1, 200)); }}
        accessibilityRole="button"
        accessibilityLabel={`${job.title} at ${job.company}`}
        style={s.press}
      >
        <View style={s.row1}>
          <LogoMark company={job.company} uri={job.logoUrl} size={46} radius={12} />
          <View style={s.titleCol}>
            <Text style={s.title} numberOfLines={2}>{job.title}</Text>
            <Text style={s.meta} numberOfLines={1}>{job.company} · {placeLabel(job)}</Text>
          </View>
          <Pressable
            onPress={() => { haptic.selection(); onToggleSave(job); }}
            accessibilityRole="button"
            accessibilityLabel="Save job"
            accessibilityState={{ selected: saved }}
            style={s.save}
          >
            <BookmarkGlyph size={22} color={saved ? AP.navy : AP.faint} filled={saved} />
          </Pressable>
        </View>

        <View style={s.body}>
          <View style={s.row2}>
            <Text style={s.pay}>
              {amount}
              <Text style={s.unit}> {unit}</Text>
            </Text>
            {ago ? <Text style={s.ago}>{ago}</Text> : null}
          </View>
          <View style={s.tags}>
            <TypeChip kind={job.kind} />
            <View style={[s.chip, { backgroundColor: AP.bg }]}>
              <Text style={[s.chipText, { color: AP.muted }]}>{scheduleLabel(job)}</Text>
            </View>
            {isNew(job) ? (
              <View style={[s.chip, { backgroundColor: '#FFF7EA', gap: 6 }]}>
                <View style={s.dot} />
                <Text style={[s.chipText, { color: AP.amberDeep }]}>New</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: LINE, marginBottom: 12,
    shadowColor: AP.ink, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  press: { paddingTop: 14, paddingBottom: 14, paddingLeft: 16, paddingRight: 14 },
  row1: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: F.h, fontSize: 16, lineHeight: 20, color: AP.navy },
  meta: { fontFamily: F.m, fontSize: 13, color: AP.muted, marginTop: 2 },
  save: { width: 44, height: 44, marginTop: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  body: { marginLeft: 58 },
  row2: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  pay: { fontFamily: F.h, fontSize: 17, color: AP.navy },
  unit: { fontFamily: F.m, fontSize: 12, color: AP.muted },
  ago: { fontFamily: F.m, fontSize: 12, color: AP.muted },
  tags: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 26, borderRadius: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontFamily: F.s, fontSize: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AP.amber },
});
