import { View, Text, Pressable } from 'react-native';
import { Target, ChevronRight } from 'lucide-react-native';
import { colors, radius, fontFamily } from './theme';

type Props = {
  onPress: () => void; // wire this to open your 3-step match-explainer bottom sheet
  label?: string;
};

export function GuideCard({ onPress, label = 'First time here? Get matched in 3 taps' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: colors.mintTint, borderRadius: radius.guideCard }}
      className="mt-2.5 mx-4 flex-row items-center justify-between px-3 py-2.5"
    >
      <View className="flex-row items-center gap-2.5 flex-1">
        <View
          style={{ backgroundColor: colors.mint, borderRadius: radius.circle }}
          className="w-[30px] h-[30px] items-center justify-center"
        >
          <Target size={15} color={colors.white} />
        </View>
        <Text
          style={{ fontFamily: fontFamily.semibold, color: '#0B3D2E' }}
          className="text-[12.5px] flex-1"
        >
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mint} />
    </Pressable>
  );
}