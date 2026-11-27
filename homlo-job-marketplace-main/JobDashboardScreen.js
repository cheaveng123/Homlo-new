/**
 * JobDashboardScreen.js
 *
 * Requires: react-native-svg
 *   npm install react-native-svg
 *   (iOS) cd ios && pod install
 *
 * Behavior implemented:
 * 1. The green hero (background + its logo/search/bell/title/button) translates
 *    upward together with scroll for the first HERO_LOCK_DISTANCE (30px), then
 *    LOCKS in place — it does not move any further no matter how much more the
 *    user scrolls.
 * 2. The scrollable "components" (stat cards, tabs, job list/cards and all text
 *    inside them) keep scrolling normally the entire time, independent of the
 *    hero lock, because they live in their own native ScrollView layer.
 * 3. While inside the 0–30px transition zone, if the user lifts their finger
 *    (or momentum scrolling ends) partway through, the scroll position is
 *    auto-snapped to whichever end (0 or 30) is closer, using an animated
 *    scrollTo. This guarantees the fade/slide/lock animation always finishes
 *    cleanly and is never left visually "stuck" mid-transition.
 * 4. Z-order (back to front): hero background -> scrollable components layer
 *    -> hero foreground controls. This keeps every card/tab/text always
 *    rendered above the green background, while keeping the header's own
 *    controls (search, bell, avatar, add button) tappable on top.
 */

import React, { useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

// ---- Palette (same as the web version) ----------------------------------
const COLORS = {
  bg: '#f4f2fb',
  card: '#ffffff',
  ink: '#14121f',
  sub: '#7a7690',
  line: '#ece9f7',
  primary: '#5b4bff',
  accentSoft: '#eef0ff',
  heroBg: '#122a1f',
  mintBg: '#d6f7e8',
  deltaUp: '#1f9d63',
  deltaDown: '#e0405a',
  highlightBg: '#2fbf8a',
  highlightInk: '#04241a',
};

// ---- Layout constants -----------------------------------------------------
const HERO_MAX_HEIGHT = 210;     // hero background height at rest (scroll = 0)
const HERO_LOCK_DISTANCE = 30;   // px the hero is allowed to travel before locking
const HERO_OVERLAP = 48;         // how far the stat card overlaps up into the hero
const NAVBAR_HEIGHT = 78;

export default function JobDashboardScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  // Background + hero foreground travel together, then clamp at -30 ("lock").
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -HERO_LOCK_DISTANCE],
    extrapolate: 'clamp',
  });

  // Inner row (logo / search / bell) fades + lifts, finishing exactly at the lock point.
  const rowOpacity = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const rowTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -22],
    extrapolate: 'clamp',
  });
  const titleTranslateX = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, -160],
    extrapolate: 'clamp',
  });
  const addBtnTranslateX = scrollY.interpolate({
    inputRange: [0, HERO_LOCK_DISTANCE],
    outputRange: [0, 160],
    extrapolate: 'clamp',
  });

  // ---- Snap logic: never leave the transition mid-way -----------------
  const snapTo = (y) => {
    // Animated.ScrollView forwards scrollTo on its ref in modern React Native.
    // If you're on RN < 0.62, use scrollRef.current.getNode().scrollTo(...) instead.
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  const maybeSnap = (offsetY) => {
    if (offsetY > 0 && offsetY < HERO_LOCK_DISTANCE) {
      snapTo(offsetY < HERO_LOCK_DISTANCE / 2 ? 0 : HERO_LOCK_DISTANCE);
    }
  };

  const handleScrollEndDrag = (e) => maybeSnap(e.nativeEvent.contentOffset.y);
  const handleMomentumScrollEnd = (e) => maybeSnap(e.nativeEvent.contentOffset.y);

  return (
    // collapsable={false} stops Android's view-flattening optimization from merging
    // these absolutely-positioned siblings into one opaque layer, which is what was
    // causing the solid white block instead of a see-through overlap.
    <View style={styles.screen} collapsable={false}>
      {/* LAYER 0 — hero background. Locks after 30px, always behind everything else. */}
      <Animated.View
        pointerEvents="none"
        renderToHardwareTextureAndroid
        needsOffscreenAlphaCompositing
        style={[
          styles.heroBackground,
          { transform: [{ translateY: heroTranslateY }] },
        ]}
      />

      {/* LAYER 1 — scrollable components: stat cards, tabs, job list. Always above the background. */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollLayer}
        // backgroundColor must be explicit + transparent here — if this (or any
        // wrapping SafeAreaView/View from your app shell) is left unset, some
        // RN/Android combos fall back to an opaque white surface, which kills
        // the floating/overlap effect entirely.
        contentContainerStyle={{
          backgroundColor: 'transparent',
          paddingTop: HERO_MAX_HEIGHT - HERO_OVERLAP,
          paddingBottom: NAVBAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        <StatCard />
        <Tabs />
        <JobList />
      </Animated.ScrollView>

      {/* LAYER 2 — hero foreground controls. Topmost, so they stay tappable and visible. */}
      {/* ============ SEARCH BAR + FADE/SLIDE TRANSITION LIVES HERE — DO NOT DROP THIS BLOCK ============ */}
      <Animated.View
        pointerEvents="box-none"
        collapsable={false}
        style={[styles.heroForeground, { transform: [{ translateY: heroTranslateY }] }]}
      >
        <Animated.View
          pointerEvents="box-none"
          style={[styles.heroTopRow, { opacity: rowOpacity, transform: [{ translateY: rowTranslateY }] }]}
        >
          <View style={styles.logoBox}>
            <IconBriefcase color="#fff" size={16} />
          </View>
          {/* --- search bar --- */}
          <View style={styles.searchPill}>
            <IconSearch color="rgba(255,255,255,0.7)" size={14} />
            <Text style={styles.searchText}>Search</Text>
          </View>
          <View style={styles.iconBtn}>
            <IconBell color="#fff" size={16} />
          </View>
        </Animated.View>
        {/* ============ end search bar / transition row ============ */}

        {/* Avatar is intentionally OUTSIDE the fading row — it always stays visible. */}
        <View style={styles.avatarBtn}>
          <Text style={styles.avatarText}>H</Text>
        </View>

        <View style={styles.heroHeadingRow} pointerEvents="box-none">
          <Animated.Text
            style={[
              styles.heroTitle,
              { opacity: rowOpacity, transform: [{ translateX: titleTranslateX }] },
            ]}
          >
            Dashboard
          </Animated.Text>
          <Animated.View
            style={{ opacity: rowOpacity, transform: [{ translateX: addBtnTranslateX }] }}
          >
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
              <IconPlus color={COLORS.highlightInk} size={12} />
              <Text style={styles.addBtnText}>Add New Job</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Fixed bottom nav — its own layer, above the background, below hero controls (doesn't matter, no overlap). */}
      <NavBar />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stat card (4 quadrants with an inset "+" divider, no outer border)
// ---------------------------------------------------------------------------
function StatCard() {
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardDividerV} pointerEvents="none" />
      <View style={styles.statCardDividerH} pointerEvents="none" />

      <Stat
        mint
        icon={<IconBriefcase color={COLORS.primary} size={14} />}
        label="Total Applications"
        value="312"
        delta="+48"
        pct="1.3%"
        up
      />
      <Stat
        icon={<IconDocument color={COLORS.primary} size={14} />}
        label="Jobs Posted"
        value="18"
        delta="+3"
        pct="2.1%"
        up
      />
      <Stat
        icon={<IconSparkle color={COLORS.primary} size={14} />}
        label="New Jobs"
        value="7"
        delta="+2"
        pct="4.6%"
        up
      />
      <Stat
        icon={<IconCheckCircle color={COLORS.primary} size={14} />}
        label="Closed Jobs"
        value="11"
        delta="-1"
        pct="1.8%"
        up={false}
      />
    </View>
  );
}

function Stat({ mint, icon, label, value, delta, pct, up }) {
  return (
    <View style={[styles.stat, mint && styles.statMint]}>
      <View style={styles.statHead}>
        <View style={styles.statIcon}>{icon}</View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statDeltaRow}>
        <View style={styles.deltaCount}>
          <Text style={styles.deltaCountText}>{delta}</Text>
        </View>
        <View style={styles.deltaPct}>
          {up ? (
            <IconChevronUp color={COLORS.deltaUp} size={9} />
          ) : (
            <IconChevronDown color={COLORS.deltaDown} size={9} />
          )}
          <Text style={[styles.deltaPctText, { color: up ? COLORS.deltaUp : COLORS.deltaDown }]}>
            {pct}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function Tabs() {
  return (
    <View style={styles.tabs}>
      <Tab label="All" count="18" active />
      <Tab label="New" count="7" />
      <Tab label="Closed" count="11" />
    </View>
  );
}
function Tab({ label, count, active }) {
  return (
    <View style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      <View style={[styles.tabCount, !active && styles.tabCountInactive]}>
        <Text style={[styles.tabCountText, !active && { color: COLORS.primary }]}>{count}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Job list
// ---------------------------------------------------------------------------
const JOBS = [
  { title: 'Senior Product Designer', filled: 3, total: 5, date: '14 Oct 2026', applied: 24, initials: ['A', 'B', '+3'] },
  { title: 'Backend Engineer, Payments', filled: 1, total: 2, date: '3 Nov 2026', applied: 9, initials: ['K', 'L'] },
  { title: 'Growth Marketing Lead', filled: 4, total: 10, date: '21 Oct 2026', applied: 41, initials: ['M', 'N', '+6'], highlight: true },
  { title: 'QA Automation Engineer', filled: 2, total: 3, date: '14 Oct 2026', applied: 16, initials: ['P', 'Q'] },
];

function JobList() {
  return (
    <View style={styles.list}>
      {JOBS.map((job) => (
        <JobCard key={job.title} {...job} />
      ))}
    </View>
  );
}

function JobCard({ title, filled, total, date, applied, initials, highlight }) {
  const left = total - filled;
  const pct = Math.round((filled / total) * 100);
  const inkColor = highlight ? COLORS.highlightInk : COLORS.ink;

  return (
    <View style={[styles.job, highlight && styles.jobHighlight]}>
      <View style={styles.jobTop}>
        <Text style={[styles.jobTitle, { color: inkColor }]}>{title}</Text>
        <IconMoreDots color={inkColor} size={16} />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabelText, { color: inkColor }]}>
            {filled} of {total} positions filled
          </Text>
          <Text style={[styles.progressLabelText, { color: inkColor }]}>{left} left</Text>
        </View>
        <View style={[styles.progressBar, highlight && styles.progressBarHighlight]}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%` },
              highlight && styles.progressFillHighlight,
            ]}
          />
        </View>
      </View>

      <View style={styles.jobMetaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.metaItem}>
            <IconCalendar color={inkColor} size={13} />
            <Text style={[styles.metaText, { color: inkColor }]}>{date}</Text>
          </View>
          <View style={styles.metaItem}>
            <IconUser color={inkColor} size={13} />
            <Text style={[styles.metaText, { color: inkColor }]}>{applied} applied</Text>
          </View>
        </View>
        <View style={styles.avatars}>
          {initials.map((label, i) => (
            <View
              key={label + i}
              style={[styles.avatar, i > 0 && { marginLeft: -8 }, highlight && { borderColor: COLORS.highlightBg }]}
            >
              <Text style={styles.avatarLetter}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav
// ---------------------------------------------------------------------------
function NavBar() {
  return (
    <View style={styles.navbar}>
      <NavItem icon={<IconBriefcase color={COLORS.primary} size={18} />} label="Jobs" active />
      <NavItem icon={<IconDocument color={COLORS.sub} size={18} />} label="Applications" />
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <IconPlus color="#fff" size={20} />
      </TouchableOpacity>
      <NavItem icon={<IconChat color={COLORS.sub} size={18} />} label="Messages" />
      <NavItem icon={<IconUser color={COLORS.sub} size={18} />} label="Profile" />
    </View>
  );
}
function NavItem({ icon, label, active }) {
  return (
    <View style={styles.navItem}>
      {icon}
      <Text style={[styles.navItemText, active && { color: COLORS.primary }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Icons (react-native-svg, stroke-based, no external assets)
// ---------------------------------------------------------------------------
function IconBriefcase({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="7" width="20" height="14" rx="2" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Svg>
  );
}
function IconSearch({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="11" cy="11" r="7" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}
function IconBell({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}
function IconDocument({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Line x1="8" y1="13" x2="16" y2="13" />
      <Line x1="8" y1="17" x2="16" y2="17" />
    </Svg>
  );
}
function IconSparkle({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l1.8 5.6L19 9l-5.2 1.9L12 16l-1.8-5.1L5 9l5.2-1.4z" />
    </Svg>
  );
}
function IconCheckCircle({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M8.5 12.5l2.5 2.5 5-5.5" />
    </Svg>
  );
}
function IconChevronUp({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="18 15 12 9 6 15" />
    </Svg>
  );
}
function IconChevronDown({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}
function IconCalendar({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}
function IconUser({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}
function IconMoreDots({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="12" cy="5" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="12" cy="19" r="1.6" />
    </Svg>
  );
}
function IconPlus({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}
function IconChat({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, position: 'relative' },

  // Layer 0 — background only
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_MAX_HEIGHT,
    backgroundColor: COLORS.heroBg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 0,
  },

  // Layer 1 — scrollable content
  scrollLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },

  // Layer 2 — hero foreground controls
  heroForeground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 26,
    zIndex: 2,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14,
  },
  searchText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  avatarBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 26, right: 20,
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  heroHeadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  addBtn: {
    backgroundColor: COLORS.highlightBg, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  addBtnText: { color: COLORS.highlightInk, fontSize: 12.5, fontWeight: '700', marginLeft: 6 },

  // Stat card
  statCard: {
    backgroundColor: COLORS.card, borderRadius: 22, marginHorizontal: 20, padding: 18,
    flexDirection: 'row', flexWrap: 'wrap',
    shadowColor: '#122a1f', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  statCardDividerV: { position: 'absolute', top: 14, bottom: 14, left: '50%', width: 1, backgroundColor: COLORS.line },
  statCardDividerH: { position: 'absolute', left: 14, right: 14, top: '50%', height: 1, backgroundColor: COLORS.line },
  stat: { width: '50%', paddingHorizontal: 8, paddingVertical: 8 },
  statMint: { backgroundColor: COLORS.mintBg, borderRadius: 16 },
  statHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statIcon: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.sub },
  statValue: { fontSize: 26, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  statDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deltaCount: { backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, marginRight: 6 },
  deltaCountText: { fontSize: 10.5, fontWeight: '700', color: COLORS.primary },
  deltaPct: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deltaPctText: { fontSize: 10.5, fontWeight: '700', marginLeft: 2 },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, marginRight: 8,
  },
  tabActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  tabTextActive: { color: COLORS.bg },
  tabCount: { backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 7, marginLeft: 6 },
  tabCountInactive: {},
  tabCountText: { fontSize: 11, fontWeight: '700', color: COLORS.bg },

  // Job list
  list: { paddingHorizontal: 20, paddingTop: 10, gap: 12 },
  job: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, marginBottom: 12 },
  jobHighlight: { backgroundColor: COLORS.highlightBg, borderColor: COLORS.highlightBg },
  jobTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  jobTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1, paddingRight: 8 },
  progressRow: { marginTop: 10, marginBottom: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabelText: { fontSize: 11.5, fontWeight: '600', opacity: 0.8 },
  progressBar: { height: 7, borderRadius: 999, backgroundColor: COLORS.line, overflow: 'hidden' },
  progressBarHighlight: { backgroundColor: 'rgba(4,36,26,0.18)' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  progressFillHighlight: { backgroundColor: COLORS.highlightInk },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 14 },
  metaText: { fontSize: 12.5, opacity: 0.75, marginLeft: 5 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.card,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Nav bar
  navbar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line,
    paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, paddingHorizontal: 16,
    height: NAVBAR_HEIGHT,
  },
  navItem: { alignItems: 'center', gap: 4 },
  navItemText: { fontSize: 11, fontWeight: '600', color: COLORS.sub, marginTop: 4 },
  fab: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: -30,
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
