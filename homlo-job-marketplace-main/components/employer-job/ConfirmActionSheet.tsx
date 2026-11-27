// ConfirmActionSheet: pop-up used for Accept / Reject / Delete / Changes saved
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import BottomSheetModal from './BottomSheetModal';
import MintGradientButton from './MintGradientButton';
import { colors, font } from './job-management-tokens';

type Props = {
  visible: boolean;
  tone?: 'good' | 'bad';
  icon?: 'check' | 'x' | 'trash';
  title: string;
  message: string;
  children?: React.ReactNode; // optional mini card shown under the message
  cancelLabel?: string; // omit for a single full-width action
  confirmLabel: string;
  confirmTone?: 'mint' | 'red';
  onCancel?: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionSheet({
  visible, tone = 'good', icon = 'check', title, message, children,
  cancelLabel, confirmLabel, confirmTone = 'mint', onCancel, onConfirm,
}: Props) {
  const bad = tone === 'bad';
  const iconColor = bad ? colors.red : colors.mint;
  const iconName = icon === 'x' ? 'close' : icon === 'trash' ? 'trash' : 'check';

  return (
    <BottomSheetModal visible={visible} onClose={onCancel ?? onConfirm}>
      <View style={[styles.ic, { backgroundColor: bad ? colors.redTint : colors.tint }]}>
        <AppIcon name={iconName} size={30} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.msg}>{message}</Text>
      {children}
      <View style={styles.actions}>
        {cancelLabel ? (
          <Pressable onPress={onCancel} style={[styles.btn, styles.cancel, { flex: 1 }]}>
            <Text style={styles.cancelTx}>{cancelLabel}</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: cancelLabel ? 1.4 : 1 }}>
          {confirmTone === 'red' ? (
            <Pressable onPress={onConfirm} style={[styles.btn, { backgroundColor: colors.red }]}>
              <Text style={[styles.cancelTx, { color: colors.white }]}>{confirmLabel}</Text>
            </Pressable>
          ) : (
            <MintGradientButton label={confirmLabel} onPress={onConfirm} />
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  ic: { width: 64, height: 64, borderRadius: 32, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: font.h800, fontSize: 21, color: colors.forest, textAlign: 'center' },
  msg: { fontFamily: font.b400, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.bg },
  cancelTx: { fontFamily: font.b600, fontSize: 15, color: colors.forest },
});