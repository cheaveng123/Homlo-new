/**
 * components/common/IconButton.tsx
 *
 * Generic circular icon button. Used for: inbox bell, filter, chat back
 * button, chat "more" menu, chat clip button, chat send button.
 * Size/background/radius are passed in per-usage so one component
 * covers all of them without prop explosion.
 */
import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { radius } from '../../theme/tokens';

type Props = {
  size: number;
  backgroundColor: string;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function IconButton({
  size,
  backgroundColor,
  onPress,
  children,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
