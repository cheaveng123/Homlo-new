// Empty state: open folder with an amber magnifier, line art on no background.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AP, F, LINE } from './tokens';

type Props = { title: string; body: string; actionLabel?: string; onAction?: () => void };

export function EmptyArt({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={s.wrap}>
      <Svg width={140} height={112} viewBox="0 0 120 96" fill="none" accessibilityLabel="No jobs found">
        <Path d="M14 34h30l8 8h46v36a6 6 0 01-6 6H20a6 6 0 01-6-6z" stroke={AP.navy} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 34v-8a6 6 0 016-6h22l8 8" stroke={AP.navy} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M28 56h26M28 66h16" stroke={AP.faint} strokeWidth={2.2} strokeLinecap="round" />
        <Circle cx={84} cy={52} r={12} stroke={AP.amber} strokeWidth={3} />
        <Path d="M93 61l10 10" stroke={AP.amber} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 28, paddingBottom: 8 },
  title: { fontFamily: F.h, fontSize: 17, color: AP.navy, marginTop: 6 },
  body: { fontFamily: F.b, fontSize: 14, lineHeight: 20, color: AP.muted, textAlign: 'center', maxWidth: 280, marginTop: 6 },
  btn: { marginTop: 14, height: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: LINE, justifyContent: 'center' },
  btnText: { fontFamily: F.hb, fontSize: 14, color: AP.navy },
});
