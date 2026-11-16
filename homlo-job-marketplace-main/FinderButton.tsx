import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, type } from './theme';

export function FinderButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={type.finderLabel}>Don&apos;t know where to start?</Text>
      <View style={styles.arrowCircle}>
        <Text style={styles.arrowGlyph}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 16,
    borderWidth: 1.5,
    borderColor: colors.greenTint30,
    borderRadius: radii.finderBtn,
    backgroundColor: 'transparent',
  },
  pressed: { backgroundColor: colors.greenTint10 },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: radii.finderArrow,
    borderWidth: 1.5,
    borderColor: colors.greenTint35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { color: colors.greenDark, fontSize: 15 },
});
