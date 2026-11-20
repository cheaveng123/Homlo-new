// Loading, empty and error states for the Job type page.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SkeletonBlock } from '@/components/loading/HomloSkeletonKit';
import { palette } from '@/src/design/tokens';
import { F } from '@/components/vista/category/tokens';

/**
 * Skeleton shaped like one EmployerCard, using its real measurements so nothing
 * jumps when the data lands: 84pt logo + name / category / pay / location lines,
 * two info cards, then a row of 152pt role cards (photo, price, title).
 * The role row bleeds to the screen edge like the real horizontal scroller.
 */
function ListingSkeleton({ last }: { last: boolean }) {
  return (
    <View style={[s.skWrap, !last && s.skDivider]}>
      <View style={s.skTop}>
        <SkeletonBlock width={84} height={84} borderRadius={24} />
        <View style={s.skTopText}>
          <SkeletonBlock width="68%" height={17} borderRadius={6} />
          <SkeletonBlock width="42%" height={13} borderRadius={6} />
          <SkeletonBlock width="55%" height={13} borderRadius={6} />
          <View style={s.skLoc}>
            <SkeletonBlock width={14} height={14} borderRadius={7} />
            <SkeletonBlock width="46%" height={13} borderRadius={6} />
          </View>
        </View>
      </View>
      <View style={[s.skRow, s.skInfoRow]}>
        {[132, 148].map((w, i) => (
          <View key={i} style={[s.skInfo, { width: w }]}>
            <SkeletonBlock width={22} height={22} borderRadius={11} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="70%" height={12} borderRadius={5} />
              <SkeletonBlock width="90%" height={11} borderRadius={5} />
            </View>
          </View>
        ))}
      </View>
      <View style={[s.skRow, s.skRoles]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.skRole}>
            <SkeletonBlock width={152} height={124} borderRadius={22} />
            <SkeletonBlock width={72} height={16} borderRadius={6} style={{ marginTop: 12 }} />
            <SkeletonBlock width={128} height={13} borderRadius={6} style={{ marginTop: 7 }} />
            <SkeletonBlock width={96} height={13} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Full-page loading body for the Job type page: three listings, announced once. */
export function LoadingState({ count = 3 }: { count?: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading jobs" style={s.skList}>
      {Array.from({ length: count }, (_, i) => <ListingSkeleton key={i} last={i === count - 1} />)}
    </View>
  );
}

/** Stand-in for the "<n> open" count next to the section title while loading. */
export function CountSkeleton() {
  return <SkeletonBlock width={52} height={14} borderRadius={6} />;
}

function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}>
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

/** Flat two-tone art: an empty clipboard with an amber magnifier. */
function EmptyArt() {
  return (
    <Svg width={120} height={96} viewBox="0 0 120 96" fill="none">
      <Rect x={30} y={14} width={50} height={66} rx={10} fill={palette.cyanTint} stroke={palette.navy} strokeWidth={2.4} />
      <Rect x={44} y={8} width={22} height={12} rx={5} fill={palette.surface} stroke={palette.navy} strokeWidth={2.4} />
      <Path d="M42 38h26M42 50h18" stroke={palette.slate} strokeWidth={2.4} strokeLinecap="round" strokeOpacity={0.6} />
      <Circle cx={80} cy={60} r={12} fill={palette.surface} stroke={palette.amber} strokeWidth={3} />
      <Path d="M89 69l9 9" stroke={palette.amber} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function EmptyState({ typeLabel, onAction }: { typeLabel: string; onAction: () => void }) {
  return (
    <View style={s.state}>
      <EmptyArt />
      <Text style={s.title}>No {typeLabel.toLowerCase()} jobs right now</Text>
      <Text style={s.body}>New jobs will show up here. Search all jobs to see more.</Text>
      <OutlineButton label="Search all jobs" onPress={onAction} />
    </View>
  );
}

function ErrorArt() {
  return (
    <Svg width={96} height={80} viewBox="0 0 96 80" fill="none">
      <Path d="M20 58a16 16 0 0 1 3-31.7A22 22 0 0 1 65 22a16 16 0 0 1 9 36Z" fill={palette.cyanTint} stroke={palette.navy} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M48 34v12" stroke={palette.amber} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={48} cy={53} r={1.8} fill={palette.amber} />
    </Svg>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.state}>
      <ErrorArt />
      <Text style={s.title}>Couldn&apos;t load jobs</Text>
      <Text style={s.body}>Check your connection and try again.</Text>
      <OutlineButton label="Try again" onPress={onRetry} />
    </View>
  );
}

const s = StyleSheet.create({
  skList: { overflow: 'hidden' },
  skWrap: { paddingTop: 18, paddingBottom: 20 },
  skDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  skTop: { flexDirection: 'row', gap: 14 },
  skTopText: { flex: 1, justifyContent: 'center', gap: 8 },
  skLoc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skRow: { flexDirection: 'row' },
  skInfoRow: { gap: 10, paddingTop: 14 },
  skInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 58, borderWidth: 1.5, borderColor: palette.line,
    borderRadius: 18, paddingLeft: 12, paddingRight: 16,
  },
  skRoles: { gap: 12, paddingTop: 16, marginRight: -16 },
  skRole: { width: 152 },
  state: { alignItems: 'center', paddingTop: 32, paddingBottom: 16 },
  title: { marginTop: 8, fontFamily: F.h, fontSize: 17, color: palette.navy, textAlign: 'center' },
  body: { marginTop: 6, maxWidth: 280, fontFamily: F.b, fontSize: 14, lineHeight: 20, color: palette.muted, textAlign: 'center' },
  btn: {
    marginTop: 16, height: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: palette.line,
    justifyContent: 'center', backgroundColor: palette.surface,
  },
  btnText: { fontFamily: F.hb, fontSize: 14, color: palette.navy },
});
