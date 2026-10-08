import React, { memo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon } from "@/components/ui/AppIcon";
import { jobCardTokens as t } from './jobCardTokens';
import type { JobCardData, JobCardVariant } from './jobCardTypes';
import { PositionsLeft } from './PositionsLeft';

interface Props {
  job: JobCardData;
  variant?: JobCardVariant;
  saved?: boolean;
  /** Hide the heart, e.g. on employer-side lists. */
  hideSave?: boolean;
  /** Hide the positions-left container. Default: shown when positionsLeft is known. */
  hidePositions?: boolean;
  /**
   * imageRef points at the photo tile so the existing card -> detail hero
   * transition can call imageRef.current?.measureInWindow(...) as before.
   */
  onPress?: (job: JobCardData, imageRef: React.RefObject<View | null>) => void;
  onToggleSave?: (job: JobCardData) => void;
  style?: StyleProp<ViewStyle>;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function JobCardBase({
  job,
  variant = 'carousel',
  saved = false,
  hideSave = false,
  hidePositions = false,
  onPress,
  onToggleSave,
  style,
}: Props) {
  const imageRef = useRef<View>(null);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isRow = variant === 'row';
  const isGrid = variant === 'grid';
  const logoSize = isRow ? t.size.logoRow : isGrid ? t.size.logoGrid : t.size.logo;
  const saveSize = isGrid ? t.size.saveGrid : t.size.save;
  const showPositions = !hidePositions && job.positionsLeft != null;
  const showLocation = job.workArrangement !== 'remote' && !!job.locationLabel;
  const hasRating = job.rating != null;

  const logo = (
    <View
      style={[
        styles.logo,
        {
          width: logoSize,
          height: logoSize,
          borderRadius: logoSize / 2,
          backgroundColor: job.employerColor ?? t.color.forest,
          top: isRow ? 6 : isGrid ? 8 : 10,
          left: isRow ? 6 : isGrid ? 8 : 10,
        },
      ]}
    >
      {job.employerLogoUrl ? (
        <Image source={{ uri: job.employerLogoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Text style={[styles.logoText, { fontSize: isRow ? 9 : 11 }]} numberOfLines={1}>
          {job.employerInitials ?? initialsOf(job.employerName)}
        </Text>
      )}
    </View>
  );

  const saveButton = (inline: boolean) =>
    hideSave ? null : (
      <Pressable
        onPress={() => onToggleSave?.(job)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved jobs' : 'Save job'}
        accessibilityState={{ selected: saved }}
        style={[
          styles.save,
          { width: saveSize, height: saveSize, borderRadius: saveSize / 2 },
          inline
            ? { backgroundColor: t.color.bg }
            : [styles.saveFloating, { top: isGrid ? 8 : 10, right: isGrid ? 8 : 10 }],
        ]}
      >
        <AppIcon
          name="heart"
          size={isGrid ? 15 : 17}
          color={saved ? t.color.heart : t.color.ink}
        />
      </Pressable>
    );

  const photo = (
    <View
      ref={imageRef}
      collapsable={false}
      style={[
        styles.photo,
        isRow && styles.photoRow,
        isGrid && styles.photoGrid,
        variant === 'carousel' && styles.photoCarousel,
        variant === 'featured' && styles.photoFeatured,
      ]}
    >
      {job.imageUrl ? (
        <Image source={{ uri: job.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <AppIcon name="brief" size={isRow ? 28 : 40} color={t.color.mint} />
      )}
      {logo}
      {!isRow && saveButton(false)}
    </View>
  );

  const body = (
    <View style={isRow ? styles.bodyRow : styles.body}>
      <Text style={[styles.title, isGrid && styles.titleGrid]} numberOfLines={1}>
        {job.title} · {job.employerName}
      </Text>

      {(showPositions || hasRating) && (
        <View style={styles.meta}>
          {showPositions && <PositionsLeft left={job.positionsLeft as number} total={job.positionsTotal} />}
          {hasRating && (
            <View style={styles.rating}>
              <AppIcon name="star" size={13} color={t.color.star} />
              <Text style={styles.ratingStrong}>{job.rating?.toFixed(1)}</Text>
              {job.reviewCount != null && <Text style={styles.metaText}>({job.reviewCount})</Text>}
            </View>
          )}
        </View>
      )}

      <Text style={styles.metaText} numberOfLines={1}>
        <Text style={styles.pay}>{job.payLabel}</Text>
        {showLocation ? ` · ${job.locationLabel}` : job.workArrangement === 'remote' ? ' · Remote' : ''}
      </Text>
    </View>
  );

  const container = [
    variant === 'carousel' && styles.carousel,
    variant === 'featured' && styles.featured,
    variant === 'grid' && styles.grid,
    isRow && styles.rowCard,
    style,
  ];

  return (
    <Animated.View style={[pressStyle, ...container]}>
      <Pressable
        onPress={() => onPress?.(job, imageRef)}
        onPressIn={() => {
          scale.set(withTiming(t.motion.pressScale, { duration: t.motion.pressMs }));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: t.motion.pressMs }));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${job.title} at ${job.employerName}, ${job.payLabel}`}
        style={isRow ? styles.rowInner : undefined}
      >
        {photo}
        {body}
      </Pressable>
      {isRow && <View style={styles.rowSave}>{saveButton(true)}</View>}
    </Animated.View>
  );
}

export const JobCard = memo(JobCardBase);

const styles = StyleSheet.create({
  carousel: { width: t.size.carouselWidth },
  featured: { width: '100%' },
  grid: { flex: 1 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 10,
    gap: 12,
    backgroundColor: t.color.surface,
    borderRadius: t.radius.rowCard,
    shadowColor: t.color.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowSave: { flexShrink: 0 },

  photo: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.mintTint,
    borderRadius: t.radius.image,
  },
  photoCarousel: { height: t.size.carouselImageHeight },
  photoFeatured: { height: t.size.featuredImageHeight },
  photoGrid: { aspectRatio: 4 / 5 },
  photoRow: { width: t.size.rowThumb, height: t.size.rowThumb, borderRadius: t.radius.thumb },

  logo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: t.color.surface,
  },
  logoText: { color: '#FFFFFF', fontFamily: t.font.extrabold },

  save: { alignItems: 'center', justifyContent: 'center' },
  saveFloating: {
    position: 'absolute',
    backgroundColor: t.color.surface,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  body: { marginTop: 9, gap: 4 },
  bodyRow: { flex: 1, gap: 4 },
  title: { fontFamily: t.font.bold, fontSize: 15, lineHeight: 19, color: t.color.ink },
  titleGrid: { fontSize: 14, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingStrong: { fontFamily: t.font.bold, fontSize: 13, color: t.color.ink },
  metaText: { fontFamily: t.font.medium, fontSize: 13, color: t.color.muted },
  pay: { fontFamily: t.font.extrabold, color: t.color.mint },
});
