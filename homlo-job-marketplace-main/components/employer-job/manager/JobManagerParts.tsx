/**
 * Employer job page, visual layer only. Every handler and value comes from the screen.
 *   JobHero         photo (or navy gradient) header with title, place, pay and status
 *   StatsStrip      floating card: views, applicants, unread
 *   HiringProgress  ring + seats for positions filled
 *   BoostSpotlight  navy card with an amber glow and the boost action
 *   StatusSwitch    sliding segmented filter with counts
 *   ApplicantItem   applicant card with status, note and actions
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import { BlurView } from '@react-native-community/blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { SMOOTH } from '@/src/design/motion';
import { haptic } from '@/lib/haptics';
import { AP, cardShadow, liftShadow } from '../applicants/tokens';
import { ChatGlyph, CheckGlyph, ClockGlyph, CrossGlyph, PinGlyph } from '../applicants/ApplicantGlyphs';
import { NoApplicationsArt } from '@/src/new/applications/NoApplicationsEmpty';

const F = { h: 'PlusJakartaSans_800ExtraBold', hb: 'PlusJakartaSans_700Bold', b: 'Inter_400Regular', m: 'Inter_500Medium', s: 'Inter_600SemiBold' };
const NAVY_GRAD = ['#21486A', '#14324A'] as const;

/* ───────── glyphs ───────── */

type GP = { size?: number; color?: string };
export const EyeGlyph = ({ size = 18, color = AP.cyanDeep }: GP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><Circle cx={12} cy={12} r={3} />
  </Svg>
);
export const PeopleGlyph = ({ size = 18, color = AP.cyanDeep }: GP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={9} cy={8} r={3.2} /><Path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><Path d="M16 4.9a3 3 0 0 1 0 6.2M18 14.3c1.7.6 2.8 2.2 3 4.7" />
  </Svg>
);
export const InboxGlyph = ({ size = 18, color = AP.amberDeep }: GP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 13.5 6.2 6.4A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.4L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" />
    <Path d="M4 13.5h4.2l1.3 2.2h5l1.3-2.2H20" />
  </Svg>
);
const BoltGlyph = ({ size = 22, color = AP.navy }: GP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M13.4 2.8 5.6 13.2h5.5l-1.3 8 7.9-10.6h-5.6Z" fill={color} /></Svg>
);
const SeatGlyph = ({ size = 14, color = '#fff' }: GP) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round"><Circle cx={12} cy={8} r={3.6} /><Path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Svg>
);

/* ───────── hero ───────── */

export function JobHero({ y, height, topInset, title, place, pay, unit, imageUrl, boosted }: {
  y: SharedValue<number>; height: number; topInset: number; title: string; place: string; pay: string; unit: string; imageUrl?: string | null; boosted: boolean;
}) {
  const media = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value < 0 ? y.value / 2 : y.value * 0.45 },
      { scale: y.value < 0 ? 1 + (-y.value / height) * 1.1 : 1 },
    ],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, height * 0.45], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: y.value > 0 ? y.value * 0.25 : 0 }],
  }));
  return (
    <View style={[s.hero, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, media]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <LinearGradient colors={['#0B7F99', '#14324A']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="jhGlow" cx="88%" cy="8%" rx="65%" ry="55%">
                  <Stop offset="0" stopColor="#3FC1DB" stopOpacity={0.55} /><Stop offset="1" stopColor="#3FC1DB" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#jhGlow)" />
              <Circle cx="92%" cy={topInset + 40} r={110} fill="none" stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1.2} />
              <Circle cx="92%" cy={topInset + 40} r={170} fill="none" stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={1.2} />
            </Svg>
          </>
        )}
        <LinearGradient colors={['rgba(11,27,38,0.35)', 'rgba(11,27,38,0.05)', 'rgba(11,27,38,0.82)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[s.heroBody, content]}>
        <View style={s.heroTags}>
          <View style={s.glassTag}><View style={s.liveDot} /><Text style={s.glassTagText}>Live</Text></View>
          {boosted && <View style={[s.glassTag, s.amberTag]}><BoltGlyph size={13} /><Text style={[s.glassTagText, { color: AP.navy }]}>Boosted</Text></View>}
        </View>
        <Text numberOfLines={2} style={s.heroTitle}>{title}</Text>
        <View style={s.heroRow}>
          <View style={s.heroPlace}><PinGlyph size={15} color="rgba(255,255,255,0.85)" /><Text numberOfLines={1} style={s.heroPlaceText}>{place}</Text></View>
          <View style={s.payPill}><Text style={s.payText}>{pay}</Text><Text style={s.payUnit}>{unit}</Text></View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ───────── floating stats ───────── */

function Stat({ glyph, value, label, warm }: { glyph: React.ReactNode; value: number; label: string; warm?: boolean }) {
  return (
    <View style={s.stat}>
      <View style={s.statIcon}>{glyph}</View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export function StatsStrip({ views, applicants, unread, style }: { views: number; applicants: number; unread: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.strip, liftShadow, style]}>
      <Stat glyph={<EyeGlyph size={30} color={AP.cyan} />} value={views} label="Views" />
      <View style={s.stripDiv} />
      <Stat glyph={<PeopleGlyph size={30} color={AP.cyan} />} value={applicants} label="Applicants" />
      <View style={s.stripDiv} />
      <Stat glyph={<InboxGlyph size={30} color={unread > 0 ? AP.amber : AP.cyan} />} value={unread} label="Unread" warm={unread > 0} />
    </View>
  );
}

/* ───────── hiring progress ───────── */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 78, STROKE = 8, RAD = (RING - STROKE) / 2, CIRC = 2 * Math.PI * RAD;

export function HiringProgress({ filled, total }: { filled: number; total: number }) {
  const reduced = useReducedMotion();
  const pct = total > 0 ? Math.min(1, filled / total) : 0;
  const p = useSharedValue(reduced ? pct : 0);
  useEffect(() => { p.value = reduced ? pct : withDelay(250, withTiming(pct, { duration: 900, easing: SMOOTH })); }, [p, pct, reduced]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - p.value) }));
  const open = Math.max(0, total - filled);
  const seats = Math.min(total, 8);
  return (
    <View style={[s.card, cardShadow]}>
      <View style={{ width: RING, height: RING }}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={RAD} stroke="#E3EEF1" strokeWidth={STROKE} fill="none" />
          <G rotation={-90} origin={`${RING / 2}, ${RING / 2}`}>
            <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RAD} stroke={AP.cyan} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${CIRC} ${CIRC}`} animatedProps={ring} />
          </G>
        </Svg>
        <View style={s.ringCenter}><Text style={s.ringNum}>{filled}<Text style={s.ringOf}>/{total}</Text></Text></View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.cardTitle}>Positions filled</Text>
        <Text style={s.cardSub}>{open === 0 ? 'Every seat is filled' : `${open} ${open === 1 ? 'seat' : 'seats'} still open`}</Text>
        <View style={s.seats}>
          {Array.from({ length: seats }, (_, i) => (
            <View key={i} style={[s.seat, i < filled ? s.seatOn : s.seatOpen]}><SeatGlyph size={12} color={i < filled ? '#fff' : AP.amberDeep} /></View>
          ))}
          {total > seats && <Text style={s.more}>+{total - seats}</Text>}
        </View>
      </View>
    </View>
  );
}

/* ───────── boost ───────── */

/** Clear glass card: soft amber and cyan light sits behind frosted glass, a thin bright
 *  rim catches the light, and a slow sheen crosses it every few seconds. */
export function BoostSpotlight({ onBoost }: { onBoost: () => void }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const sweep = useSharedValue(0);
  const drift = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(withSequence(withDelay(2600, withTiming(1, { duration: 1500, easing: SMOOTH })), withTiming(0, { duration: 0 })), -1, false);
    drift.value = withRepeat(withTiming(1, { duration: 6000, easing: SMOOTH }), -1, true);
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: SMOOTH }), withTiming(0, { duration: 1400, easing: SMOOTH })), -1, false);
  }, [reduced, sweep, drift, glow]);
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -180 + sweep.value * (w + 360) }, { rotate: '18deg' }] }));
  const amberBlob = useAnimatedStyle(() => ({ transform: [{ translateX: -12 * drift.value }, { translateY: 10 * drift.value }] }));
  const cyanBlob = useAnimatedStyle(() => ({ transform: [{ translateX: 14 * drift.value }, { translateY: -8 * drift.value }] }));
  const boltGlow = useAnimatedStyle(() => ({ shadowOpacity: 0.35 + glow.value * 0.4, shadowRadius: 6 + glow.value * 8 }));
  return (
    <View style={s.glassWrap} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <View style={s.glassClip}>
        {/* what the glass sits on */}
        <LinearGradient colors={['#FFF3DF', '#F7FBFC', '#E6F6FA']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[s.blob, s.blobAmber, amberBlob]} />
        <Animated.View style={[s.blob, s.blobCyan, cyanBlob]} />
        <Animated.View style={[s.blob, s.blobNavy]} />
        {/* the glass */}
        <BlurView blurAmount={13} blurType="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.34)' }]} />
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']} style={s.glassTop} />
        {w > 0 && (
          <Animated.View pointerEvents="none" style={[s.sheen, sheen]}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        )}

        <View style={s.boostHead}>
          <Animated.View style={[s.boltGlass, boltGlow]}>
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.55)']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
            <BoltGlyph size={24} color={AP.amber} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={s.boostKicker}>BOOST</Text>
            <Text style={s.boostTitle}>Reach more candidates</Text>
            <Text style={s.boostSub}>Wider candidate exposure</Text>
          </View>
        </View>

        <PressableScaleNew onPress={onBoost} scaleTo={0.97} accessibilityLabel="Boost job" style={s.boostBtn}>
          <LinearGradient colors={NAVY_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <BoltGlyph size={18} color={AP.amber} />
          <Text style={s.boostBtnText}>Boost job</Text>
        </PressableScaleNew>
      </View>
      {/* bright rim + hairline edge */}
      <View pointerEvents="none" style={s.glassRim} />
    </View>
  );
}

/* ───────── status switch ───────── */

export function StatusSwitch({ keys, counts, value, onChange }: { keys: string[]; counts: number[]; value: string; onChange: (k: string) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, keys.indexOf(value));
  const x = useSharedValue(0);
  useEffect(() => { x.value = withTiming(idx * w, { duration: 300, easing: SMOOTH }); }, [idx, w, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={s.switch} onLayout={(e: LayoutChangeEvent) => setW((e.nativeEvent.layout.width - 8) / keys.length)} accessibilityRole="tablist">
      {w > 0 && <Animated.View pointerEvents="none" style={[s.switchPill, { width: w }, cardShadow, pill]} />}
      {keys.map((k, i) => {
        const on = k === value;
        return (
          <PressableScaleNew key={k} onPress={() => { if (!on) { haptic.selection(); onChange(k); } }} scaleTo={0.96} accessibilityLabel={`${k}, ${counts[i]}`} style={s.switchItem}>
            <Text numberOfLines={1} style={[s.switchText, on && { color: AP.navy, fontFamily: F.h }]}>{k}</Text>
            <View style={[s.switchCount, on && { backgroundColor: i === 1 ? AP.amber : AP.navy }]}>
              <Text style={[s.switchCountText, on && { color: i === 1 ? AP.navy : '#fff' }]}>{counts[i]}</Text>
            </View>
          </PressableScaleNew>
        );
      })}
    </View>
  );
}

/* ───────── applicant ───────── */

const TONES: [string, string][] = [['#3FC1DB', '#0B7F99'], ['#2B5577', '#14324A'], ['#FFC765', '#E8870F'], ['#8BD3E3', '#0891B2']];
function tone(name: string) { let h = 0; for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0; return TONES[h % TONES.length]; }
function initials(name: string) { return (name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2) || '?').toUpperCase(); }

function NewPulse() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: SMOOTH }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 900 })), -1, false);
  }, [reduced, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + 1.4 * t.value }] }));
  return <View style={s.pulse}><Animated.View style={[s.pulseRing, ring]} /><View style={s.pulseDot} /></View>;
}

export type ApplicantItemData = { name: string; appliedAt: string; note: string; location: string; status: 'pending' | 'accepted' | 'rejected'; isNew?: boolean };

export function ApplicantItem({ a, onMessage, onAccept, onReject }: { a: ApplicantItemData; onMessage: () => void; onAccept: () => void; onReject: () => void }) {
  const badge = a.status === 'accepted' ? { bg: AP.tint, fg: AP.cyanDeep, t: 'Accepted' } : a.status === 'rejected' ? { bg: AP.dangerTint, fg: AP.danger, t: 'Rejected' } : { bg: '#FDF0D9', fg: AP.amberDeep, t: 'Pending' };
  return (
    <View style={[s.app, cardShadow]}>
      <View style={s.appHead}>
        <View style={s.avatar}>
          <LinearGradient colors={tone(a.name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 25 }]} />
          <Text style={s.avatarText}>{initials(a.name)}</Text>
          {a.isNew && <View style={s.pulseAnchor}><NewPulse /></View>}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={s.appName}>{a.name}</Text>
          <View style={s.meta}><ClockGlyph /><Text style={s.metaText}>Applied {a.appliedAt}</Text></View>
        </View>
        <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeText, { color: badge.fg }]}>{badge.t}</Text></View>
      </View>
      <View style={s.meta}><PinGlyph /><Text numberOfLines={1} style={[s.metaText, { flex: 1 }]}>{a.location}</Text></View>
      {!!a.note.trim() && (
        <View style={s.quote}><View style={s.quoteBar} /><Text numberOfLines={4} style={s.quoteText}>{a.note.trim()}</Text></View>
      )}
      <View style={s.actions}>
        {a.status === 'pending' && (
          <PressableScaleNew onPress={onReject} scaleTo={0.94} accessibilityLabel="Reject application" style={s.reject}><CrossGlyph size={18} /></PressableScaleNew>
        )}
        <PressableScaleNew onPress={onMessage} scaleTo={0.96} accessibilityLabel="Message" style={s.message}>
          <ChatGlyph /><Text style={s.messageText}>Message</Text>
        </PressableScaleNew>
        {a.status === 'pending' && (
          <PressableScaleNew onPress={onAccept} scaleTo={0.96} accessibilityLabel="Accept application" style={s.accept}>
            <LinearGradient colors={['#13A6C6', AP.cyanDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.7 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
            <CheckGlyph size={17} /><Text style={s.acceptText}>Accept</Text>
          </PressableScaleNew>
        )}
      </View>
    </View>
  );
}

/* ───────── empty ───────── */

export function NoApplicants({ hint }: { hint: string }) {
  return (
    <View style={s.empty}>
      <NoApplicationsArt size={112} />
      <Text style={s.emptyTitle}>No applications yet</Text>
      <Text style={s.emptyBody}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: AP.navy },
  heroBody: { position: 'absolute', left: 20, right: 20, bottom: 64, gap: 8 },
  heroTags: { flexDirection: 'row', gap: 8 },
  glassTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  amberTag: { backgroundColor: AP.amber, borderColor: AP.amberSoft },
  glassTagText: { fontFamily: F.hb, fontSize: 12, color: '#fff' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8BD3E3' },
  heroTitle: { fontFamily: F.h, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, color: '#fff' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroPlace: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroPlaceText: { fontFamily: F.m, fontSize: 14, color: 'rgba(255,255,255,0.88)', flexShrink: 1 },
  payPill: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#fff' },
  payText: { fontFamily: F.h, fontSize: 16, color: AP.navy },
  payUnit: { fontFamily: F.hb, fontSize: 12, color: AP.amberDeep },

  strip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 22, paddingVertical: 14, marginHorizontal: 16, marginTop: -44 },
  stripDiv: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: AP.line, marginVertical: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statIcon: { height: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontFamily: F.h, fontSize: 20, lineHeight: 24, color: AP.navy },
  statLabel: { fontFamily: F.m, fontSize: 12, color: AP.muted },

  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: AP.line },
  cardTitle: { fontFamily: F.h, fontSize: 16, color: AP.navy },
  cardSub: { fontFamily: F.m, fontSize: 13, color: AP.muted },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: F.h, fontSize: 22, color: AP.navy },
  ringOf: { fontFamily: F.hb, fontSize: 14, color: AP.faint },
  seats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  seat: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  seatOn: { backgroundColor: AP.navy },
  seatOpen: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: AP.amber, backgroundColor: '#FFF7EA' },
  more: { fontFamily: F.hb, fontSize: 12, color: AP.muted },

  glassWrap: { borderRadius: 24, shadowColor: '#0B4F63', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 6 },
  glassClip: { borderRadius: 24, overflow: 'hidden', padding: 18, gap: 18 },
  glassRim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.95)' },
  glassTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 56 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobAmber: { width: 190, height: 190, top: -70, right: -40, backgroundColor: '#FFC765', opacity: 0.75 },
  blobCyan: { width: 170, height: 170, bottom: -80, left: -30, backgroundColor: '#7FD8EA', opacity: 0.7 },
  blobNavy: { width: 90, height: 90, bottom: -30, right: 40, backgroundColor: '#5E86A8', opacity: 0.25 },
  sheen: { position: 'absolute', top: -40, bottom: -40, width: 90 },
  boostHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  boltGlass: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', shadowColor: AP.amber, shadowOffset: { width: 0, height: 0 } },
  boostKicker: { fontFamily: F.h, fontSize: 11, letterSpacing: 1.4, color: AP.amberDeep },
  boostTitle: { fontFamily: F.h, fontSize: 18, lineHeight: 23, color: AP.navy, marginTop: 1 },
  boostSub: { fontFamily: F.m, fontSize: 13, color: '#4F6470', marginTop: 2 },
  boostBtn: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  boostBtnText: { fontFamily: F.h, fontSize: 15, color: '#fff' },

  switch: { flexDirection: 'row', backgroundColor: AP.bg, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: AP.line },
  switchPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: '#fff' },
  switchItem: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  switchText: { fontFamily: F.hb, fontSize: 13, color: AP.muted, flexShrink: 1 },
  switchCount: { minWidth: 20, height: 20, borderRadius: 7, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3EBEE' },
  switchCountText: { fontFamily: F.h, fontSize: 11, color: AP.muted },

  app: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 10, borderWidth: 1, borderColor: AP.line },
  appHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.h, fontSize: 17, color: '#fff' },
  pulseAnchor: { position: 'absolute', top: -1, right: -1 },
  pulse: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: AP.amber },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: AP.amber, borderWidth: 2.5, borderColor: '#fff' },
  appName: { fontFamily: F.h, fontSize: 16, color: AP.navy },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: F.m, fontSize: 13, color: AP.muted },
  badge: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontFamily: F.hb, fontSize: 12 },
  quote: { flexDirection: 'row', gap: 10, backgroundColor: AP.bg, borderRadius: 14, padding: 12 },
  quoteBar: { width: 3, borderRadius: 2, backgroundColor: AP.cyan },
  quoteText: { flex: 1, fontFamily: F.b, fontSize: 14, lineHeight: 20, color: AP.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  reject: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: AP.dangerTint },
  message: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: AP.tint },
  messageText: { fontFamily: F.hb, fontSize: 14, color: AP.cyanDeep },
  accept: { flex: 1.2, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' },
  acceptText: { fontFamily: F.hb, fontSize: 14, color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 8 },
  emptyArt: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyDot: { position: 'absolute', top: -6, right: -6, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: AP.amber, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  emptyDotText: { fontFamily: F.h, fontSize: 11, color: AP.navy },
  emptyTitle: { fontFamily: F.h, fontSize: 17, color: AP.navy },
  emptyBody: { fontFamily: F.m, fontSize: 13, lineHeight: 19, color: AP.muted, textAlign: 'center', maxWidth: 260 },
});
