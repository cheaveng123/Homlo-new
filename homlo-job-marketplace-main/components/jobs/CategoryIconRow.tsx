// components/jobs/CategoryIconRow.tsx
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { JOB_CATEGORIES, JobCategorySlug } from '../../constants/jobCategories';
import { jobCategoryTheme as t } from './jobCategoryTheme';
import { jobTypeImage } from '../shared/jobTypeImage';

import { smooth } from '@/src/design/motion';
interface Props {
  active: JobCategorySlug;
  onSelect: (slug: JobCategorySlug) => void;
}

// Home draws these illustrations at 23px inside a 32px chip on the category
// page. The chip grows on selection so the active category is legible, and the
// artwork keeps its own aspect ratio inside.
const CHIP_SIZE = 32;
const CHIP_SIZE_ACTIVE = 40;
const IMAGE_SIZE = 23;
const IMAGE_SIZE_ACTIVE = 28;

const SPRING = { damping: 14, stiffness: 180 } as const;

function CategoryItem({
  slug,
  label,
  isActive,
  onPress,
}: {
  slug: JobCategorySlug;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  // One 0→1 progress value drives the chip size, its fill/border and the icon
  // size together, so a category switch is a single coherent spring rather than
  // a box that jumps to its new size while the artwork animates separately.
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = smooth(isActive ? 1 : 0);
  }, [isActive, progress]);

  const chipStyle = useAnimatedStyle(() => ({
    width: CHIP_SIZE + progress.value * (CHIP_SIZE_ACTIVE - CHIP_SIZE),
    height: CHIP_SIZE + progress.value * (CHIP_SIZE_ACTIVE - CHIP_SIZE),
    // Pale mint when active rather than the old saturated mint — these are
    // full-colour illustrations and a solid mint fill drowns them.
    backgroundColor: interpolateColor(progress.value, [0, 1], [t.color.white, t.color.white]),
    borderColor: interpolateColor(progress.value, [0, 1], [t.color.line, t.color.line]),
  }));

  const imageStyle = useAnimatedStyle(() => ({
    width: IMAGE_SIZE + progress.value * (IMAGE_SIZE_ACTIVE - IMAGE_SIZE),
    height: IMAGE_SIZE + progress.value * (IMAGE_SIZE_ACTIVE - IMAGE_SIZE),
  }));

  // The same custom job-type artwork the home screen uses in the row under
  // "Don't know where to start?" — see components/shared/jobTypeImage.ts. All
  // four slugs resolve; null is only a safety net for an unmapped category.
  const image = jobTypeImage(slug);

  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={8}>
      <Animated.View style={[styles.chip, chipStyle]}>
        {image ? (
          <Animated.Image
            source={image}
            style={imageStyle}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.label,
          {
            color: isActive ? t.color.forest : t.color.muted,
            // One family (Inter), matching the home category label's weight
            // progression — the active state steps up instead of switching to a
            // different typeface.
            fontFamily: isActive ? t.font.bodySemiBold : t.font.bodyMedium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CategoryIconRow({ active, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {JOB_CATEGORIES.map((cat) => (
        <CategoryItem
          key={cat.slug}
          slug={cat.slug}
          label={cat.label}
          isActive={cat.slug === active}
          onPress={() => onSelect(cat.slug)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  item: {
    width: '23%',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
  },
});
