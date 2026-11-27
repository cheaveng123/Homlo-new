/**
 * Home page building blocks, drawn from the "Homlo Home – Custom Icon Preview" mockup.
 * Pure UI: every component takes the same JobSummaryNew view-model the adapter already builds.
 */
import { ReactNode, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TextNew } from '../TextNew';
import { PressableScaleNew } from '../PrimitivesNew';
import { PhotoPlaceholder } from '@/src/design/primitives';
import { AdsIcon } from '@/src/components/icons/AdsIcon';
import { SMOOTH } from '@/src/design/motion';
import { useCopyNew } from '../../theme/copyNew';
import { motionNew } from '../../theme/motionNew';
import { JobSummaryNew } from '../../types/jobNew';

/* ---------- palette (mockup tokens) ---------- */
export const homeInk = {
  navy: '#14324A',
  muted: '#6A7C84',
  cyan: '#0891B2',
  cyanDeep: '#0B6F8A',
  amber: '#F5A524',
  amberDeep: '#A8620B',
  line: '#E6EDEF',
  icon: '#4A6072',
  pin: '#5D7480',
  faint: '#AAC3CB',
  favBg: '#EEF3F4',
} as const;

/* ---------- small glyphs ---------- */
function ChevronRightIcon({ size = 14, color = homeInk.cyan }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="m5 2.5 4.5 4.5L5 11.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SmallPin({ known }: { known: boolean }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      {known ? (
        <>
          <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke={homeInk.pin} strokeWidth={1.5} />
          <Circle cx={8} cy={6.5} r={1.6} fill={homeInk.pin} />
        </>
      ) : (
        <>
          <Path d="M8 1.5a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5Z" stroke="#8FA3AA" strokeWidth={1.5} strokeDasharray="2.2 1.8" />
          <Path d="M6.6 6a1.4 1.4 0 1 1 2 1.2c-.4.2-.6.5-.6 1M8 10v.1" stroke={homeInk.pin} strokeWidth={1.4} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

/* ---------- section titles: quiet monochrome line icons ---------- */
export type HomeSectionGlyph = 'jobField' | 'jobType' | 'recommended' | 'nearby' | 'popular' | 'explore';

function SectionGlyph({ name }: { name: HomeSectionGlyph }) {
  const s = { stroke: homeInk.icon, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const soft = { fill: homeInk.icon, fillOpacity: 0.28 };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'jobField' && (<>
        <Path {...s} d="M3.5 12.2V5.5A2 2 0 0 1 5.5 3.5h6.7a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-5.7 5.7a2 2 0 0 1-2.8 0L4.1 13.6a2 2 0 0 1-.6-1.4Z" />
        <Circle cx={8.2} cy={8.2} r={1.5} fill={homeInk.icon} />
      </>)}
      {name === 'jobType' && (<>
        <Path {...soft} d="M12 12V3.5A8.5 8.5 0 0 1 20.5 12Z" />
        <Circle {...s} cx={12} cy={12} r={8.5} />
        <Path {...s} d="M12 7.5V12l3 1.8" />
      </>)}
      {name === 'recommended' && (<>
        <Rect {...s} x={3.5} y={5} width={17} height={14} rx={3} />
        <Path {...s} d="m12 8.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4Z" />
      </>)}
      {name === 'nearby' && (<>
        <Path {...s} d="M12 3a6.5 6.5 0 0 1 6.5 6.5c0 4.8-6.5 11-6.5 11s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3Z" />
        <Circle {...s} cx={12} cy={9.5} r={2.3} />
      </>)}
      {name === 'popular' && (<>
        <Path {...s} d="M12 3c.6 4.5 6 6 6 11a6 6 0 0 1-12 0c0-2.6 1.4-4.2 3-5.5.4 1.8 1 2.5 1.8 3C11 10.5 11.5 6.5 12 3Z" />
        <Path {...soft} d="M12 14.5c1.3 1.3 2.2 2.1 2.2 3.5a2.2 2.2 0 0 1-4.4 0c0-1.4.9-2.2 2.2-3.5Z" />
      </>)}
      {name === 'explore' && (<>
        <Circle {...s} cx={12} cy={12} r={8.5} />
        <Path {...soft} d="M15.8 8.2 13.5 13.5 8.2 15.8 10.5 10.5Z" />
        <Path {...s} d="M15.8 8.2 13.5 13.5 8.2 15.8 10.5 10.5Z" />
      </>)}
    </Svg>
  );
}

/** "Title  [icon] ———————  See all >" */
export function SectionHeaderHome({ title, glyph, actionLabel, onAction }: {
  title: string; glyph: HomeSectionGlyph; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={st.sh}>
      <TextNew variant="header" heading weight="extrabold" color={homeInk.navy} style={st.shTitle}>{title}</TextNew>
      <SectionGlyph name={glyph} />
      <LinearGradient colors={[homeInk.line, 'rgba(230,237,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.shLine} />
      {!!actionLabel && !!onAction && (
        <PressableScaleNew onPress={onAction} accessibilityLabel={`${actionLabel} ${title}`} style={st.sa}>
          <TextNew variant="body" heading weight="bold" color={homeInk.cyan} style={{ fontSize: 15, lineHeight: 20 }}>{actionLabel}</TextNew>
          <ChevronRightIcon />
        </PressableScaleNew>
      )}
    </View>
  );
}

/* ---------- Job type cards (2x2 grid) ---------- */
type TypeTheme = { bg: string; ink: string; glow: { color: string; opacity: number } };
/** Job type card colors, shared with the Job type page picker. */
export const TYPE_THEME: Record<string, TypeTheme> = {
  'part-time': { bg: '#FDEED0', ink: '#4A2A05', glow: { color: '#FFFFFF', opacity: 0.55 } },
  'full-time': { bg: '#14324A', ink: '#FFFFFF', glow: { color: '#FFFFFF', opacity: 0.1 } },
  remote: { bg: '#DFF3F8', ink: '#0B6F8A', glow: { color: '#FFFFFF', opacity: 0.7 } },
  volunteer: { bg: '#DFF3F8', ink: '#0B6F8A', glow: { color: '#FFFFFF', opacity: 0.7 } },
  weekends: { bg: '#E6EDF1', ink: '#14324A', glow: { color: '#FFFFFF', opacity: 0.7 } },
};
const TYPE_FALLBACK: TypeTheme[] = [TYPE_THEME['part-time'], TYPE_THEME['full-time'], TYPE_THEME.remote, TYPE_THEME.weekends];

/** One 5s loop shared by the card illustrations (smooth, no bounce). */
function useLoop(reduced: boolean, delay = 0) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      return;
    }
    t.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 1300, easing: SMOOTH }),
      withTiming(1, { duration: 2700 }),
      withTiming(0, { duration: 1000, easing: SMOOTH }),
    ), -1));
  }, [reduced, delay, t]);
  return t;
}

function PartTimeArt({ play = true }: { play?: boolean }) {
  const reduced = !!useReducedMotion() || !play;
  const t = useLoop(reduced);
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : (1 - t.value) * 18 * (70 / 64) }] }));
  return (
    <View style={st.art}>
      {/* sun rises behind the horizon (clipped at y=46 of 64) */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: 70, height: 70 * (46 / 64), overflow: 'hidden' }}>
        <Animated.View style={[{ width: 70, height: 70 }, rise]}>
          <Svg width={70} height={70} viewBox="0 0 64 64">
            <Path d="M16 46a16 16 0 0 1 32 0Z" fill="#F5A524" />
            <Path d="M14.7 36L8.6 32.5M22 28.7L18.5 22.6M32 26L32 19M42 28.7L45.5 22.6M49.3 36L55.4 32.5" stroke="#E8870F" strokeWidth={2.6} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
      </View>
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Path d="M4 46h56" stroke="#4A2A05" strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M14 53h36" stroke="#4A2A05" strokeOpacity={0.3} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function FullTimeArt({ play = true, onLight = false }: { play?: boolean; onLight?: boolean }) {
  const reduced = !!useReducedMotion() || !play;
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(r);
      return;
    }
    r.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1, false);
  }, [reduced, r]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={st.art}>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={70} height={70} viewBox="0 0 64 64">
          <Path d="M49 32L56 32M44 20L49 15M32 15L32 8M20 20L15 15M15 32L8 32M20 44L15 49M32 49L32 56M44 44L49 49" stroke={onLight ? '#E8870F' : '#FFD48A'} strokeOpacity={onLight ? 0.75 : 1} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Circle cx={32} cy={32} r={11.5} fill="#F5A524" />
        <Path d="M24 29a9 9 0 0 1 6-5" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

/** Remote: laptop with a signal arc that fades in on the shared loop. */
function RemoteArt({ play = true }: { play?: boolean }) {
  const reduced = !!useReducedMotion() || !play;
  const t = useLoop(reduced, 300);
  const wave = useAnimatedStyle(() => ({ opacity: reduced ? 1 : 0.25 + t.value * 0.75 }));
  return (
    <View style={st.art}>
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Rect x={14} y={30} width={34} height={22} rx={3} fill="#14324A" />
        <Rect x={17.5} y={33.5} width={27} height={15} rx={1.5} fill="#0891B2" />
        <Rect x={8} y={51} width={46} height={5} rx={2.5} fill="#14324A" />
        <Circle cx={31} cy={41} r={2.4} fill="#FFFFFF" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, wave]}>
        <Svg width={70} height={70} viewBox="0 0 64 64">
          <Path d="M23 23.5a11 11 0 0 1 16 0" stroke="#F5A524" strokeWidth={2.6} strokeLinecap="round" fill="none" />
          <Path d="M18 18.5a18 18 0 0 1 26 0" stroke="#F5A524" strokeOpacity={0.6} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Volunteer: two cupped hands holding a heart (giving your time).
 * Soft gradients give a realistic, tactile look: glossy coral heart with a
 * highlight and inner shade, shaded warm hands with raised thumbs and finger
 * creases, navy and cyan cuffs, one amber sparkle. Loop: the heart lifts gently
 * and the sparkle twinkles. 64x64 drawing shown in the shared 70pt box.
 */
const VOL = {
  handL: 'M5 49 C12 44.5 22 42 31.5 41.8 C34.2 41.8 35 44.6 32.8 45.8 C30 47.4 26.5 49.6 24 52 C20.5 55.4 15 58.6 10.5 61 Z',
  handR: 'M 59 49 C 52 44.5 42 42 32.5 41.8 C 29.8 41.8 29 44.6 31.2 45.8 C 34 47.4 37.5 49.6 40 52 C 43.5 55.4 49 58.6 53.5 61 Z',
  thumbL: 'M15 46 C16.4 42 19.4 39.6 22.4 39.8 C24.2 40 24.2 42 22.9 42.9 C21 44.1 19 45.4 17.6 47.4 Z',
  thumbR: 'M 49 46 C 47.6 42 44.6 39.6 41.6 39.8 C 39.8 40 39.8 42 41.1 42.9 C 43 44.1 45 45.4 46.4 47.4 Z',
  creaseL: 'M20.5 45.6 C24.5 44.6 28.5 44.2 32.4 44.4 M17.5 48.8 C21.5 47.5 25.5 46.7 30.4 46.4',
  creaseR: 'M 43.5 45.6 C 39.5 44.6 35.5 44.2 31.6 44.4 M 46.5 48.8 C 42.5 47.5 38.5 46.7 33.6 46.4',
  cuffL: 'M0.5 51 L7 46.6 L12.6 58 L6 62.5 Z',
  cuffR: 'M 63.5 51 L 57 46.6 L 51.4 58 L 58 62.5 Z',
  bandL: 'M5.6 47.6 L7 46.6 L12.6 58 L11.2 59 Z',
  bandR: 'M 58.4 47.6 L 57 46.6 L 51.4 58 L 52.8 59 Z',
  heart: 'M32 44.5 C21.5 37.5 17.8 30.8 21.6 25.4 C25 20.8 30.1 21.9 32 25.9 C33.9 21.9 39 20.8 42.4 25.4 C46.2 30.8 42.5 37.5 32 44.5 Z',
  heartShade: 'M32 44.5 C26 40.4 22.2 36.6 20.6 33 C24.8 37 29 39.2 32 40 C35 39.2 39.2 37 43.4 33 C41.8 36.6 38 40.4 32 44.5 Z',
};

function VolunteerArt({ play = true }: { play?: boolean }) {
  const reduced = !!useReducedMotion() || !play;
  const t = useLoop(reduced, 100);
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : -t.value * 2.2 }, { scale: reduced ? 1 : 1 + t.value * 0.04 }],
  }));
  const twinkle = useAnimatedStyle(() => ({ opacity: reduced ? 1 : 0.35 + t.value * 0.65 }));
  return (
    <View style={st.art}>
      {/* back layer: cuffs, hands, creases, the heart's soft shadow on the fingers */}
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="volSkinL" x1="0.1" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#F8D2AE" />
            <Stop offset="0.6" stopColor="#E7AC80" />
            <Stop offset="1" stopColor="#C98557" />
          </SvgLinearGradient>
          <SvgLinearGradient id="volSkinR" x1="0.9" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#EDBB91" />
            <Stop offset="0.6" stopColor="#D9996B" />
            <Stop offset="1" stopColor="#B9754A" />
          </SvgLinearGradient>
          <RadialGradient id="volShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#6E3214" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#6E3214" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={VOL.cuffR} fill="#14324A" />
        <Path d={VOL.bandR} fill="#0891B2" />
        <Path d={VOL.handR} fill="url(#volSkinR)" />
        <Path d={VOL.creaseR} stroke="#A9653D" strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round" fill="none" />
        <Path d={VOL.cuffL} fill="#14324A" />
        <Path d={VOL.bandL} fill="#0891B2" />
        <Path d={VOL.handL} fill="url(#volSkinL)" />
        <Path d={VOL.creaseL} stroke="#B26E44" strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round" fill="none" />
        <Path d="M8 47.6C14 44.4 21 43 28 42.8" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.1} strokeLinecap="round" fill="none" />
        <Ellipse cx={32} cy={43.6} rx={9} ry={2.2} fill="url(#volShadow)" />
      </Svg>
      {/* heart resting in the hands */}
      <Animated.View style={[StyleSheet.absoluteFill, lift]}>
        <Svg width={70} height={70} viewBox="0 0 64 64">
          <Defs>
            <SvgLinearGradient id="volHeart" x1="0.25" y1="0" x2="0.75" y2="1">
              <Stop offset="0" stopColor="#FF9578" />
              <Stop offset="0.5" stopColor="#EF6A4C" />
              <Stop offset="1" stopColor="#C23E28" />
            </SvgLinearGradient>
          </Defs>
          <Path d={VOL.heart} fill="url(#volHeart)" />
          <Path d={VOL.heartShade} fill="#9E2F1C" fillOpacity={0.32} />
          <Path d="M24.2 27.2C25.4 25 27.6 24.5 29.2 25.5" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.9} strokeLinecap="round" fill="none" />
          <Circle cx={24.4} cy={30.4} r={1} fill="#FFFFFF" fillOpacity={0.6} />
        </Svg>
      </Animated.View>
      {/* front layer: thumbs wrap the heart */}
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        {/* gradients are scoped to each Svg, so this layer carries its own copies */}
        <Defs>
          <SvgLinearGradient id="volThumbL" x1="0.1" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#F8D2AE" />
            <Stop offset="1" stopColor="#DDA176" />
          </SvgLinearGradient>
          <SvgLinearGradient id="volThumbR" x1="0.9" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#EDBB91" />
            <Stop offset="1" stopColor="#CE8E60" />
          </SvgLinearGradient>
        </Defs>
        <Path d={VOL.thumbR} fill="url(#volThumbR)" />
        <Path d={VOL.thumbL} fill="url(#volThumbL)" />
      </Svg>
      {/* sparkle */}
      <Animated.View style={[StyleSheet.absoluteFill, twinkle]}>
        <Svg width={70} height={70} viewBox="0 0 64 64">
          <Path d="M49 9.5C49.5 12.4 50.6 13.5 53.5 14C50.6 14.5 49.5 15.6 49 18.5C48.5 15.6 47.4 14.5 44.5 14C47.4 13.5 48.5 12.4 49 9.5Z" fill="#F5A524" />
          <Circle cx={15} cy={17} r={1.4} fill="#F5A524" fillOpacity={0.7} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function WeekendsArt({ play = true }: { play?: boolean }) {
  const reduced = !!useReducedMotion() || !play;
  const t = useLoop(reduced, 200);
  const glow = useAnimatedStyle(() => ({ opacity: reduced ? 1 : 0.4 + t.value * 0.6 }));
  const cols = [14, 19.4, 24.8, 30.2, 35.6];
  const rows = [30, 36.6, 43.2];
  return (
    <View style={st.art}>
      <Svg width={70} height={70} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Rect x={20} y={9} width={3.6} height={9} rx={1.8} fill="#14324A" />
        <Rect x={40.4} y={9} width={3.6} height={9} rx={1.8} fill="#14324A" />
        <Rect x={10} y={14} width={44} height={40} rx={6} fill="#FFFFFF" stroke="#14324A" strokeWidth={2.4} />
        <Path d="M10 20a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v5H10Z" fill="#14324A" />
        {rows.map((y) => cols.map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={4.2} height={4.6} rx={1.2} fill="#D3DEE3" />))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Svg width={70} height={70} viewBox="0 0 64 64">
          {rows.map((y) => [41, 46.4].map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={4.2} height={4.6} rx={1.2} fill="#F5A524" />))}
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * `play` false keeps the illustration static (only the selected type loops on the Job type page).
 * `onLight` adapts colors drawn for a dark card (Full-time's pale rays) to a white background.
 */
export function TypeArt({ id, play = true, onLight = false }: { id: string; play?: boolean; onLight?: boolean }) {
  switch (id) {
    case 'part-time': return <PartTimeArt play={play} />;
    case 'full-time': return <FullTimeArt play={play} onLight={onLight} />;
    case 'remote': return <RemoteArt play={play} />;
    case 'volunteer': return <VolunteerArt play={play} />;
    case 'weekends': return <WeekendsArt play={play} />;
    default: return null;
  }
}

export function JobTypeCardHome({ id, label, index, onPress }: { id: string; label: string; index: number; onPress: () => void }) {
  const theme = TYPE_THEME[id] ?? TYPE_FALLBACK[index % TYPE_FALLBACK.length];
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.97} accessibilityLabel={label}
      style={[st.ty, { backgroundColor: theme.bg }]}>
      {/* soft glow in the bottom-right corner */}
      <View pointerEvents="none" style={st.tyGlowWrap}>
        <Svg width={130} height={130} viewBox="0 0 130 130">
          <Defs>
            <RadialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme.glow.color} stopOpacity={theme.glow.opacity} />
              <Stop offset="1" stopColor={theme.glow.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={65} cy={65} r={65} fill={`url(#glow-${id})`} />
        </Svg>
      </View>
      {/* top highlight */}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.tyHi} />
      <TextNew variant="section" heading weight="extrabold" color={theme.ink} style={{ fontSize: 18, lineHeight: 22, zIndex: 1, maxWidth: '62%' }} numberOfLines={2}>{label}</TextNew>
      <View pointerEvents="none" style={st.tyArt}><TypeArt id={id} /></View>
    </PressableScaleNew>
  );
}

/* ---------- positions: little seat figures + "f/n positions" ---------- */
function Seat({ on }: { on: boolean }) {
  const fill = on ? homeInk.navy : 'none';
  const stroke = on ? homeInk.navy : homeInk.faint;
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16">
      <Circle cx={8} cy={4.6} r={2.9} fill={fill} stroke={stroke} strokeWidth={1.3} />
      <Path d="M2.4 14.2c0-3 2.3-5 5.6-5s5.6 2 5.6 5Z" fill={fill} stroke={stroke} strokeWidth={1.3} />
    </Svg>
  );
}

export function SeatsLineHome({ left, total }: { left: number; total: number }) {
  const copy = useCopyNew();
  if (total <= 0) return null;
  const filled = Math.max(0, Math.min(total, total - left));
  const warm = total - filled <= 1;
  const shown = Math.min(total, 4);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: shown }, (_, k) => <Seat key={k} on={k < Math.min(filled, shown)} />)}
      </View>
      <TextNew variant="meta" heading weight="bold" color={warm ? homeInk.amberDeep : homeInk.cyanDeep} style={{ fontSize: 13.5, lineHeight: 18 }}>
        {copy.positions(filled, total)}
      </TextNew>
    </View>
  );
}

function LocationHome({ label }: { label: string }) {
  const known = !!label && label !== 'Location to be confirmed';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <SmallPin known={known} />
      <TextNew variant="body" color={homeInk.muted} numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 19 }}>{label}</TextNew>
    </View>
  );
}

/* ---------- save heart on photos: white outline, fills white when saved ---------- */
function PhotoHeart({ liked, onPress }: { liked?: boolean; onPress?: () => void }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (liked && !reduced) s.value = withSequence(withTiming(1.08, { duration: 140 }), withTiming(1, { duration: 220, easing: SMOOTH }));
  }, [liked, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PressableScaleNew onPress={onPress} accessibilityLabel="Save" accessibilityState={{ selected: !!liked }} style={st.heart}>
      <Animated.View style={[st.heartShadow, a]}>
        <Svg width={26} height={26} viewBox="0 0 40 40">
          <Path d="M20 35S5 26 5 15.5A8.5 8.5 0 0 1 20 11a8.5 8.5 0 0 1 15 4.5C35 26 20 35 20 35Z"
            fill={liked ? '#FFFFFF' : 'rgba(255,255,255,0.12)'} stroke="#FFFFFF" strokeWidth={2.6} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </PressableScaleNew>
  );
}

function Photo({ job, width, height, radius, compact, children }: {
  job: JobSummaryNew; width: number; height: number; radius: number; compact?: boolean; children?: ReactNode;
}) {
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }}>
      {/* placeholder sits underneath, so a photo that fails to load falls back to it */}
      <PhotoPlaceholder compact={compact} style={{ flex: 1 }} />
      {/* expo-image: decodes off the main thread and caches to memory + disk, so photos
          don't stall the scroll or re-download every time the screen mounts */}
      {!!job.imageUri && (
        <Image key={job.id} source={{ uri: job.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      {children}
    </View>
  );
}

function AdMark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Sponsored listing">
      <AdsIcon size={16} color={homeInk.amberDeep} accent={homeInk.amber} />
      <TextNew variant="meta" heading weight="extrabold" color={homeInk.amberDeep}>Ad</TextNew>
    </View>
  );
}

/* ---------- photo cards: Recommended (compact) and Explore (big, with location + seats) ---------- */
export function JobCardHome({ job, big, onPress, onToggleLike }: {
  job: JobSummaryNew; big?: boolean; onPress: () => void; onToggleLike: () => void;
}) {
  const w = big ? 156 : 168;
  return (
    <PressableScaleNew scaleTo={motionNew.pressCard} onPress={onPress} accessibilityLabel={job.title} style={{ width: w }}>
      <Photo job={job} width={w} height={big ? 164 : 124} radius={big ? 24 : 22}>
        <View style={{ position: 'absolute', top: 4, right: 4 }}><PhotoHeart liked={job.liked} onPress={onToggleLike} /></View>
        {job.boosted && (
          <View style={st.cardAd}><AdMark /></View>
        )}
      </Photo>
      <View style={{ paddingTop: 9, paddingHorizontal: 4 }}>
        <TextNew variant="title" heading weight="bold" color={homeInk.navy} numberOfLines={1} style={{ fontSize: 16.5, lineHeight: 22 }}>{job.title}</TextNew>
        {big && <LocationHome label={job.locationLabel} />}
        {big && <SeatsLineHome left={job.positionsLeft} total={job.positionsTotal} />}
        <TextNew variant="title" heading weight="extrabold" color={homeInk.navy} style={{ fontSize: 17, lineHeight: 22, marginTop: 5 }}>{job.payLabel}</TextNew>
      </View>
    </PressableScaleNew>
  );
}

/* ---------- list row: thumb · title/location/seats · (Ad) pay ---------- */
export function JobRowHome({ job, onPress }: { job: JobSummaryNew; onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={job.title} style={st.row}>
      <Photo job={job} width={62} height={62} radius={16} compact />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextNew variant="title" heading weight="bold" color={homeInk.navy} numberOfLines={1} style={{ fontSize: 17, lineHeight: 22 }}>{job.title}</TextNew>
        <LocationHome label={job.locationLabel} />
        <SeatsLineHome left={job.positionsLeft} total={job.positionsTotal} />
      </View>
      <View style={st.rowRight}>
        {job.boosted ? <AdMark /> : <View />}
        <TextNew variant="title" heading weight="extrabold" color={homeInk.navy} style={{ fontSize: 17, lineHeight: 22 }}>{job.payLabel}</TextNew>
      </View>
    </PressableScaleNew>
  );
}

/* ---------- employer call-to-action ---------- */
function PeopleArt() {
  const reduced = !!useReducedMotion();
  const t = useLoop(reduced, 400);
  const back = useAnimatedStyle(() => ({ opacity: reduced ? 1 : t.value, transform: [{ translateX: reduced ? 0 : (1 - t.value) * 11 }] }));
  const front = useAnimatedStyle(() => ({ opacity: reduced ? 1 : t.value, transform: [{ translateX: reduced ? 0 : (t.value - 1) * 11 }] }));
  const plus = useAnimatedStyle(() => ({ opacity: reduced ? 1 : t.value, transform: [{ scale: reduced ? 1 : 0.4 + t.value * 0.6 }] }));
  return (
    <View style={{ width: 56, height: 56 }}>
      <Animated.View style={[StyleSheet.absoluteFill, back]}>
        <Svg width={56} height={56} viewBox="0 0 40 40">
          <Circle cx={26.5} cy={14} r={5.3} fill="#2BB0CC" />
          <Path d="M17.5 34v-3.6c0-4.5 3.7-7.6 9-7.6s9 3.1 9 7.6V34Z" fill="#2BB0CC" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, front]}>
        <Svg width={56} height={56} viewBox="0 0 40 40">
          <Circle cx={15} cy={17} r={6} fill="#E6F5F9" stroke="#183A55" strokeWidth={2} />
          <Path d="M3.3 37v-4.4C3.3 27 8 23.8 15 23.8s11.7 3.2 11.7 8.8V37Z" fill="#E6F5F9" stroke="#183A55" strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: (27.5 / 40) * 56, top: (2.5 / 40) * 56, width: 14, height: 14 }, plus]}>
        <Svg width={14} height={14} viewBox="27.5 2.5 10 10">
          <Circle cx={32.5} cy={7.5} r={5} fill="#F5A524" stroke="#183A55" strokeWidth={2} />
          <Path d="M32.5 5v5M30 7.5h5" stroke="#14324A" strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function HiringCardHome({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={title} style={st.cta}>
      <LinearGradient colors={['#183A55', '#0F2A40']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(43,176,204,0)', '#2BB0CC', 'rgba(43,176,204,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.ctaHi} />
      <PeopleArt />
      <View style={{ flex: 1 }}>
        <TextNew variant="header" heading weight="extrabold" color="#FFFFFF" style={{ fontSize: 19, lineHeight: 24 }}>{title}</TextNew>
        <TextNew variant="body" weight="medium" color="rgba(255,255,255,0.88)" style={{ fontSize: 14.5, lineHeight: 19, marginTop: 3 }}>{body}</TextNew>
      </View>
    </PressableScaleNew>
  );
}

const st = StyleSheet.create({
  sh: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6, marginBottom: 12 },
  shTitle: { fontSize: 21, lineHeight: 26, letterSpacing: -0.2 },
  shLine: { flex: 1, height: 1 },
  sa: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32 },
  ty: { flex: 1, height: 106, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center', overflow: 'hidden' },
  tyGlowWrap: { position: 'absolute', right: -26, bottom: -34, width: 130, height: 130 },
  tyHi: { position: 'absolute', left: '14%', right: '14%', top: 0, height: 2 },
  tyArt: { position: 'absolute', right: -2, bottom: -4, width: 70, height: 70, zIndex: 1 },
  art: { width: 70, height: 70 },
  heart: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  heartShadow: { shadowColor: '#12303C', shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  cardAd: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 2 },
  cta: { marginHorizontal: 16, marginTop: 22, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  ctaHi: { position: 'absolute', left: '10%', right: '10%', top: 0, height: 2 },
});
