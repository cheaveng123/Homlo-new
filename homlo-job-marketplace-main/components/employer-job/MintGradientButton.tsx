// MintGradientButton: mint gradient pill (Boost job, Accept-confirm, Save changes, etc.)
import React from 'react';
import { Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from '@/lib/native/linear-gradient';
import { colors, font, shadows } from './job-management-tokens';

type Props = {
  label: string;
  onPress: () => void;
  height?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

export default function MintGradientButton({ label, onPress, height = 52, fontSize = 15, style }: Props) {
  const r = height / 2;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [shadows.boost, { borderRadius: r, opacity: pressed ? 0.9 : 1 }, style]}
    >
      <LinearGradient
        colors={[colors.mintLight, colors.mint]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height, borderRadius: r, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.white, fontFamily: font.b600, fontSize }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}