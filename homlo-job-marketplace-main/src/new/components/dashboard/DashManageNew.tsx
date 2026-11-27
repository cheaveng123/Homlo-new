import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { TextNew } from '../TextNew';
import {
  ApplicationsIcon,
  ClosedJobsIcon,
  LiveJobsIcon,
  NewApplicantsIcon,
  type ManageIconProps,
} from '@/src/components/icons/ManageIcons';
import { dash } from './dashTokens';

import { smooth } from '@/src/design/motion';
export type DashManageItem = { key: string; label: string; count: number };

const ICONS: Record<string, React.ComponentType<ManageIconProps>> = {
  applications: ApplicationsIcon,
  jobsPosted: ClosedJobsIcon,
  liveNow: LiveJobsIcon,
  newApplicants: NewApplicantsIcon,
};
const OFFSETS = [0, 1200, 2400, 3600];

function ManageCell({ item, index, showCount, focused, onPress }: {
  item: DashManageItem; index: number; showCount: boolean; focused: boolean; onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const [replay, setReplay] = useState(0);
  const Icon = ICONS[item.key] ?? ApplicationsIcon;
  const a = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showCount ? `${item.label}, ${item.count}` : item.label}
      style={s.cell}
      onPressIn={() => { if (!reduced) scale.set(withTiming(0.94, { duration: 120 })); }}
      onPressOut={() => {
        if (!reduced) scale.set(smooth(1, 220));
        setReplay((r) => r + 1);
      }}
      onPress={onPress}
    >
      <Animated.View style={[s.iconWrap, a]}>
        <Icon size={48} surface={dash.surface} delay={replay ? 0 : OFFSETS[index % 4]} replayKey={replay} active={focused} />
        {showCount ? (
          <View style={s.badge}>
            <TextNew variant="caption" heading weight="bold" color="#fff" style={s.badgeText}>
              {item.count > 99 ? '99+' : item.count}
            </TextNew>
          </View>
        ) : null}
      </Animated.View>
      <TextNew variant="caption" weight="medium" color={dash.ink} align="center" numberOfLines={2} style={s.label}>
        {item.label}
      </TextNew>
    </Pressable>
  );
}

export function DashManageNew({ title, items, loading, focused, onPress }: {
  title: string; items: DashManageItem[]; loading?: boolean; focused: boolean; onPress: (key: string) => void;
}) {
  return (
    <View>
      <TextNew variant="section" heading weight="bold" color={dash.ink} style={s.title}>{title}</TextNew>
      <View style={s.grid}>
        {items.map((m, i) => (
          <ManageCell key={m.key} item={m} index={i} showCount={!loading} focused={focused} onPress={() => onPress(m.key)} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 17, lineHeight: 22, marginBottom: 14 },
  grid: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  iconWrap: { width: 48, height: 48 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: dash.navy,
    borderWidth: 2,
    borderColor: dash.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
  label: { marginTop: 8, fontSize: 12.5, lineHeight: 16 },
});
