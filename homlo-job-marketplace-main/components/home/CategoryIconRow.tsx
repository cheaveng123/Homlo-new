import { View, Text, Pressable } from 'react-native';
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { colors, fontFamily } from './theme';

type Category = { key: string; label: string; icon: IconName };

const CATEGORIES: Category[] = [
  { key: 'part-time', label: 'Part-time', icon: 'clock' },
  { key: 'full-time', label: 'Full-time', icon: 'brief' },
  { key: 'remote', label: 'Remote', icon: 'laptop' },
  { key: 'weekends', label: 'Weekends', icon: 'calendar' },
];

type Props = {
  selectedKey: string | null; // pass null on the home screen — nothing is selected there
  onSelect: (key: string) => void;
};

export function CategoryIconRow({ selectedKey, onSelect }: Props) {
  return (
    <View
      style={{ borderColor: colors.divider }}
      className="mt-4 flex-row items-start justify-between px-4 pt-0.5 pb-2.5 border-b"
    >
      {CATEGORIES.map(({ key, label, icon }) => {
        const active = key === selectedKey;
        const tint = active ? colors.mint : colors.textPrimary;
        return (
          <Pressable key={key} onPress={() => onSelect(key)} className="flex-1 items-center gap-2 pb-2.5">
            <AppIcon name={icon} size={27} color={tint} />
            <Text style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }} className="text-[11px]">
              {label}
            </Text>
            {/* underline — transparent (invisible) unless this item is selected */}
            <View style={{ height: 2, width: 28, borderRadius: 2, backgroundColor: active ? colors.mint : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}
