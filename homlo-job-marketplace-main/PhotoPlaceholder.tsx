import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Stand-in for real job photography until image URLs are wired up.
// Swap this for <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
// once JobCard receives real data — see the `imageSource` prop on JobCard.
const PALETTES: Record<number, [string, string, string]> = {
  1: ['#3A6E63', '#0F6E56', '#0A4436'],
  2: ['#8A6D3C', '#C99A4A', '#7A5A28'],
  3: ['#375D7A', '#4E86A8', '#233F52'],
  4: ['#6E3B57', '#9C5C7C', '#43223A'],
  5: ['#4A5A2E', '#7C9A4B', '#2E3A1C'],
};

export function PhotoPlaceholder({ tone = 1 }: { tone?: 1 | 2 | 3 | 4 | 5 }) {
  const palette = PALETTES[tone] ?? PALETTES[1];
  const [a, b, c] = palette;
  return (
    <LinearGradient
      colors={[a, b, c]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
