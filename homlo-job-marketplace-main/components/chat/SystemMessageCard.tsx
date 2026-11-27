/**
 * components/chat/SystemMessageCard.tsx
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, sizes, type } from '../../theme/tokens';

type Props = {
  initial: string;
  message: string;
  time: string;
  seen?: boolean;
  onPressViewJob?: () => void;
};

export default function SystemMessageCard({ initial, message, time, seen = true, onPressViewJob }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatarSm}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>

      <Text style={[type.systemCardText, styles.text]}>{message}</Text>

      <Pressable style={styles.viewJobBtn} onPress={onPressViewJob}>
        <Text style={[type.viewJobLabel, styles.viewJobLabel]}>View job</Text>
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12H19M19 12L13 6M19 12L13 18"
            stroke={colors.white}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      <View style={styles.timeRow}>
        <Text style={type.bubbleTime}>{time}</Text>
        {seen && (
          <>
            <Text style={type.bubbleTime}> · </Text>
            <Text style={[type.bubbleTimeSeen, styles.seen]}>Seen</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.systemCard,
    padding: 16,
  },
  avatarSm: {
    width: sizes.avatarSystemCard,
    height: sizes.avatarSystemCard,
    borderRadius: 999,
    backgroundColor: colors.mint100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarInitial: {
    fontFamily: type.systemCardText.fontFamily,
    fontWeight: '700',
    fontSize: 12,
    color: colors.forest900,
  },
  text: {
    color: colors.forest900,
    marginBottom: 12,
  },
  viewJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.mint500,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewJobLabel: {
    color: colors.white,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  seen: {
    fontWeight: '700',
  },
});
