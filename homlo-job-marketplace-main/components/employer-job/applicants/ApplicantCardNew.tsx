/**
 * Applicant card for "Waiting on you". Lit white card: avatar with a pulsing new
 * dot, name and job chip, when/where, their message, and three actions
 * (reject, message, accept). Pure UI: the screen owns every handler.
 */
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TextNew } from '@/src/new/components/TextNew';
import { PressableScaleNew } from '@/src/new/components/PrimitivesNew';
import { SMOOTH } from '@/src/design/motion';
import { BriefcaseMiniGlyph, ChatGlyph, CheckGlyph, ClockGlyph, CrossGlyph, PinGlyph } from './ApplicantGlyphs';
import { AP, cardShadow } from './tokens';

export type ApplicantCardData = {
  name: string;
  avatarUrl?: string | null;
  jobTitle: string;
  appliedAgo: string;
  location: string;
  message?: string | null;
  isNew: boolean;
};

const AVATAR_TONES: [string, string][] = [
  ['#3FC1DB', '#0B7F99'],
  ['#2B5577', '#14324A'],
  ['#FFC765', '#E8870F'],
  ['#5CC9B5', '#1F8A79'],
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.map((w) => w[0]).join('').slice(0, 2) || 'A').toUpperCase();
}

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Amber dot with a soft ring that breathes outward every couple of seconds. */
function NewPulse() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: SMOOTH }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 900 })), -1, false);
  }, [reduced, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + 1.4 * t.value }] }));
  return (
    <View style={st.pulseWrap} accessibilityLabel="New applicant">
      <Animated.View style={[st.pulseRing, ring]} />
      <View style={st.pulseDot} />
    </View>
  );
}

export function ApplicantCardNew({ data, onPress, onAccept, onReject, onMessage, busy }: {
  data: ApplicantCardData; onPress: () => void; onAccept: () => void; onReject: () => void; onMessage: () => void; busy?: boolean;
}) {
  const tone = toneFor(data.name);
  return (
    <PressableScaleNew onPress={onPress} scaleTo={0.985} accessibilityLabel={`${data.name}, applied for ${data.jobTitle}`} style={[st.card, cardShadow]}>
      <View style={st.head}>
        <View style={st.avatar}>
          {data.avatarUrl ? (
            <Image source={{ uri: data.avatarUrl }} style={st.avatarImg} />
          ) : (
            <>
              <LinearGradient colors={tone} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.avatarRound]} />
              <TextNew variant="title" heading weight="extrabold" color={AP.white}>{initials(data.name)}</TextNew>
            </>
          )}
          {data.isNew && <View style={st.pulseAnchor}><NewPulse /></View>}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <TextNew variant="title" heading weight="extrabold" color={AP.navy} numberOfLines={1} style={st.name}>{data.name}</TextNew>
          <View style={st.chip}>
            <BriefcaseMiniGlyph />
            <TextNew variant="caption" heading weight="bold" color={AP.cyanDeep} numberOfLines={1} style={{ flexShrink: 1 }}>{data.jobTitle}</TextNew>
          </View>
        </View>
      </View>

      <View style={st.metaRow}>
        <View style={st.meta}><ClockGlyph /><TextNew variant="meta" color={AP.muted}>{data.appliedAgo}</TextNew></View>
        <View style={[st.meta, { flex: 1 }]}><PinGlyph /><TextNew variant="meta" color={AP.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{data.location}</TextNew></View>
      </View>

      {!!data.message?.trim() && (
        <View style={st.quote}>
          <View style={st.quoteBar} />
          <TextNew variant="body" color={AP.ink} numberOfLines={3} style={{ flex: 1 }}>{data.message.trim()}</TextNew>
        </View>
      )}

      <View style={st.actions}>
        <PressableScaleNew onPress={onReject} disabled={busy} scaleTo={0.94} accessibilityLabel={`Reject ${data.name}`} style={st.reject}>
          <CrossGlyph size={18} />
        </PressableScaleNew>
        <PressableScaleNew onPress={onMessage} scaleTo={0.96} accessibilityLabel={`Message ${data.name}`} style={st.message}>
          <ChatGlyph />
          <TextNew variant="body" heading weight="bold" color={AP.cyanDeep}>Message</TextNew>
        </PressableScaleNew>
        <PressableScaleNew onPress={onAccept} disabled={busy} scaleTo={0.96} accessibilityLabel={`Accept ${data.name}`} style={[st.accept, busy && { opacity: 0.6 }]}>
          <LinearGradient colors={['#13A6C6', AP.cyanDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.pillRound]} />
          <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.7 }} style={[StyleSheet.absoluteFill, st.pillRound]} />
          <CheckGlyph size={17} />
          <TextNew variant="body" heading weight="bold" color={AP.white}>Accept</TextNew>
        </PressableScaleNew>
      </View>
    </PressableScaleNew>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: AP.white, borderRadius: 22, padding: 16, gap: 12, overflow: 'visible' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarRound: { borderRadius: 26 },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  pulseAnchor: { position: 'absolute', top: 0, right: 0 },
  pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: AP.amber },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: AP.amber, borderWidth: 2.5, borderColor: AP.white },
  name: { fontSize: 17, lineHeight: 22 },
  chip: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: AP.tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quote: { flexDirection: 'row', gap: 10, backgroundColor: AP.bg, borderRadius: 14, padding: 12 },
  quoteBar: { width: 3, borderRadius: 2, backgroundColor: AP.cyan },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  reject: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: AP.dangerTint },
  message: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: AP.tint },
  accept: { flex: 1.2, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' },
  pillRound: { borderRadius: 23 },
});
