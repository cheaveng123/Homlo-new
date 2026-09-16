import { View, Text, TextInput, Pressable } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { colors, radius, fontFamily } from './theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress: () => void;
  onSubmit?: (text: string) => void;
  placeholder?: string;
  subtitle?: string;
};

export function JobSearchBar({
  value,
  onChangeText,
  onFilterPress,
  onSubmit,
  placeholder = 'Barista, delivery, part-time…',
  subtitle = 'Any category · Phnom Penh',
}: Props) {
  return (
    <View
      style={{ borderColor: colors.border, borderRadius: radius.searchBar }}
      className="mt-3.5 mx-4 flex-row items-center gap-2.5 border px-3.5 py-3"
    >
      <Search size={16} color={colors.textPrimary} />

      <View className="flex-1">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => onSubmit?.(value.trim())}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={colors.textPrimary}
          style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary, padding: 0 }}
          className="text-[13px]"
        />
        <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[11px] mt-0.5">
          {subtitle}
        </Text>
      </View>

      <Pressable
        onPress={onFilterPress}
        style={{ backgroundColor: colors.white, borderRadius: radius.circle }}
        className="w-7 h-7 items-center justify-center"
      >
        <SlidersHorizontal size={14} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}