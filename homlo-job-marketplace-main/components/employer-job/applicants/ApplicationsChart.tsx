/**
 * "Applications received" card: a sliding range switch over a lit bar chart.
 * Bars sweep up on mount and on every range change, the busiest period is
 * picked out in amber, and tapping a bar pins a value bubble above it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { TextNew } from '@/src/new/components/TextNew';
import { SMOOTH, smooth } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import type { ApplicationsRange } from '@/hooks/use-employer-applications';
import { AP } from './tokens';

export const RANGE_LABEL: Record<ApplicationsRange, string> = {
  '1w': 'Past week',
  '1m': 'Past month',
  '6m': 'Past 6 months',
  '1y': 'Past year',
};
const RANGE_SHORT: Record<ApplicationsRange, string> = { '1w': 'Week', '1m': 'Month', '6m': '6 months', '1y': 'Year' };
const RANGE_DAYS: Record<ApplicationsRange, number> = { '1w': 7, '1m': 30, '6m': 183, '1y': 365 };
/** A year is 365 daily buckets, so long ranges are folded into ~12 readable columns. */
const RANGE_COLUMNS: Record<ApplicationsRange, number> = { '1w': 7, '1m': 15, '6m': 12, '1y': 12 };

const CHART_H = 148;

type Column = { label: string; count: number };

function startOfDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Folds the hook's daily buckets into columns, labelling each from its start date. */
export function toColumns(buckets: { label: string; count: number }[], range: ApplicationsRange): Column[] {
  const days = RANGE_DAYS[range];
  const from = startOfDayMs(Date.now()) - (days - 1) * 86_400_000;
  const size = Math.max(1, Math.ceil(days / RANGE_COLUMNS[range]));
  const out: Column[] = [];
  for (let i = 0; i < buckets.length; i += size) {
    let count = 0;
    for (let c = i; c < Math.min(i + size, buckets.length); c += 1) count += buckets[c]?.count ?? 0;
    const date = new Date(from + i * 86_400_000);
    out.push({
      label: range === '1w'
        ? date.toLocaleDateString('en-GB', { weekday: 'short' })
        : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      count,
    });
  }
  return out;
}

/* ───────── range switch: navy pill slides under the active option ───────── */

function RangeSwitch({ ranges, value, onChange }: { ranges: readonly ApplicationsRange[]; value: ApplicationsRange; onChange: (r: ApplicationsRange) => void }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, ranges.indexOf(value));
  const seg = w ? (w - 8) / ranges.length : 0;
  const x = useSharedValue(0);
  useEffect(() => { x.value = reduced ? idx * seg : smooth(idx * seg, 300); }, [idx, seg, reduced, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={st.switch} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg ? <Animated.View style={[st.switchPill, { width: seg }, pill]} /> : null}
      {ranges.map((r) => {
        const on = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => { if (!on) { haptic.selection(); onChange(r); } }}
            style={st.switchTab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Show ${RANGE_LABEL[r].toLowerCase()}`}
          >
            <TextNew variant="meta" heading weight="bold" color={on ? AP.white : AP.muted}>{RANGE_SHORT[r]}</TextNew>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────── one bar ───────── */

function Bar({ ratio, index, peak, selected, dim, onPress, label, count }: {
  ratio: number; index: number; peak: boolean; selected: boolean; dim: boolean; onPress: () => void; label: string; count: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(Math.min(index, 14) * 35, withTiming(1, { duration: 650, easing: SMOOTH }));
  }, [index, reduced, p]);
  const grow = useAnimatedStyle(() => ({ height: Math.max(4, ratio * (CHART_H - 26) * p.value) }));
  const colors: [string, string] = peak ? [AP.amberSoft, AP.amber] : [AP.cyanSoft, AP.cyan];
  return (
    <Pressable onPress={onPress} style={st.barSlot} accessibilityRole="button" accessibilityLabel={`${label}: ${count} application${count === 1 ? '' : 's'}`}>
      <Animated.View style={[st.bar, { opacity: dim ? 0.35 : count === 0 ? 0.3 : 1 }, grow, selected && st.barSelected]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* top light: a soft white cap so each bar reads as lit from above */}
        <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.barCap} />
      </Animated.View>
    </Pressable>
  );
}

/* ───────── card ───────── */

export function ApplicationsChart({ ranges, range, onRange, buckets }: {
  ranges: readonly ApplicationsRange[]; range: ApplicationsRange; onRange: (r: ApplicationsRange) => void;
  buckets: { label: string; count: number }[];
}) {
  const columns = useMemo(() => toColumns(buckets, range), [buckets, range]);
  const [sel, setSel] = useState<number | null>(null);
  const [prevRange, setPrevRange] = useState(range);
  if (prevRange !== range) { setPrevRange(range); setSel(null); }

  const total = columns.reduce((s, c) => s + c.count, 0);
  const max = Math.max(1, ...columns.map((c) => c.count));
  const peakIdx = total > 0 ? columns.findIndex((c) => c.count === max) : -1;
  // Trend: second half of the period against the first half.
  const half = Math.floor(columns.length / 2);
  const first = columns.slice(0, half).reduce((s, c) => s + c.count, 0);
  const second = columns.slice(half).reduce((s, c) => s + c.count, 0);
  const trend = first === 0 ? (second > 0 ? 100 : 0) : Math.round(((second - first) / first) * 100);
  const up = trend >= 0;
  const gridTop = Math.max(1, Math.ceil(max / 2) * 2);
  const shown = sel != null ? columns[sel] : null;

  return (
    <View>
      <RangeSwitch ranges={ranges} value={range} onChange={onRange} />

      <View style={st.summary}>
        <View>
          <TextNew variant="hero" heading weight="extrabold" color={AP.navy} style={st.total}>{total}</TextNew>
          <TextNew variant="meta" color={AP.muted}>applications · {RANGE_LABEL[range].toLowerCase()}</TextNew>
        </View>
        {total > 0 && (
          <View style={[st.trend, { backgroundColor: up ? AP.tint : AP.dangerTint }]}>
            <TextNew variant="caption" heading weight="bold" color={up ? AP.cyanDeep : AP.danger}>
              {up ? '▲' : '▼'} {Math.abs(trend)}%
            </TextNew>
          </View>
        )}
      </View>

      <View style={st.plot}>
        {/* gridlines: top, middle, base */}
        {[1, 0.5, 0].map((g) => (
          <View key={g} style={[st.grid, { bottom: g * (CHART_H - 26) }]}>
            <TextNew variant="caption" color={AP.faint} style={st.gridLabel}>{Math.round(gridTop * g)}</TextNew>
            <View style={[st.gridLine, g === 0 && st.gridBase]} />
          </View>
        ))}
        <View key={range} style={st.bars}>
          {columns.map((c, i) => (
            <Bar
              key={`${range}-${i}`}
              index={i}
              ratio={c.count / gridTop}
              count={c.count}
              label={c.label}
              peak={i === peakIdx}
              selected={sel === i}
              dim={sel != null && sel !== i}
              onPress={() => { haptic.selection(); setSel(sel === i ? null : i); }}
            />
          ))}
        </View>
        {shown && sel != null && (
          <Animated.View entering={FadeIn.duration(180)} pointerEvents="none"
            style={[st.bubble, { left: `${((sel + 0.5) / columns.length) * 100}%`, bottom: Math.max(4, (shown.count / gridTop) * (CHART_H - 26)) + 10 }]}>
            <TextNew variant="caption" heading weight="extrabold" color={AP.white}>{shown.count}</TextNew>
            <TextNew variant="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 10, lineHeight: 12 }}>{shown.label}</TextNew>
          </Animated.View>
        )}
      </View>

      {/* three readable dates (start, middle, end); tap a bar for its exact date */}
      <View style={st.axis}>
        {(columns.length > 7 ? [0, Math.floor((columns.length - 1) / 2), columns.length - 1] : columns.map((_, i) => i)).map((i) => (
          <TextNew key={i} variant="caption" color={sel === i ? AP.navy : AP.muted} numberOfLines={1} style={st.axisLabel}>
            {columns[i]?.label}
          </TextNew>
        ))}
      </View>
      {peakIdx >= 0 && (
        <View style={st.legend}>
          <View style={[st.legendDot, { backgroundColor: AP.amber }]} />
          <TextNew variant="caption" color={AP.muted}>Busiest: {columns[peakIdx].label} ({max})</TextNew>
          <TextNew variant="caption" color={AP.faint} style={{ marginLeft: 'auto' }}>Tap a bar for details</TextNew>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  switch: { flexDirection: 'row', backgroundColor: AP.bg, borderRadius: 14, padding: 4 },
  switchPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11, backgroundColor: AP.navy },
  switchTab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  total: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  trend: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  plot: { height: CHART_H, marginTop: 14, paddingLeft: 22 },
  grid: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  gridLabel: { width: 16, fontSize: 10, lineHeight: 12, textAlign: 'right' },
  gridLine: { flex: 1, height: 1, borderTopWidth: 1, borderColor: AP.line, borderStyle: 'dashed' },
  gridBase: { borderStyle: 'solid', borderColor: '#D5E6EA' },
  bars: { position: 'absolute', left: 22, right: 0, bottom: 0, top: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 6, overflow: 'hidden' },
  barSelected: { shadowColor: AP.cyan, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  barCap: { position: 'absolute', left: 0, right: 0, top: 0, height: 10 },
  bubble: {
    position: 'absolute', marginLeft: -24 + 11, width: 48, alignItems: 'center', paddingVertical: 4, borderRadius: 10,
    backgroundColor: AP.navy, shadowColor: '#06425A', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingLeft: 22 },
  axisLabel: { fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
