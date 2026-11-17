import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors, radius } from './theme';
import { Card, ts } from './ui';

// Resolved from theme.ts / ui.tsx (do not change these; they must match the real cards):
// radius.tile = 16, radius.card = 20, radius.chip = 14
// ts.title   = fontSize 14, lineHeight 19
// ts.caption = fontSize 12, lineHeight 17
// ts.tag     = fontSize 12, lineHeight 16
// ts.big     = fontSize 20, lineHeight 26
// Card: bg #FFFFFF, borderRadius 20, borderWidth 1, borderColor #E6EDEF, padding 12, marginBottom 12, shadow

const SKEL_BG = colors.track; // #D5E6EA

function usePulse() {
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withSequence(withTiming(0.55, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
    return () => cancelAnimation(o);
  }, [reduce, o]);
  return useAnimatedStyle(() => ({ opacity: o.value }));
}

function Line({ width, height, borderRadius = 6, style }: { width: number | string; height: number; borderRadius?: number; style?: ViewStyle }) {
  const a = usePulse();
  return (
    <Animated.View style={[styles.line, { width, height, borderRadius } as ViewStyle, style, a]} />
  );
}

export function PartTimeListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {[...Array(count)].map((i) => (
        <View key={i} style={styles.cardWrap}>
          <Card style={styles.card}>
            <View style={styles.thumbRow}>
              <View style={styles.thumb} />
              <View style={styles.heart} />
            </View>
            <View style={styles.body}>
              <Line width="55%" height={ts.title.lineHeight} borderRadius={4} />
              <Line width="75%" height={ts.caption.lineHeight} borderRadius={4} style={{ marginTop: 4 }} />
              <View style={styles.locRow}>
                <View style={styles.locIcon} />
                <Line width="60%" height={ts.caption.lineHeight} borderRadius={4} />
              </View>
              <View style={styles.payRow}>
                <Line width="40%" height={ts.tag.lineHeight} borderRadius={4} />
                <View style={styles.pill} />
              </View>
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}

export function FullTimeListSkeleton({ count = 4 }: { count?: number }) {
  const trackFillAnim = usePulse();
  return (
    <View style={styles.groupWrap}>
      <View style={styles.groupCard}>
        {[...Array(count)].map((i, idx) => (
          <View key={i} style={[styles.row, idx === count - 1 && styles.rowLast]}>
            <View style={styles.rowBody}>
              <Line width="65%" height={ts.title.lineHeight} borderRadius={4} />
              <Line width="85%" height={ts.caption.lineHeight} borderRadius={4} style={{ marginTop: 4 }} />
              <View style={styles.trackWrap}>
                <View style={styles.track} />
                <Animated.View style={[styles.trackFill, trackFillAnim]} />
              </View>
              <Line width="40%" height={ts.caption.lineHeight} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <Line width="35%" height={ts.big.lineHeight} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function WeekendsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {[...Array(count)].map((i) => (
        <View key={i} style={styles.ticketWrap}>
          <View style={styles.ticket}>
            <View style={styles.stub}>
              <Line width="34" height={18} borderRadius={4} />
              <Line width="55%" height={17} borderRadius={4} style={{ marginTop: 2 }} />
            </View>
            <View style={styles.tear} />
            <View style={[styles.notch, { top: -9 }]} />
            <View style={[styles.notch, { bottom: -9 }]} />
            <View style={styles.ticketBody}>
              <Line width="65%" height={ts.title.lineHeight} borderRadius={4} />
              <Line width="55%" height={ts.caption.lineHeight} borderRadius={4} style={{ marginTop: 4 }} />
              <Line width="28%" height={ts.tag.lineHeight} borderRadius={4} style={{ marginTop: 2 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function RemoteGridSkeleton({ count = 4 }: { count?: number }) {
  const { width } = useWindowDimensions();
  const colW = (width - 32 - 12) / 2;
  return (
    <View style={styles.grid}>
      {[...Array(count)].map((i) => (
        <View key={i} style={styles.colWrap}>
          <View style={[styles.col, { width: colW }]}>
            <Card style={styles.remoteCard}>
              <View style={styles.remoteThumb} />
              <Line width="75%" height={ts.title.lineHeight} borderRadius={4} style={{ marginTop: 8 }} />
              <Line width="55%" height={ts.caption.lineHeight} borderRadius={4} style={{ marginTop: 4 }} />
              <Line width="35%" height={ts.tag.lineHeight} borderRadius={4} style={{ marginTop: 6 }} />
            </Card>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  cardWrap: { marginBottom: 12 },
  card: { flexDirection: 'row', gap: 12, padding: 10 },
  thumbRow: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 84, height: 100, borderRadius: radius.tile, backgroundColor: SKEL_BG },
  heart: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white },
  body: { flex: 1, minWidth: 0 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locIcon: { width: 13, height: 13, backgroundColor: SKEL_BG, borderRadius: radius.chip / 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { width: 84, height: 22, borderRadius: radius.chip, backgroundColor: colors.tint },

  groupWrap: { paddingHorizontal: 16 },
  groupCard: { backgroundColor: colors.white, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  trackWrap: { marginTop: 8, marginBottom: 4 },
  track: { height: 6, borderRadius: 6, backgroundColor: colors.track },
  trackFill: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '55%', borderRadius: 6, backgroundColor: colors.teal },

  ticketWrap: { marginVertical: 12 },
  ticket: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 20 },
  stub: { width: 62, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tear: { position: 'absolute', left: 61, top: 0, bottom: 0, width: 2 },
  notch: { position: 'absolute', left: 53, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cream },
  ticketBody: { flex: 1, minWidth: 0, padding: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colWrap: { width: '100%' },
  col: {},
  remoteCard: { padding: 8, marginBottom: 0 },
  remoteThumb: { height: 74, borderRadius: 16, backgroundColor: SKEL_BG },

  line: { backgroundColor: SKEL_BG },
});
