// One employer listing on the Job type page: top block (logo + name, meta,
// pay, location), a row of info cards, and a row of open roles. Hairline
// between listings, no nested bordered boxes. Promoted listings get a thin
// amber top light line.
import React, { memo, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { durations, palette } from '@/src/design/tokens';
import { haptic } from '@/lib/haptics';
import { F } from '@/components/vista/category/tokens';
import type { EmployerGroup, Role } from './model';
import {
  ClockIcon, MegaphoneIcon, PersonIcon, PhotoHeart, PhotoIcon, PinIcon, PinUnknownIcon,
} from './glyphs';

/** Neutral labeled placeholder ("Logo" / "Photo") when there is no real image. */
export function Placeholder({ label, style }: { label: string; style: object }) {
  return (
    <LinearGradient colors={[palette.placeholderA, palette.placeholderB]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[s.ph, style]}>
      <PhotoIcon />
      <Text style={s.phText}>{label}</Text>
    </LinearGradient>
  );
}

/** Standard Reveal: opacity 0→1, translateY 20→0, scale .985→1, 600ms, 60ms stagger, first screenful only. */
export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const animate = !reduce && index < 4;
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) v.set(withDelay(index * 60, withTiming(1, { duration: durations.enter, easing: SMOOTH })));
    // once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 20 }, { scale: 0.985 + 0.015 * v.value }],
  }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.info}>
      {icon}
      <View>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function Heart({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const beat = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        if (!saved && !reduce) {
          beat.set(withSequence(withTiming(1.25, { duration: 170, easing: SMOOTH }), withTiming(1, { duration: 180, easing: SMOOTH })));
        }
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save job'}
      accessibilityState={{ selected: saved }}
      hitSlop={4}
      style={s.heart}
    >
      <Animated.View style={st}><PhotoHeart filled={saved} /></Animated.View>
    </Pressable>
  );
}

function RoleCard({ role, saved, onOpen, onToggleSave }: {
  role: Role; saved: boolean; onOpen: (id: string) => void; onToggleSave: (id: string) => void;
}) {
  return (
    <View style={s.role}>
      <PressableScale scale={0.985} onPress={() => onOpen(role.id)} accessibilityRole="button" accessibilityLabel={`${role.title}, ${role.price}`}>
        {role.image ? (
          <Image source={{ uri: role.image }} style={s.photo} accessibilityIgnoresInvertColors />
        ) : (
          <Placeholder label="Photo" style={s.photo} />
        )}
        <Text style={s.price} numberOfLines={1}>{role.price}</Text>
        <Text style={s.roleTitle} numberOfLines={2}>{role.title}</Text>
      </PressableScale>
      <Heart saved={saved} onPress={() => onToggleSave(role.id)} />
    </View>
  );
}

type Props = {
  group: EmployerGroup;
  shiftLabel: string; // "Shift" or "Days"
  last: boolean;
  isSaved: (id: string) => boolean;
  onOpenEmployer: (group: EmployerGroup) => void;
  onOpenJob: (id: string) => void;
  onToggleSave: (id: string) => void;
};

export const EmployerCard = memo(function EmployerCard({ group, shiftLabel, last, isSaved, onOpenEmployer, onOpenJob, onToggleSave }: Props) {
  const hasInfo = !!(group.positions || group.shift);
  return (
    <View style={[s.wrap, !last && s.divider]}>
      {group.promoted ? <View pointerEvents="none" style={s.topLight} /> : null}

      <PressableScale scale={0.985} onPress={() => onOpenEmployer(group)} accessibilityRole="button" accessibilityLabel={group.company} style={s.top}>
        <Placeholder label="Logo" style={s.logo} />
        <View style={s.topText}>
          <View style={s.nameRow}>
            {group.promoted ? (
              <View style={s.ad} accessibilityLabel="Ad">
                <MegaphoneIcon />
                <Text style={s.adText}>Ad</Text>
              </View>
            ) : null}
            <Text style={s.name} numberOfLines={1}>{group.company}</Text>
          </View>
          {group.category ? <Text style={s.meta} numberOfLines={1}>{group.category}</Text> : null}
          <Text style={[s.meta, s.pay]} numberOfLines={1}>{group.payLine}</Text>
          <View style={s.locRow}>
            {group.locationUnknown ? <PinUnknownIcon /> : <PinIcon />}
            <Text style={s.meta} numberOfLines={1}>{group.location}</Text>
          </View>
        </View>
      </PressableScale>

      {hasInfo ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.infoRow}>
          {group.positions ? <InfoCard icon={<PersonIcon />} label="Positions" value={group.positions} /> : null}
          {group.shift ? <InfoCard icon={<ClockIcon />} label={shiftLabel} value={group.shift} /> : null}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.roleRow}>
        {group.roles.map((r) => (
          <RoleCard key={r.id} role={r} saved={isSaved(r.id)} onOpen={onOpenJob} onToggleSave={onToggleSave} />
        ))}
      </ScrollView>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingBottom: 20 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  topLight: {
    position: 'absolute', top: 0, left: '14%', right: '14%', height: 2, borderRadius: 1,
    backgroundColor: 'rgba(245,165,36,0.8)',
    shadowColor: palette.amber, shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  top: { flexDirection: 'row', gap: 14 },
  logo: { width: 84, height: 84, borderRadius: 24 },
  ph: { alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  phText: { fontFamily: F.s, fontSize: 11, color: palette.placeholderInk },
  topText: { flex: 1, minWidth: 0, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  adText: { fontFamily: F.hb, fontSize: 13, color: palette.amberInk },
  name: { flex: 1, fontFamily: F.hb, fontSize: 17, color: palette.ink },
  meta: { flexShrink: 1, marginTop: 5, fontFamily: F.b, fontSize: 14, color: palette.muted },
  pay: { fontFamily: F.hb, color: palette.cyanDeep },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  bleed: { marginHorizontal: -16 },
  infoRow: { gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  info: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: palette.line,
    borderRadius: 18, paddingVertical: 10, paddingLeft: 12, paddingRight: 16, backgroundColor: palette.surface,
  },
  infoLabel: { fontFamily: F.hb, fontSize: 14, color: palette.ink },
  infoValue: { fontFamily: F.b, fontSize: 13.5, color: palette.muted, maxWidth: 200 },
  roleRow: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  role: { width: 152 },
  photo: { width: 152, height: 124, borderRadius: 22 },
  price: { marginTop: 10, fontFamily: F.hb, fontSize: 17, color: palette.ink },
  roleTitle: { marginTop: 2, fontFamily: F.b, fontSize: 15, lineHeight: 19.5, color: palette.ink },
  heart: { position: 'absolute', top: 2, right: 2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
