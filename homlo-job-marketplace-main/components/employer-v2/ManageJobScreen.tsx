// ManageJobScreen: presentational home for the employer job manager
// (docs/redesign). All data + logic stay in the route; this component only
// renders the Lagoon & Sunrise layout: collapsible title, bento stats, cream
// boost ticket, sticky underlined tabs and a sun-dot application timeline.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppIcon,
  Bars,
  Breathe,
  CountUp,
  DashedTear,
  LightSweep,
  Press,
  PressDisc,
  Txt,
} from './ui';
import { colors, font, radius, shadow } from './ui';

export type ManageFilter = 'All' | 'Pending' | 'Accepted' | 'Rejected';

export type ManageJobInfo = {
  id: string;
  title: string;
  locationLabel: string | null;
  rolesTotal: number;
  filled: number;
  views: number;
  applicantsCount: number;
  unreadCount: number;
  payAmount: number;
  paySuffix: string;
};

export type ManageApplicant = {
  id: string;
  name: string;
  appliedAt: string;
  note: string;
  location: string;
  status: 'pending' | 'accepted' | 'rejected';
  isNew?: boolean;
};

export type ManageJobScreenProps = {
  info: ManageJobInfo;
  applicants: ManageApplicant[];
  filters: readonly ManageFilter[];
  activeFilter: ManageFilter;
  emptyText: string;
  onFilterChange: (f: ManageFilter) => void;
  onBack: () => void;
  onMenu: () => void;
  onBoost: () => void;
  onAccept: (a: ManageApplicant) => void;
  onReject: (a: ManageApplicant) => void;
  onMessage: (a: ManageApplicant) => void;
};

const STATUS_PILL: Record<ManageApplicant['status'], { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.cream, fg: colors.creamInk, label: 'Pending' },
  accepted: { bg: colors.tint, fg: colors.teal, label: 'Accepted' },
  rejected: { bg: colors.dangerTint, fg: colors.danger, label: 'Rejected' },
};

/* big title collapses into the top bar; tabs stick by translateY (not the
   native stickyHeaderIndices, which native-crashes on Android/Fabric). */
type EnterExit = React.ComponentProps<typeof Animated.View>['entering'];

export default function ManageJobScreen({
  info, applicants, filters, activeFilter, emptyText,
  onFilterChange, onBack, onMenu, onBoost, onAccept, onReject, onMessage,
}: ManageJobScreenProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const tabsY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [8, 64], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(y.value, [8, 64], [8, 0], 'clamp') }],
  }));
  const barBorder = useAnimatedStyle(() => ({
    borderBottomWidth: interpolate(y.value, [0, 40], [0, StyleSheet.hairlineWidth], 'clamp'),
  }));
  const tabsShift = useAnimatedStyle(() => {
    const dy = y.value - tabsY.value;
    return { transform: [{ translateY: dy > 0 ? dy : 0 }] };
  });

  const enter: EnterExit = reduce ? undefined : FadeInRight.duration(280);
  const exit: EnterExit = reduce ? undefined : FadeOutLeft.duration(200);

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <Animated.View style={[styles.bar, { paddingTop: insets.top + 8 }, barBorder]}>
        <View style={styles.barRow}>
          <PressDisc onPress={onBack} size={40} accessibilityLabel="Back" style={styles.barBtn}>
            <AppIcon name="back" size={18} color={colors.deepTeal} />
          </PressDisc>
          <Animated.Text numberOfLines={1} style={[styles.barTitle, compactStyle]}>{info.title}</Animated.Text>
          <PressDisc onPress={onMenu} size={40} accessibilityLabel="More options" style={styles.barBtn}>
            <AppIcon name="dots" size={18} color={colors.deepTeal} />
          </PressDisc>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* intro */}
        <View style={styles.intro}>
          <Txt style={styles.eyebrow}>JOB MANAGER</Txt>
          <Txt style={styles.h1} numberOfLines={2}>{info.title}</Txt>
          <Txt style={styles.sub}>
            {info.applicantsCount} {info.applicantsCount === 1 ? 'applicant' : 'applicants'}
            {info.unreadCount > 0 ? ` · ${info.unreadCount} unread` : ''}
            {' · '}
            {info.locationLabel ?? 'Location not provided'}
          </Txt>
        </View>

        {/* bento */}
        <View style={{ paddingHorizontal: 12 }}>
          <View style={styles.filledTile}>
            <View style={styles.filledTop}>
              <Txt style={styles.filledLabel}>Filled</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Txt style={styles.filledCount}>{info.filled}</Txt>
                <Txt style={styles.filledOf}> of {info.rolesTotal}</Txt>
              </View>
            </View>
            <View style={styles.seats}>
              {Array.from({ length: Math.max(1, info.rolesTotal) }, (_, i) => (
                <SeatPop key={i} index={i} filled={i < info.filled && info.filled > 0} />
              ))}
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Txt style={styles.statLabel}>Views</Txt>
              <CountUp value={info.views} style={styles.statVal} />
              <View style={{ marginTop: 10 }}>
                <Bars active={Math.max(1, Math.min(4, Math.round(info.views / 4)))} bars={4} height={22} />
              </View>
            </View>
            <View style={styles.statTile}>
              <Txt style={styles.statLabel}>Applicants</Txt>
              <CountUp value={info.applicantsCount} style={styles.statVal} />
              <View style={{ marginTop: 10 }}>
                <Bars active={Math.max(1, Math.min(4, info.applicantsCount))} bars={4} height={22} />
              </View>
            </View>
            <View style={[styles.statTile, styles.payTile]}>
              <Txt style={[styles.statLabel, { color: colors.creamInk }]}>Pay</Txt>
              <CountUp
                value={info.payAmount}
                format={(n) => `$${Math.round(n)}`}
                style={[styles.statVal, { color: colors.clay }]}
              />
              <Txt style={styles.paySuffix}>{`${info.paySuffix} · ${info.filled} of ${info.rolesTotal} filled`}</Txt>
            </View>
          </View>
        </View>

        {/* cream boost ticket */}
        <BoostTicket onBoost={onBoost} />

        {/* location */}
        <View style={styles.loc}>
          <View style={styles.locIc}><AppIcon name="pin" size={16} color={colors.teal} /></View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.locSmall}>Location</Txt>
            <Txt style={styles.locTx}>{info.locationLabel ?? 'Location not provided'}</Txt>
          </View>
          <AppIcon name="chevron" size={16} color={colors.muted} />
        </View>

        {/* applications */}
        <View style={styles.secHead}>
          <Txt style={styles.h2}>Applications</Txt>
          <View style={styles.cnt}><Txt style={styles.cntTx}>{info.applicantsCount}</Txt></View>
        </View>

        <Animated.View
          onLayout={(e) => { tabsY.value = e.nativeEvent.layout.y; }}
          style={[styles.tabsStick, tabsShift]}
        >
          <JobTabs filters={filters} value={activeFilter} onChange={onFilterChange} />
        </Animated.View>

        {applicants.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIc}><AppIcon name="info" size={18} color={colors.teal} /></View>
            <Txt style={styles.emptyTx}>{emptyText}</Txt>
          </View>
        ) : (
          applicants.map((a) => (
            <ApplicantRow
              key={a.id}
              applicant={a}
              enter={enter}
              exit={exit}
              onAccept={() => onAccept(a)}
              onReject={() => onReject(a)}
              onMessage={() => onMessage(a)}
            />
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

/* ───────────── seat with pop-in + one-time halo ───────────── */

function SeatPop({ index, filled }: { index: number; filled: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(0);
  const ring = useSharedValue(0);
  const size = 22;
  React.useEffect(() => {
    if (reduce) { s.value = 1; return; }
    s.value = withDelay(index * 90, withSpring(1, { damping: 14, stiffness: 190 }));
    if (filled) {
      ring.value = withDelay(320 + index * 90, withSequence(
        withTiming(1, { duration: 820, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ));
    }
  }, [reduce, index, filled]); // eslint-disable-line react-hooks/exhaustive-deps

  const pop = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: s.value }] }));
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + ring.value * 0.55 }], opacity: 0.7 * (1 - ring.value) }));

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {filled ? (
        <Animated.View pointerEvents="none" style={[styles.seatHalo, halo]} />
      ) : null}
      <Animated.View style={pop}>
        <SeatDot filled={filled} />
      </Animated.View>
    </View>
  );
}

function SeatDot({ filled }: { filled: boolean }) {
  return (
    <View style={[styles.seat, filled && styles.seatFilled]}>
      {!filled ? <Breathe size={10} color="rgba(255,255,255,0.85)" duration={1900} /> : null}
    </View>
  );
}

/* ───────────── mini seat (static, used in pay tile copy-free spots) ───────────── */

function BoostTicket({ onBoost }: { onBoost: () => void }) {
  const [w, setW] = useState(0);
  return (
    <View style={styles.boost}>
      <View style={styles.boostTop}>
        <View style={styles.boltWrap}>
          <Breathe size={64} color="rgba(245,181,43,0.32)" duration={1900} style={styles.boltGlow} />
          <View style={styles.boltDisc}>
            <AppIcon name="bolt" size={22} color={colors.white} strokeWidth={1.8} fill="none" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={styles.boostTitle}>Boost job</Txt>
          <Txt style={styles.boostSub}>Get more visibility, hire faster.</Txt>
        </View>
      </View>
      <DashedTear color="rgba(196,83,31,0.28)" style={{ marginVertical: 12 }} />
      <Press
        onPress={onBoost}
        accessibilityRole="button"
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={styles.boostBtn}
      >
        <LightSweep travel={w} band={26} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppIcon name="bolt" size={15} color={colors.white} strokeWidth={2} fill="none" />
          <Txt style={styles.boostBtnTx}>Boost job</Txt>
        </View>
      </Press>
    </View>
  );
}

/* ───────────── sticky underlined tabs ───────────── */

function JobTabs({ filters, value, onChange }: {
  filters: readonly ManageFilter[]; value: ManageFilter; onChange: (f: ManageFilter) => void;
}) {
  const [w, setW] = useState(0);
  const len = filters.length;
  const idx = Math.max(0, filters.indexOf(value));
  const segment = len > 0 ? w / len : 0;
  const reduce = useReducedMotion();
  const travel = useSharedValue(0);

  React.useEffect(() => {
    travel.value = reduce ? idx * segment : withTiming(idx * segment, { duration: 220, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(travel);
  }, [idx, segment, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: travel.value }] }));

  return (
    <View style={styles.tabs} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {filters.map((f) => {
        const selected = f === value;
        return (
          <Press key={f} onPress={() => onChange(f)} accessibilityRole="tab" accessibilityState={{ selected }} style={styles.tab}>
            <Txt style={[styles.tabTx, selected && styles.tabTxOn]}>{f}</Txt>
          </Press>
        );
      })}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: 0, left: 0, width: segment, alignItems: 'center' }, underline]}>
        <View style={styles.underline} />
      </Animated.View>
    </View>
  );
}

/* ───────────── sun-dot timeline card ───────────── */

function ApplicantRow({ applicant: a, enter, exit, onAccept, onReject, onMessage }: {
  applicant: ManageApplicant; enter: EnterExit; exit: EnterExit;
  onAccept: () => void; onReject: () => void; onMessage: () => void;
}) {
  const pill = STATUS_PILL[a.status];
  return (
    <Animated.View entering={enter} exiting={exit} style={styles.visRow}>
      <View style={styles.rail}>
        <View style={styles.railLine} />
        <View style={styles.railDot} />
      </View>
      <View style={[styles.ticket, shadow]}>
        <View style={styles.who}>
          <View style={styles.av}><Txt style={styles.avTx}>{a.name.charAt(0).toUpperCase()}</Txt></View>
          <View style={{ flex: 1 }}>
            <Txt style={[styles.name, !a.isNew && styles.nameSeen]} numberOfLines={1}>{a.name}</Txt>
            <Txt style={styles.small}>Applied {a.appliedAt}</Txt>
          </View>
          <View style={styles.tagWrap}>
            {a.isNew ? <View style={styles.unreadDot} /> : null}
            <View style={[styles.tag, { backgroundColor: pill.bg }]}><Txt style={[styles.tagTx, { color: pill.fg }]}>{pill.label}</Txt></View>
          </View>
        </View>
        {a.note ? (
          <View style={styles.note}><Txt style={styles.noteTx}>{'"'}{a.note}{'"'}</Txt></View>
        ) : null}
        <View style={styles.metaRow}>
          <AppIcon name="pin" size={12} color={colors.muted} />
          <Txt style={styles.meta}>{a.location}</Txt>
        </View>
        {a.status !== 'rejected' ? (
          <View style={styles.bot}>
            <Press onPress={onMessage} accessibilityRole="button" style={styles.msgBtn}>
              <AppIcon name="message" size={15} color={colors.teal} strokeWidth={1.7} />
              <Txt style={styles.msgTx}>Message</Txt>
            </Press>
            {a.status === 'pending' ? (
              <>
                <PressDisc onPress={onAccept} size={36} accessibilityLabel="Accept application" style={styles.iconBtn}>
                  <AppIcon name="check" size={17} color={colors.teal} strokeWidth={1.9} />
                </PressDisc>
                <PressDisc onPress={onReject} size={36} accessibilityLabel="Reject application" style={styles.iconBtn}>
                  <AppIcon name="x" size={16} color={colors.danger} strokeWidth={1.9} />
                </PressDisc>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.card, borderBottomColor: colors.border, paddingHorizontal: 16, paddingBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  barTitle: { flex: 1, fontFamily: font.headBold, fontSize: 16, color: colors.deepTeal },
  intro: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  eyebrow: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, color: colors.teal },
  h1: { fontFamily: font.head, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, color: colors.deepTeal, marginTop: 6 },
  sub: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 6 },
  filledTile: { backgroundColor: colors.deepTeal, borderRadius: radius.hero, padding: 16, marginTop: 12 },
  filledTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  filledLabel: { fontFamily: font.bold, fontSize: 13, letterSpacing: 0.4, color: 'rgba(255,255,255,0.72)' },
  filledCount: { fontFamily: font.head, fontSize: 22, color: colors.white },
  filledOf: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  seat: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  seatFilled: { backgroundColor: colors.white, borderStyle: 'solid', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  seatHalo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statTile: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 108 },
  statLabel: { fontFamily: font.medium, fontSize: 11, letterSpacing: 0.4, color: colors.muted },
  statVal: { fontFamily: font.head, fontSize: 20, color: colors.deepTeal, marginTop: 4 },
  payTile: { backgroundColor: colors.cream, borderColor: 'rgba(196,83,31,0.16)' },
  paySuffix: { fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: colors.creamInk, marginTop: 4 },
  boost: { marginTop: 12, marginHorizontal: 12, backgroundColor: colors.cream, borderRadius: radius.card, padding: 16 },
  boostTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boltWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  boltGlow: { position: 'absolute', top: -8, left: -8 },
  boltDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  boostTitle: { fontFamily: font.headBold, fontSize: 16, color: colors.deepTeal },
  boostSub: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.creamInk, marginTop: 2 },
  boostBtn: { height: 48, borderRadius: radius.pill, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boostBtnTx: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  loc: { marginTop: 12, marginHorizontal: 12, backgroundColor: colors.card, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  locIc: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  locSmall: { fontFamily: font.medium, fontSize: 11, color: colors.muted },
  locTx: { fontFamily: font.medium, fontSize: 13, color: colors.text, marginTop: 1 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 22 },
  h2: { fontFamily: font.head, fontSize: 19, color: colors.deepTeal },
  cnt: { backgroundColor: colors.tint, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  cntTx: { fontFamily: font.bold, fontSize: 13, color: colors.teal },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, height: 46 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabTx: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  tabTxOn: { fontFamily: font.semi, color: colors.deepTeal },
  underline: { width: 30, height: 3, borderRadius: 2, backgroundColor: colors.sun },
  tabsStick: {
    marginTop: 12,
    backgroundColor: colors.card,
    zIndex: 4,
    elevation: 4,
    shadowColor: colors.deepTeal,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32, gap: 8 },
  emptyIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  emptyTx: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  visRow: { flexDirection: 'row', marginTop: 14 },
  rail: { width: 18, alignItems: 'center', position: 'relative' },
  railLine: { position: 'absolute', top: -12, bottom: 0, width: 2, borderRadius: 1, backgroundColor: colors.track },
  railDot: { marginTop: 26, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.sun, borderWidth: 2, borderColor: colors.card },
  ticket: { flex: 1, marginRight: 12, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  avTx: { fontFamily: font.head, fontSize: 15, color: colors.teal },
  name: { fontFamily: font.semi, fontSize: 15, color: colors.text },
  nameSeen: { color: colors.muted },
  small: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sun },
  tag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  tagTx: { fontFamily: font.bold, fontSize: 11 },
  note: { marginTop: 10, backgroundColor: colors.bg, borderRadius: radius.tile, paddingVertical: 9, paddingHorizontal: 12 },
  noteTx: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  meta: { flex: 1, fontFamily: font.regular, fontSize: 12, color: colors.muted },
  bot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  msgBtn: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.teal, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, flex: 1 },
  msgTx: { fontFamily: font.semi, fontSize: 13, color: colors.teal },
  iconBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
});