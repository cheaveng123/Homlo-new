/**
 * components/inbox/InboxHeader.tsx
 *
 * "My inbox" title + subtitle + bell button (with its own small
 * unread-notification dot — unrelated to the message-row unread badge).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import IconButton from '../common/IconButton';
import { colors, sizes, spacing, type } from '../../theme/tokens';

type Props = {
  hasNotification?: boolean;
  onPressBell?: () => void;
};

export default function InboxHeader({ hasNotification = true, onPressBell }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={[type.screenTitle, styles.title]}>My inbox</Text>
        <Text style={[type.screenSubtitle, styles.subtitle]}>
          Applications and messages in one place
        </Text>
      </View>

      <IconButton
        size={sizes.bellButton}
        backgroundColor={colors.mint100}
        onPress={onPressBell}
        accessibilityLabel="Notifications"
      >
        <BellIcon />
        {hasNotification && <View style={styles.dot} />}
      </IconButton>
    </View>
  );
}

function BellIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C9 3 7 5.2 7 8V11.5L5 15H19L17 11.5V8C17 5.2 15 3 12 3Z"
        stroke={colors.forest900}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 18C9.8 19.1 10.8 20 12 20C13.2 20 14.2 19.1 14.5 18"
        stroke={colors.forest900}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 12,
    paddingHorizontal: spacing.screenX,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textBlock: {
    flexShrink: 1,
  },
  title: {
    color: colors.forest900,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.gray,
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.coral500,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
