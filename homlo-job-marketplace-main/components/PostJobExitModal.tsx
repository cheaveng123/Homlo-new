import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  /**
   * Mirrors the caller's in-flight state so the two actions cannot be
   * double-fired: "Save as draft" and "Discard" both navigate away, and a
   * second tap while the first is still saving would fire a competing request.
   */
  saving?: boolean;
  discarding?: boolean;
  /** True when this session already persisted a draft that Discard must delete. */
  hasSavedDraft?: boolean;
};

export function PostJobExitModal({
  visible,
  onSaveDraft,
  onDiscard,
  onCancel,
  saving = false,
  discarding = false,
  hasSavedDraft = false,
}: Props) {
  const busy = saving || discarding;
  const discardLabel = discarding
    ? 'Discarding…'
    : hasSavedDraft
      ? 'Discard and delete draft'
      : 'Discard';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? () => {} : onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Leave this listing?</Text>
          <Text style={styles.subtitle}>
            {hasSavedDraft
              ? 'You already saved a draft of this listing. Saving keeps your progress, discarding deletes it for good.'
              : 'You can save your progress as a draft, or discard it.'}
          </Text>

          <Pressable
            style={[styles.primaryBtn, busy && styles.btnBusy]}
            onPress={onSaveDraft}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : 'Save as draft'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.dangerBtn, busy && styles.btnBusy]}
            onPress={onDiscard}
            disabled={busy}
          >
            <Text style={styles.dangerBtnText}>{discardLabel}</Text>
          </Pressable>

          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={busy}
          >
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
    backgroundColor: 'rgba(20,50,74, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#14324A', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#5D7480', marginBottom: 16 },
  primaryBtn: {
    backgroundColor: '#8BD3E3',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '500', color: '#14324A' },
  dangerBtn: {
    backgroundColor: '#F3F6F5',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  dangerBtnText: { fontSize: 14, fontWeight: '500', color: '#B3423B' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  btnBusy: { opacity: 0.5 },
  cancelBtnText: { fontSize: 13, color: '#5D7480' },
});