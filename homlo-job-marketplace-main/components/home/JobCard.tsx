import { View, Text, Image, Pressable } from 'react-native';
import { type GestureResponderEvent } from 'react-native';
import { Heart, MapPin } from 'lucide-react-native';
import { colors, radius, fontFamily } from './theme';

export type Job = {
  id: string;
  image: string;
  jobType: string; // e.g. 'Internship', 'Part-time', 'Full-time'
  title: string;
  company: string;
  location: string;
  priceRange: string; // e.g. '$150–$250'
  priceUnit: string; // e.g. '/mo', '/hr'
  imageHeight?: number; // 190 for the top/featured card, 170 for the rest — caller decides
  saved?: boolean;
};

type Props = {
  job: Job;
  onPressApply: (jobId: string) => void;
  onToggleSave: (jobId: string) => void;
  onOpen?: (jobId: string) => void;
};

export function JobCard({ job, onPressApply, onToggleSave, onOpen }: Props) {
  const { id, image, jobType, title, company, location, priceRange, priceUnit, imageHeight = 170, saved } = job;

  const open = () => onOpen?.(id);
  const stop = (handler: () => void) => (event: GestureResponderEvent) => {
    event.stopPropagation();
    handler();
  };

  return (
    <Pressable onPress={open} className="mx-4 mb-4">
      <View style={{ height: imageHeight, borderRadius: radius.jobImage, overflow: 'hidden' }}>
        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

        <View
          style={{ backgroundColor: colors.white, borderRadius: radius.pill }}
          className="absolute top-2.5 left-2.5 px-2.5 py-1"
        >
          <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[10px]">
            {jobType}
          </Text>
        </View>

        <Pressable
          onPress={stop(() => onToggleSave(id))}
          style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: radius.circle }}
          className="absolute top-2.5 right-2.5 w-7 h-7 items-center justify-center"
        >
          <Heart size={14} color={colors.textPrimary} fill={saved ? colors.textPrimary : 'none'} />
        </Pressable>
      </View>

      <View className="pt-2.5 px-0.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color={colors.textPrimary} />
              <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[11px]">
                {location}
              </Text>
            </View>

            <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[15px] mt-0.5">
              {title}
            </Text>
            <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[11.5px] mt-0.5">
              {company}
            </Text>
          </View>

          <Pressable
            onPress={stop(() => onPressApply(id))}
            style={{ backgroundColor: colors.mintTint, borderRadius: radius.pill }}
            className="px-3 py-1"
          >
            <Text style={{ fontFamily: fontFamily.bold, color: colors.mint }} className="text-[12px]">
              Apply
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center mt-2">
          <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }} className="text-[14px]">
            {priceRange}
            <Text style={{ fontFamily: fontFamily.regular, color: colors.textSecondary }} className="text-[12px]">
              {priceUnit}
            </Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}