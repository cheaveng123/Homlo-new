import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function PostJobExitModal({ visible, onSaveDraft, onDiscard, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Leave this listing?</Text>
          <Text style={styles.subtitle}>
            You can save your progress as a draft, or discard it.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={onSaveDraft}>
            <Text style={styles.primaryBtnText}>Save as draft</Text>
          </Pressable>

          <Pressable style={styles.dangerBtn} onPress={onDiscard}>
            <Text style={styles.dangerBtnText}>Discard</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 39, 31, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#12271F', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#5F7A6E', marginBottom: 16 },
  primaryBtn: {
    backgroundColor: '#5DCAA5',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '500', color: '#04342C' },
  dangerBtn: {
    backgroundColor: '#F4F7F5',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  dangerBtnText: { fontSize: 14, fontWeight: '500', color: '#B3423B' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: '#5F7A6E' },
});