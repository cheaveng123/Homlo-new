/**
 * components/chat/ChatHeader.tsx
 *
 * NOTE: the green "online" dot on the avatar and the "· Active now"
 * label have been intentionally removed per design decision.
 * Do not re-add a presence indicator here.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import IconButton from '../common/IconButton';
import Avatar from './Avatar';
import { colors, sizes, type } from '../../theme/tokens';

type Props = {
  initial: string;
  photo?: string | null;
  name: string;
  role: string;
  onBack?: () => void;
  onPressMore?: () => void;
};

export default function ChatHeader({ initial, photo, name, role, onBack, onPressMore }: Props) {
  return (
    <View style={styles.container}>
      <IconButton
        size={sizes.iconButtonChat}
        backgroundColor={colors.sand100}
        onPress={onBack}
        accessibilityLabel="Back"
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M15 5L8 12L15 19" stroke={colors.forest900} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconButton>

      <Avatar photo={photo} style={styles.avatar}>
        <Text style={type.avatarInitial38}>{initial}</Text>
      </Avatar>

      <View style={styles.titleBlock}>
        <Text style={[type.chatName, styles.name]}>{name}</Text>
        <Text style={[type.chatRole, styles.role]}>{role}</Text>
      </View>

      <IconButton
        size={sizes.iconButtonChat}
        backgroundColor={colors.sand100}
        onPress={onPressMore}
        accessibilityLabel="More"
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={5} cy={12} r={1.6} fill={colors.forest900} />
          <Circle cx={12} cy={12} r={1.6} fill={colors.forest900} />
          <Circle cx={19} cy={12} r={1.6} fill={colors.forest900} />
        </Svg>
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: sizes.avatarChatHeader,
    height: sizes.avatarChatHeader,
    borderRadius: 999,
    backgroundColor: colors.mint100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.forest900,
  },
  role: {
    color: colors.gray,
  },
});
