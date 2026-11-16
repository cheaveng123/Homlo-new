/**
 * components/inbox/InboxSearchBar.tsx
 *
 * "Search messages" pill + filter icon button, directly under the header.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import IconButton from '../common/IconButton';
import { colors, radius, sizes, spacing, type } from '../../theme/tokens';

type Props = {
  onPressSearch?: () => void;
  onPressFilter?: () => void;
};

export default function InboxSearchBar({ onPressSearch, onPressFilter }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.search} onPress={onPressSearch}>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={6.5} stroke={colors.gray} strokeWidth={1.8} />
          <Path d="M20 20L15.8 15.8" stroke={colors.gray} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <Text style={[type.searchPlaceholder, styles.searchText]}>Search messages</Text>
      </Pressable>

      <IconButton
        size={sizes.filterButton}
        backgroundColor={colors.sand100}
        onPress={onPressFilter}
        accessibilityLabel="Filter"
      >
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6H20M7 12H17M10 18H14"
            stroke={colors.forest900}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.screenX,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.sand100,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchText: {
    color: colors.gray,
  },
});
