/**
 * components/common/SectionLabel.tsx
 *
 * Small uppercase group label ("TODAY", "EARLIER THIS WEEK").
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, type } from '../../theme/tokens';

type Props = {
  children: string;
  style?: object;
};

export default function SectionLabel({ children, style }: Props) {
  return (
    <Text style={[type.sectionLabel, styles.label, style]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.sand400,
  },
});
