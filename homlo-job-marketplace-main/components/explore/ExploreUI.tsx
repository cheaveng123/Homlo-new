import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, NativeScrollEvent, NativeSyntheticEvent, PixelRatio, Pressable, PressableProps,
  ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing, FadeInDown, FadeOutUp, cancelAnimation, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Tint, c, fonts, r, shadow, sp, tints, type } from './tokens';

/* ───────── Icons (24px grid, 1.6 line, round caps/joins). Swap for the app's AppIcon if the names exist. ───────── */
const ICONS = {
  search: { p: ['M16 16l4 4'], o: [[11, 11, 6.5]] },
  sliders: { p: ['M4 7h16M7 12h10M10 17h4'] },
  pin: { p: ['M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z'], o: [[12, 10, 2.5]] },
  bookmark: { p: ['M6 4h12v17l-6-4-6 4z'] },
  bell: { p: ['M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4'] },
  heart: { p: ['M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z'] },
  list: { p: ['M5 7h14M5 12h14M5 17h14'] },
  map: { p: ['M9 5l-5 2v12l5-2 6 2 5-2V5l-5 2zM9 5v12M15 7v12'] },
  grid: { p: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'] },
  briefcase: { p: ['M4 8h16v11H4zM9 8V5h6v3M4 13h16'] },
  clock: { p: ['M12 8v4l3 2'], o: [[12, 12, 8]] },
  laptop: { p: ['M5 6h14v9H5zM3 19h18'] },
  back: { p: ['M15 5l-7 7 7 7'] },
  locate: { p: ['M12 3v3M12 18v3M3 12h3M18 12h3'], o: [[12, 12, 4]] },
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = c.deep }: { name: IconName; size?: number; color?: string }) {
  const def = ICONS[name] as { p: readonly string[]; o?: readonly (readonly number[])[] };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {def.p.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {def.o?.map(([cx, cy, rad], i) => (
        <Circle key={i} cx={cx} cy={cy} r={rad} stroke={color} strokeWidth={1.6} />
      ))}
    </Svg>
  );
}

/* ───────── Press feedback: scale 0.975 ───────── */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type PSProps = Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: React.ReactNode };
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: PSProps) {
  const pressScale = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      // Reanimated shared-value writes; the React Compiler immutability rule
      // false-positives on Animated component event handlers.
      // eslint-disable-next-line react-hooks/immutability
      onPressIn={(e) => { pressScale.value = withTiming(0.975, { duration: 90 }); onPressIn?.(e); }}
      // eslint-disable-next-line react-hooks/immutability
      onPressOut={(e) => { pressScale.value = withTiming(1, { duration: 120 }); onPressOut?.(e); }}
      style={[style, a]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ───────── List / Job map switch: cream thumb springs; icon + label centred as a pair, no dot ───────── */
export type ViewMode = 'list' | 'map';
export function SegmentedSwitch({ value, onChange, style }: { value: ViewMode; onChange: (v: ViewMode) => void; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const thumbW = Math.max(0, (w - 8) / 2);
  useEffect(() => {
    const t = value === 'map' ? thumbW : 0;
    x.value = reduce ? t : withSpring(t, { damping: 16, stiffness: 220, mass: 0.8 });
  }, [value, thumbW, reduce, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const items: { key: ViewMode; label: string; icon: IconName }[] = [
    { key: 'list', label: 'List', icon: 'list' },
    { key: 'map', label: 'Job map', icon: 'map' },
  ];
  return (
    <View style={[s.seg, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      <Animated.View pointerEvents="none" style={[s.thumb, { width: thumbW }, thumb]} />
      {items.map((it) => {
        const on = it.key === value;
        const col = on ? c.creamInk : c.muted;
        return (
          <Pressable key={it.key} style={s.segBtn} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Icon name={it.icon} size={18} color={col} />
            <Text style={[type.body, { fontFamily: fonts.semi, color: col }]} maxFontSizeMultiplier={1.3}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────── Filter chips with icons; selected = solid teal ───────── */
export type FilterKey = string;
export type FilterChip = { key: FilterKey; label: string; icon: IconName };
export const DEFAULT_CHIPS: FilterChip[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'full', label: 'Full-time', icon: 'briefcase' },
  { key: 'part', label: 'Part-time', icon: 'clock' },
  { key: 'remote', label: 'Remote', icon: 'laptop' },
];
export function FilterChips({ chips = DEFAULT_CHIPS, value, onChange }: { chips?: FilterChip[]; value: FilterKey; onChange: (k: FilterKey) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
      {chips.map((ch) => {
        const on = ch.key === value;
        return (
          <PressableScale key={ch.key} onPress={() => onChange(ch.key)} hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}>
            <Icon name={ch.icon} size={18} color={on ? c.white : c.teal} />
            <Text style={[type.meta, { fontFamily: on ? fonts.semi : fonts.medium, color: on ? c.white : c.text }]} maxFontSizeMultiplier={1.3}>{ch.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/* ───────── Search pill: "Search" stays, only the word after it rolls ───────── */
const WORDS = ['jobs', 'Barista', 'Front desk', 'skills', 'companies'];
function RollingWord({ words = WORDS, interval = 2200 }: { words?: string[]; interval?: number }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [reduce, words.length, interval]);
  const h = Math.ceil(20 * Math.min(PixelRatio.getFontScale(), 1.3));
  return (
    <View style={{ flex: 1, height: h, overflow: 'hidden' }}>
      <Animated.Text
        key={i}
        entering={reduce ? undefined : FadeInDown.duration(280)}
        exiting={reduce ? undefined : FadeOutUp.duration(280)}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[type.body, { position: 'absolute', left: 0, right: 0, lineHeight: h, color: c.muted }]}
      >
        {words[i]}
      </Animated.Text>
    </View>
  );
}
export function SearchPill({ onPress, onFilterPress, words }: { onPress: () => void; onFilterPress: () => void; words?: string[] }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="search" style={s.search}>
      <Icon name="search" size={20} color={c.teal} />
      <Text style={[type.body, { color: c.muted }]} maxFontSizeMultiplier={1.3}>Search </Text>
      <RollingWord words={words} />
      <Pressable onPress={onFilterPress} hitSlop={4} accessibilityLabel="Filters" style={s.filterDisc}>
        <Icon name="sliders" size={18} color={c.deep} />
      </Pressable>
    </PressableScale>
  );
}

/* ───────── Auto-scrolling pager: pages sit inside the 16px margins, nothing peeks past the edge ───────── */
export function AutoPager({ pages, interval = 4500, auto = true }: { pages: React.ReactNode[]; interval?: number; auto?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<FlatList>(null);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const paused = useRef(false);
  useEffect(() => {
    if (!auto || reduce || pages.length < 2 || !w) return;
    const t = setInterval(() => {
      if (paused.current) return;
      const n = (idxRef.current + 1) % pages.length;
      ref.current?.scrollToOffset({ offset: n * w, animated: true });
      idxRef.current = n;
      setIdx(n);
    }, interval);
    return () => clearInterval(t);
  }, [auto, reduce, pages.length, w, interval]);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / (w || 1));
    idxRef.current = n; setIdx(n); paused.current = false;
  };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <FlatList
          ref={ref} data={pages} horizontal pagingEnabled nestedScrollEnabled
          showsHorizontalScrollIndicator={false} keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          renderItem={({ item }) => <View style={{ width: w }}>{item}</View>}
          onScrollBeginDrag={() => { paused.current = true; }}
          onScrollEndDrag={() => { setTimeout(() => { paused.current = false; }, interval); }}
          onMomentumScrollEnd={settle}
        />
      )}
      {pages.length > 1 && (
        <View style={s.pager}>
          {pages.map((_, i) => (
            <View key={i} style={[s.pagerBar, i === idx && s.pagerOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ───────── Section title (sun dot marker, no counts) ───────── */
export function SectionTitle({ title, dot = c.teal, onSeeAll }: { title: string; dot?: string; onSeeAll?: () => void }) {
  return (
    <View style={s.titleRow}>
      <View style={s.titleLeft}>
        <View style={[s.dot, { backgroundColor: dot }]} />
        <Text style={[type.section, { color: c.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={12} accessibilityRole="button">
          <Text style={[type.meta, { fontFamily: fonts.semi, color: c.teal }]}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ───────── Data shapes: map your existing job data into these ───────── */
export type Job = {
  id: string; title: string; company: string; pay: string; distance: string;
  initials: string; logoColor: string;
  /** Whether the listing currently has an active boost (shown as "Ads" to the public). */
  boosted?: boolean;
};

function Logo({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: r.tile, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: c.white }}>{initials}</Text>
    </View>
  );
}

/* Tinted job card (two per page) */
export function JobCard({ job, tint = tints.lagoon, onPress, onSave }: { job: Job; tint?: Tint; onPress?: () => void; onSave?: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[s.card, shadow.soft, { backgroundColor: tint.bg }]} accessibilityRole="button">
      <View style={s.between}>
        <Logo initials={job.initials} color={job.logoColor} />
        <Pressable onPress={onSave} hitSlop={8} accessibilityLabel="Save job" style={s.saveBtn}>
          <Icon name="bookmark" size={20} color={tint.ink} />
        </Pressable>
      </View>
      <Text style={[type.title, { color: tint.ink, marginTop: sp.m }]} numberOfLines={2}>{job.title}</Text>
      <Text style={[type.meta, { color: tint.ink }]} numberOfLines={1}>{job.company}</Text>
      <View style={[s.between, { marginTop: sp.s }]}>
        <Text style={[type.meta, { fontFamily: fonts.semi, color: c.clay }]}>{job.pay}</Text>
        <Text style={[type.meta, { color: tint.ink }]}>{job.distance}</Text>
        {job.boosted && <View style={s.adPill}><Text style={s.adPillText}>Ads</Text></View>}
      </View>
    </PressableScale>
  );
}

/* Compact row (grouped inside a bordered container, three per page) */
export function JobRowGroup({ jobs, onPress }: { jobs: Job[]; onPress?: (j: Job) => void }) {
  return (
    <View style={s.group}>
      {jobs.map((j, i) => (
        <PressableScale key={j.id} onPress={() => onPress?.(j)} accessibilityRole="button"
          style={[s.rowItem, i < jobs.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
          <Logo initials={j.initials} color={j.logoColor} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontFamily: fonts.heading, color: c.text }]} numberOfLines={1}>{j.title}</Text>
            <Text style={[type.meta, { color: c.muted }]} numberOfLines={1}>{j.company}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.meta, { fontFamily: fonts.semi, color: c.clay }]}>{j.pay}</Text>
            <Text style={[type.caption, { color: c.muted }]}>{j.distance}</Text>
            {j.boosted && <View style={s.adPill}><Text style={s.adPillText}>Ads</Text></View>}
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

/* Cream ticket with dashed tear line and the one diagonal light sweep */
function DashedLine({ color }: { color: string }) {
  return (
    <View style={{ height: 1.5, overflow: 'hidden' }}>
      <View style={{ height: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color }} />
    </View>
  );
}
export function Ticket({ eyebrow, title, footer, pay, onPress }: { eyebrow: string; title: string; footer: string; pay: string; onPress?: () => void }) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(-200);
  useEffect(() => {
    if (reduce || !w) return;
    x.value = -w * 0.6;
    x.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(w * 1.4, { duration: 1000, easing: Easing.inOut(Easing.quad) })),
        withTiming(-w * 0.6, { duration: 0 }),
      ), -1);
    return () => cancelAnimation(x);
  }, [w, reduce, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { skewX: '-12deg' }] }));
  return (
    <PressableScale onPress={onPress} style={[s.ticket, shadow.soft]} accessibilityRole="button">
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none">
        {!reduce && w > 0 && (
          <Animated.View style={[{ position: 'absolute', top: -20, bottom: -20, width: w * 0.4 }, sweep]}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        )}
      </View>
      <Text style={[type.caption, { fontFamily: fonts.semi, color: c.creamEyebrow }]}>{eyebrow}</Text>
      <Text style={[type.section, { color: c.creamInk, marginTop: sp.s, marginBottom: sp.m }]} numberOfLines={4}>{title}</Text>
      <View style={{ flex: 1 }} />
      <DashedLine color={c.cream2} />
      <View style={{ paddingTop: sp.s, gap: sp.s, alignItems: 'flex-start' }}>
        <Text style={[type.meta, { color: c.creamInk }]}>{footer}</Text>
        <View style={s.payPill}><Text style={[type.caption, { fontFamily: fonts.semi, color: c.white }]}>{pay}</Text></View>
      </View>
    </PressableScale>
  );
}

/* Deep teal "top pick" card (no percentages) */
export function TopPick({ job, onPress }: { job?: Job; onPress?: () => void }) {
  if (!job) return null;
  return (
    <PressableScale onPress={onPress} style={[s.topPick, shadow.soft]} accessibilityRole="button">
      <Text style={[type.caption, { fontFamily: fonts.semi, color: c.tint2 }]}>TOP PICK FOR YOU</Text>
      <Text style={[type.section, { color: c.white, marginTop: sp.s, marginBottom: sp.m }]} numberOfLines={3}>{job.title}</Text>
      <View style={{ flex: 1 }} />
      <View style={{ borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(181,226,223,0.5)', paddingTop: sp.s, gap: sp.s, alignItems: 'flex-start' }}>
        <Text style={[type.meta, { color: c.tint }]} numberOfLines={1}>{job.company} · {job.distance}</Text>
        <View style={s.payPill}><Text style={[type.caption, { fontFamily: fonts.semi, color: c.white }]}>{job.pay}</Text></View>
      </View>
    </PressableScale>
  );
}

/* Top employers: five bubbles spread inside the margins */
export function EmployerBubbles({ items, onPress }: { items: { id: string; name: string; initials: string; color: string }[]; onPress?: (id: string) => void }) {
  return (
    <View style={s.bubbles}>
      {items.slice(0, 5).map((e) => (
        <PressableScale key={e.id} onPress={() => onPress?.(e.id)} style={{ width: 64, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={e.name}>
          <View style={{ width: 56, height: 56, borderRadius: r.pill, backgroundColor: e.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: c.white }}>{e.initials}</Text>
          </View>
          <Text style={[type.caption, { color: c.text, marginTop: 6 }]} numberOfLines={1}>{e.name}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  seg: { height: 48, padding: 4, borderRadius: r.pill, backgroundColor: c.page, flexDirection: 'row' },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: r.pill, backgroundColor: c.cream, borderWidth: 1.5, borderColor: c.cream2 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chipRow: { paddingHorizontal: sp.l, gap: sp.s },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: r.chip, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: c.teal, borderColor: c.teal },
  search: { height: 52, borderRadius: r.pill, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingLeft: sp.l, paddingRight: sp.s, flexDirection: 'row', alignItems: 'center', gap: sp.s, ...shadow.soft },
  filterDisc: { width: 36, height: 36, borderRadius: r.pill, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: sp.s },
  pagerBar: { width: 8, height: 4, borderRadius: 2, backgroundColor: c.track },
  pagerOn: { width: 16, backgroundColor: c.teal },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: sp.s },
  dot: { width: 8, height: 8, borderRadius: 4 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { flex: 1, borderRadius: r.card, padding: sp.m },
  saveBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  group: { borderWidth: 1, borderColor: c.line, borderRadius: r.tile, overflow: 'hidden', backgroundColor: c.card },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: sp.m, padding: sp.m },
  ticket: { flex: 1, borderRadius: r.hero, padding: sp.l, backgroundColor: c.cream, overflow: 'hidden' },
  topPick: { flex: 1, borderRadius: r.hero, padding: sp.l, backgroundColor: c.deep },
  payPill: { backgroundColor: c.clay, borderRadius: r.pill, paddingHorizontal: 10, paddingVertical: 2 },
  adPill: { backgroundColor: c.sun, borderRadius: r.pill, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  adPillText: { fontFamily: fonts.semi, fontSize: 9, color: c.deep },
  bubbles: { flexDirection: 'row', justifyContent: 'space-between' },
});
