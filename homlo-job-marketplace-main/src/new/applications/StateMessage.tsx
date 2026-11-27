import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { colors, fonts, radii } from './theme';

// Empty / error / not-found: tinted disc, thin icon, short line, optional teal pill.
export function StateMessage({ icon, title, body, actionLabel, onAction }: {
  icon: IconName; title: string; body?: string; actionLabel?: string; onAction?: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(400)} style={styles.wrap}>
      <View style={styles.disc}><Icon name={icon} size={28} color={colors.teal} /></View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} accessibilityRole="button" style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24, gap: 8 },
  disc: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 26, color: colors.deep, textAlign: 'center', marginTop: 4 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  btn: { height: 48, paddingHorizontal: 28, borderRadius: radii.pill, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});