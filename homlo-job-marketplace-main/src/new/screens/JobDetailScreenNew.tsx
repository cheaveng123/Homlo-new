import { ReactNode, useEffect, useState } from 'react';
import { Image, RefreshControl, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppIconNameNew, AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { AccordionNew, ButtonNew, PressableScaleNew, PulseDotNew } from '../components/PrimitivesNew';
import { HeartButtonNew, PositionsBarNew } from '../components/JobPartsNew';
import { colorsNew, radiusNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { PhotoPlaceholder, Reveal } from '@/src/design/primitives';
import { easings, palette, shadows } from '@/src/design/tokens';
import { SectionIcon, type SectionIconName } from '@/src/components/icons/SectionIcons';

export type JobDetailNew = {
  id: string; employerId?: string; title: string; employerName: string; employerInitials: string; imageUri?: string;
  locationLabel: string; addressNote?: string; payLabel: string; typeLabel: string;
  positionsLeft: number; positionsTotal: number; description: string; requirements: string[]; liked?: boolean;
  employerAbout?: string | null;
};
type Props = {
  job: JobDetailNew; mapSlot?: ReactNode; showMap?: boolean; onBack: () => void; onToggleLike: () => void; onAboutEmployer: () => void; onApply: () => void;
  onShare?: () => void; onPressLocation?: () => void; applyDisabled?: boolean; applyLabel?: string;
  onRefresh?: () => void; refreshing?: boolean;
};

const HERO_H = 300;
const BAR_H = 56;

/* ───────── facts ───────── */

function Fact({ icon, label, value, index, a11y }: { icon: SectionIconName; label: string; value: string; index: number; a11y?: string }) {
  return (
    <Reveal index={index + 2} style={s.fact}>
      <View accessible accessibilityLabel={a11y ?? `${label}: ${value}`} style={s.factInner}>
        <View style={s.factHead}>
          <SectionIcon name={icon} size={18} delay={250 + index * 90} />
          <TextNew variant="caption" color={colorsNew.muted}>{label}</TextNew>
        </View>
        <TextNew variant="title" heading weight="extrabold" numberOfLines={1}>{value}</TextNew>
      </View>
    </Reveal>
  );
}

/* ───────── scroll-revealed section: rises in when 15% visible; its icon replays then ───────── */

function ScrollSection({ title, glyph, scrollY, viewportH, children }: {
  title: string; glyph: SectionIconName; scrollY: SharedValue<number>; viewportH: SharedValue<number>; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(-1);
  const t = useSharedValue(reduced ? 1 : 0);
  const [seen, setSeen] = useState(reduced);
  useAnimatedReaction(
    () => y.value >= 0 && y.value + 40 < scrollY.value + viewportH.value,
    (visible, prev) => {
      if (!visible || prev || t.value > 0) return;
      t.value = withTiming(1, { duration: 600, easing: easings.out });
      runOnJS(setSeen)(true);
    },
  );
  const st = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: 26 * (1 - t.value) }] }));
  return (
    <Animated.View style={st} onLayout={(e: LayoutChangeEvent) => { y.value = e.nativeEvent.layout.y; }}>
      <View style={s.sectionHead} accessibilityRole="header" accessible accessibilityLabel={title}>
        <SectionIcon key={seen ? 'on' : 'off'} name={glyph} size={22} delay={seen ? 150 : 100000} />
        <TextNew variant="section">{title}</TextNew>
        <LinearGradient colors={[colorsNew.border, 'rgba(230,237,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sectionRule} />
      </View>
      {children}
    </Animated.View>
  );
}

/** Stylised mini map. Replace via `mapSlot` if the app already has a real map component. */
function MiniMapNew() {
  return (
    <View style={s.miniMap} accessible accessibilityLabel="Map preview of the job location">
      <Svg width="100%" height="100%" viewBox="0 0 360 128" preserveAspectRatio="xMidYMid slice">
        <Rect width="360" height="128" fill="#EAF3F5" />
        <Path d="M250 0c10 30 40 40 30 70s-30 40-14 58H360V0z" fill="#BFE3EC" />
        <Rect x="20" y="16" width="70" height="34" rx="8" fill="#DCEBEF" />
        <Rect x="120" y="84" width="80" height="30" rx="8" fill="#DCEBEF" />
        <G stroke="#fff" fill="none" strokeLinecap="round"><Path d="M0 70C80 60 150 80 240 50" strokeWidth={7} /><Path d="M110 0C118 40 130 90 120 128" strokeWidth={5} /></G>
      </Svg>
      <View style={s.mapPin}>
        <View style={s.mapPulse}><PulseDotNew color={colorsNew.primary} size={32} /></View>
        <View style={s.mapDot} />
      </View>
    </View>
  );
}

/* ───────── header button that turns from "floating on photo" to "inside the white bar" ───────── */

function HeaderButton({ icon, label, onPress, solid }: { icon: AppIconNameNew; label: string; onPress: () => void; solid: SharedValue<number> }) {
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(solid.value, [0, 1], ['rgba(255,255,255,0.94)', palette.cyanTint]),
  }));
  return (
    <PressableScaleNew onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.hBtnHit}>
      <Animated.View style={[s.hBtn, bg]}>
        <AppIconNew name={icon} color={palette.navy} size={21} />
      </Animated.View>
    </PressableScaleNew>
  );
}

export function JobDetailScreenNew({ job, mapSlot, showMap = true, onBack, onToggleLike, onAboutEmployer, onApply, onShare, onPressLocation, applyDisabled, applyLabel, onRefresh, refreshing }: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: winH } = useWindowDimensions();
  const positionsAccepted = Math.max(0, Math.min(job.positionsTotal, job.positionsTotal - job.positionsLeft));
  const topH = insets.top + BAR_H;

  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(1);
  const viewportH = useSharedValue(winH);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    contentH.value = e.contentSize.height;
    viewportH.value = e.layoutMeasurement.height;
  });

  // 0 -> 1 as the title passes under the header (drives the solid bar + title hand-off).
  const solid = useSharedValue(0);
  useAnimatedReaction(
    () => scrollY.value > HERO_H - topH - 10,
    (on, prev) => {
      if (on === prev) return;
      solid.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 220 });
    },
  );

  // Hero: stretches on pull-down; on scroll it sinks (x0.45), eases its zoom and takes a navy tint.
  const heroImg = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (reduced) return { transform: [{ translateY: Math.min(y, 0) }] };
    if (y < 0) return { transform: [{ translateY: y / 2 }, { scale: 1 + -y / HERO_H }] };
    return { transform: [{ translateY: y * 0.45 }, { scale: interpolate(y, [0, HERO_H], [1.08, 1], Extrapolation.CLAMP) }] };
  });
  const heroTint = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, HERO_H * 0.8], [0, 0.55], Extrapolation.CLAMP) }));

  // Header: white bar + title fade in; title slides up 12pt into place; reading-progress line.
  const barStyle = useAnimatedStyle(() => ({ opacity: solid.value }));
  const barTitle = useAnimatedStyle(() => ({ opacity: solid.value, transform: [{ translateY: 12 * (1 - solid.value) }] }));
  const progress = useAnimatedStyle(() => {
    const max = Math.max(1, contentH.value - viewportH.value);
    return { transform: [{ scaleX: Math.min(1, Math.max(0, scrollY.value / max)) }] };
  });

  // Big title and employer row recede as they scroll under the header.
  const titleBlock = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - topH - 70, HERO_H - topH], [1, 0], Extrapolation.CLAMP),
  }));

  // Action bar slides up once on mount.
  const bar = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) bar.value = withDelay(250, withTiming(1, { duration: 500, easing: easings.out }));
  }, [reduced, bar]);
  const actionStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - bar.value) * 100 }] }));

  return (
    <View style={s.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor="#fff" colors={[colorsNew.primary]} progressViewOffset={topH} /> : undefined}
      >
        {/* hero */}
        <View style={s.hero} accessible accessibilityRole="image" accessibilityLabel={job.imageUri ? `Photo for ${job.title}` : 'No photo for this job'}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImg]}>
            {job.imageUri
              ? <Image source={{ uri: job.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <PhotoPlaceholder />}
          </Animated.View>
          <LinearGradient colors={['rgba(20,50,74,0.45)', 'transparent']} style={s.heroTopShade} pointerEvents="none" />
          <Animated.View style={[StyleSheet.absoluteFill, s.heroTint, heroTint]} pointerEvents="none" />
        </View>

        {/* white sheet overlapping the hero */}
        <View style={s.sheet}>
          <Animated.View style={titleBlock}>
            <Reveal index={0}>
              <TextNew variant="hero" accessibilityRole="header">{job.title}</TextNew>
            </Reveal>
            <Reveal index={1}>
              <PressableScaleNew
                onPress={onAboutEmployer}
                disabled={!onAboutEmployer || !job.employerId}
                accessibilityRole="button"
                accessibilityLabel={`${copy.job.aboutEmployer}: ${job.employerName}`}
                style={s.employerRow}
              >
                <View style={s.employerTile}><TextNew variant="caption" heading weight="extrabold" color="#fff">{job.employerInitials}</TextNew></View>
                <TextNew variant="meta" color={colorsNew.muted} numberOfLines={1} style={s.flex}>{job.employerName} · {job.locationLabel}</TextNew>
              </PressableScaleNew>
            </Reveal>
          </Animated.View>

          {/* key facts: custom icons, hairline separators, no boxes */}
          <View style={s.facts}>
            <Fact icon="pay" label={copy.job.pay} value={job.payLabel} index={0} />
            <View style={s.vRule} />
            <Fact icon="jobType" label={copy.job.type} value={job.typeLabel} index={1} />
            {job.positionsTotal != null && job.positionsTotal > 0 && (
              <>
                <View style={s.vRule} />
                <Fact
                  icon="positions"
                  label={copy.job.positions}
                  value={`${positionsAccepted}/${job.positionsTotal}`}
                  index={2}
                  a11y={`${copy.job.positions}: ${positionsAccepted} of ${job.positionsTotal} filled`}
                />
              </>
            )}
          </View>
          <Reveal index={5}><PositionsBarNew left={job.positionsLeft} total={job.positionsTotal} maxWidth={9999} /></Reveal>
        </View>

        <ScrollSection title={copy.job.location} glyph="location" scrollY={scrollY} viewportH={viewportH}>
          {showMap && (mapSlot ?? <MiniMapNew />)}
          <PressableScaleNew
            onPress={onPressLocation}
            disabled={!onPressLocation}
            accessibilityRole={onPressLocation ? 'button' : 'text'}
            accessibilityLabel={`${copy.job.location}: ${job.locationLabel}${job.addressNote ? `, ${job.addressNote}` : ''}`}
            style={s.locRow}
          >
            <SectionIcon name="nearby" size={26} />
            <View style={s.flex}>
              <TextNew variant="title" weight="semibold">{job.locationLabel}</TextNew>
              {!!job.addressNote && <TextNew variant="meta" color={colorsNew.muted}>{job.addressNote}</TextNew>}
            </View>
            {onPressLocation ? <AppIconNew name="chev" size={18} color={colorsNew.muted} /> : null}
          </PressableScaleNew>
        </ScrollSection>

        <ScrollSection title={copy.job.details} glyph="details" scrollY={scrollY} viewportH={viewportH}>
          <AccordionNew title={copy.job.description}><TextNew variant="body" color={colorsNew.muted}>{job.description}</TextNew></AccordionNew>
          <AccordionNew title={copy.job.requirements}>
            {job.requirements.map((r, i) => (
              <View key={i} style={s.reqRow}>
                <View style={s.reqDot} />
                <TextNew variant="body" color={colorsNew.muted} style={s.flex}>{r}</TextNew>
              </View>
            ))}
          </AccordionNew>
        </ScrollSection>

        {!!job.employerAbout && (
          <ScrollSection title="About this employer" glyph="employer" scrollY={scrollY} viewportH={viewportH}>
            <View style={s.about}>
              <TextNew variant="body" color={colorsNew.muted}>{job.employerAbout}</TextNew>
            </View>
          </ScrollSection>
        )}
      </Animated.ScrollView>

      {/* collapsing header: floating buttons over the photo, then a solid white bar with the title */}
      <View style={[s.header, { height: topH, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, s.headerBg, barStyle]} pointerEvents="none" />
        <HeaderButton icon="back" label={copy.common.back} onPress={onBack} solid={solid} />
        <Animated.View style={[s.headerTitle, barTitle]} pointerEvents="none">
          <TextNew variant="title" heading weight="bold" numberOfLines={1} align="center">{job.title}</TextNew>
        </Animated.View>
        {onShare ? <HeaderButton icon="send" label="Share this job" onPress={onShare} solid={solid} /> : <View style={s.hBtnHit} />}
        <Animated.View style={[s.progressTrack, barStyle]} pointerEvents="none">
          <Animated.View style={[s.progressFill, progress]} />
        </Animated.View>
      </View>

      {/* sticky action bar */}
      <Animated.View style={[s.actions, shadows.nav, { paddingBottom: 12 + insets.bottom }, actionStyle]}>
        <View style={s.heartWrap}><HeartButtonNew liked={job.liked} onPress={onToggleLike} /></View>
        <ButtonNew iconOnly variant="tint" leftIcon="bld" onPress={onAboutEmployer} accessibilityLabel={copy.job.aboutEmployer} />
        <ButtonNew sweep label={applyLabel ?? copy.job.apply} onPress={applyDisabled ? undefined : onApply} disabled={applyDisabled} style={s.flex} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colorsNew.white },
  flex: { flex: 1 },
  hero: { height: HERO_H, overflow: 'hidden', backgroundColor: '#D2E1E6' },
  heroTopShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  heroTint: { backgroundColor: palette.navy },
  sheet: { marginTop: -26, backgroundColor: colorsNew.white, borderTopLeftRadius: radiusNew.sheet, borderTopRightRadius: radiusNew.sheet, paddingTop: 22, paddingHorizontal: 16 },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, minHeight: 32 },
  employerTile: { width: 28, height: 28, borderRadius: 9, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', marginTop: 18, marginBottom: 12, marginHorizontal: -12 },
  fact: { flex: 1 },
  factInner: { paddingHorizontal: 12, gap: 4 },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vRule: { width: StyleSheet.hairlineWidth, backgroundColor: colorsNew.border },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 28, marginBottom: 12 },
  sectionRule: { flex: 1, height: 1 },
  miniMap: { height: 128, borderRadius: radiusNew.card, overflow: 'hidden', marginHorizontal: 16 },
  mapPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -7, marginTop: -7 },
  mapPulse: { position: 'absolute', left: -9, top: -9 },
  mapDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: palette.navy, borderWidth: 3, borderColor: colorsNew.white },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 12, minHeight: 48 },
  reqRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  reqDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: palette.cyan },
  about: { paddingHorizontal: 16, marginBottom: 12 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, zIndex: 20 },
  headerBg: { backgroundColor: colorsNew.white, shadowColor: '#12303C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 8 },
  headerTitle: { flex: 1, paddingHorizontal: 6 },
  hBtnHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: palette.line },
  progressFill: { height: 2, backgroundColor: palette.cyan, transformOrigin: 'left' },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colorsNew.white, zIndex: 30 },
  heartWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colorsNew.tint },
});
