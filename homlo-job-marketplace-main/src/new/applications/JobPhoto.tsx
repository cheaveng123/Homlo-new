import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from './theme';

// Real job image, or a tinted tile with the first letter of the title.
export function JobPhoto({ uri, title, size = 56, radius = 14, fill = false }: {
  uri?: string | null; title: string; size?: number; radius?: number; fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFailed(false), [uri]);
  const letter = (Array.from((title ?? '').trim())[0] ?? '?').toUpperCase();
  const box: ViewStyle = fill
    ? { ...StyleSheet.absoluteFill }
    : { width: size, height: size, borderRadius: radius, overflow: 'hidden' };
  return (
    <View style={[box, styles.base]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessible={false} />
      ) : (
        <Text allowFontScaling={false} style={[styles.letter, { fontSize: fill ? 64 : Math.round(size * 0.4) }]}>{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.headingHeavy, color: colors.deep },
});