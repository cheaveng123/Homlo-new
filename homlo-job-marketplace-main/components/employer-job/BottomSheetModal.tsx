// BottomSheetModal: dimmed backdrop + rounded bottom sheet that springs up (base for all pop-ups)
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './job-management-tokens';

type Props = { visible: boolean; onClose: () => void; children: React.ReactNode };

export default function BottomSheetModal({ visible, onClose, children }: Props) {
  const [y] = useState(() => new Animated.Value(500));
  const [fade] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    y.setValue(500);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, damping: 20, stiffness: 220, mass: 1, useNativeDriver: true }),
    ]).start();
  }, [visible, y, fade]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: 28 + insets.bottom, transform: [{ translateY: y }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 26,
    paddingHorizontal: 22,
    width: '100%',
  },
});