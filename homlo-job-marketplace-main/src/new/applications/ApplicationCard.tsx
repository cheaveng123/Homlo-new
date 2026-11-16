import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Icon } from './Icon';
import { JobPhoto } from './JobPhoto';
import { PressableScale } from './PressableScale';
import { StatusBadge } from './StatusBadge';
import { copy } from './copy';
import { formatAppliedShort } from './status';
import { cardShadow, colors, fonts, radii } from './theme';
import type { ApplicationListItem } from './types';

export function ApplicationCard({ item, index, onPress, onMessage }: {
  item: ApplicationListItem; index: number; onPress: () => void; onMessage: () => void;
}) {
  const reduced = useReducedMotion();
  const when = formatAppliedShort(item.appliedAt);
  const pop = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    pop.value = withDelay(Math.min(index, 8) * 75 + 120, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const photoStyle = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.8 + 0.2 * pop.value }] }));

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={item.jobTitle} style={styles.card}>
      <View style={styles.top}>
        <Animated.View style={photoStyle}><JobPhoto uri={item.jobImageUri} title={item.jobTitle} size={56} radius={14} /></Animated.View>
        <View style={styles.texts}>
          <Text numberOfLines={2} style={styles.title}>{item.jobTitle}</Text>
          {item.employerName ? <Text numberOfLines={1} style={styles.employer}>{item.employerName}</Text> : null}
        </View>
        <Icon name="chevron" size={20} color={colors.muted} />
      </View>
      <View style={styles.bottom}>
        <View style={styles.left}>
          <StatusBadge status={item.status} />
          {when ? <Text numberOfLines={1} style={styles.date}>{when}</Text> : null}
        </View>
        <PressableScale onPress={onMessage} accessibilityRole="button" accessibilityLabel={copy.message} style={styles.msgBtn}>
          <Text style={styles.msgText}>{copy.message}</Text>
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.tile, padding: 12, paddingBottom: 4, ...cardShadow },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.text },
  employer: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  date: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, flexShrink: 1 },
  msgBtn: { minHeight: 44, paddingLeft: 12, justifyContent: 'center' },
  msgText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: colors.teal },
});