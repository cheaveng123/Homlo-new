import { View, Text, Pressable } from 'react-native';
import { Briefcase, Bell } from 'lucide-react-native';
import { colors, radius, fontFamily } from './theme';

type Props = {
  onBellPress?: () => void;
};

export function HomeHeader({ onBellPress }: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-2">
      <View className="flex-row items-center gap-2">
        <View
          style={{ backgroundColor: colors.mint, borderRadius: radius.brandMark }}
          className="w-[26px] h-[26px] items-center justify-center"
        >
          <Briefcase size={14} color={colors.white} />
        </View>
        <Text style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }} className="text-[17px]">
          Homlo jobs
        </Text>
      </View>

      <Pressable
        onPress={onBellPress}
        style={{ backgroundColor: colors.white, borderRadius: radius.circle }}
        className="w-[34px] h-[34px] items-center justify-center"
      >
        <Bell size={15} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}