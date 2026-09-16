import { View, Text, Pressable } from 'react-native';
import { Clock, Briefcase, Laptop, CalendarDays, LucideIcon } from 'lucide-react-native';
import { colors, fontFamily } from './theme';

type Category = { key: string; label: string; Icon: LucideIcon };

const CATEGORIES: Category[] = [
  { key: 'part-time', label: 'Part-time', Icon: Clock },
  { key: 'full-time', label: 'Full-time', Icon: Briefcase },
  { key: 'remote', label: 'Remote', Icon: Laptop },
  { key: 'weekends', label: 'Weekends', Icon: CalendarDays },
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
      {CATEGORIES.map(({ key, label, Icon }) => {
        const active = key === selectedKey;
        const tint = active ? colors.mint : colors.textPrimary;
        return (
          <Pressable key={key} onPress={() => onSelect(key)} className="flex-1 items-center gap-2 pb-2.5">
            <Icon size={27} color={tint} strokeWidth={3} />
            <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[11px]">
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