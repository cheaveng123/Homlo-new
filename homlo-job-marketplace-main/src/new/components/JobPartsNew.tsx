import { ReactNode, useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew } from './TextNew';
import { ChipNew, PressableScaleNew } from './PrimitivesNew';
import { PhotoPlaceholder } from '@/src/design/primitives';
import { AdsIcon } from '@/src/components/icons/AdsIcon';
import { useIsFocused } from 'expo-router';
import { colorsNew, radiusNew } from '../theme/tokensNew';
import { motionNew } from '../theme/motionNew';
import { useCopyNew } from '../theme/copyNew';
import { JobSummaryNew } from '../types/jobNew';


/* ---------- accepted/total positions: bar + text. Cyan normally; amber (the spice) only when one remains ---------- */
export function PositionsBarNew({ left, total, maxWidth = 84 }: { left: number; total: number; maxWidth?: number }) {
  const copy = useCopyNew();
  const reduced = useReducedMotion();
  const accepted = Math.max(0, Math.min(total, total - left));
  const ratio = total > 0 ? Math.max(0, Math.min(1, accepted / total)) : 0;
  const p = useSharedValue(reduced ? ratio : 0);
  useEffect(() => { p.value = withTiming(ratio, { duration: reduced ? 0 : 600 }); }, [p, ratio, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  if (total <= 0) return null;
  const urgent = left <= 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, maxWidth, height: 6, borderRadius: 3, backgroundColor: colorsNew.track, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: urgent ? colorsNew.sun : colorsNew.primary }, fill]} />
      </View>
      <TextNew variant="caption" weight="semibold" color={urgent ? colorsNew.clayInk : '#0B6F8A'}>{copy.positions(accepted, total)}</TextNew>
    </View>
  );
}

export function AdBadgeNew() {
  const focused = useIsFocused();
  return (
    <View
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colorsNew.cream, borderRadius: radiusNew.pill, paddingLeft: 6, paddingRight: 8, paddingVertical: 2 }}
      accessibilityLabel="Sponsored listing"
      accessibilityRole="text"
    >
      <AdsIcon size={14} active={focused} />
      <TextNew variant="caption" weight="semibold" color={colorsNew.creamInk}>Ads</TextNew>
    </View>
  );
}

export function LocationLineNew({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <AppIconNew name="pin" size={16} color={colorsNew.muted} />
      <TextNew variant="meta" color={colorsNew.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</TextNew>
    </View>
  );
}

/* ---------- save heart: tap fills teal with a small pop ---------- */
export function HeartButtonNew({ liked, onPress }: { liked?: boolean; onPress?: () => void }) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => { if (liked && !reduced) s.value = withSequence(withTiming(1.25, { duration: 120 }), withTiming(1, { duration: 160 })); }, [liked, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PressableScaleNew onPress={onPress} accessibilityLabel="Save" accessibilityState={{ selected: !!liked }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: liked ? colorsNew.primary : colorsNew.white }, a]}>
        <AppIconNew name="heart" size={18} color={liked ? colorsNew.white : colorsNew.deep} filled={liked} />
      </Animated.View>
    </PressableScaleNew>
  );
}

/* ---------- photo + heart. Neutral "Photo" placeholder when there is no image; never an owner avatar over a photo ---------- */
export function JobPhotoNew({ job, width, height, radius = radiusNew.card, onToggleLike, hideHeart, children }: {
  job: JobSummaryNew; width?: number | string; height: number; radius?: number; onToggleLike?: () => void; hideHeart?: boolean; avatarSize?: number; children?: ReactNode;
}) {
  return (
    <View style={{ width: width as any, height, borderRadius: radius, overflow: 'hidden' }}>
      {job.imageUri
        ? <Image source={{ uri: job.imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <PhotoPlaceholder compact={height < 90} />}
      {!hideHeart && <View style={{ position: 'absolute', right: 0, top: 0 }}><HeartButtonNew liked={job.liked} onPress={onToggleLike} /></View>}
      {children}
    </View>
  );
}

type CardProps = { job: JobSummaryNew; onPress?: () => void; onToggleLike?: () => void };

/* ---------- Recommended: tall image card, no box ---------- */
export function JobCardTallNew({ job, onPress, onToggleLike, width = 210 }: CardProps & { width?: number }) {
  return (
    <PressableScaleNew scaleTo={motionNew.pressCard} onPress={onPress} style={{ width }} accessibilityLabel={job.title}>
      <JobPhotoNew job={job} height={200} onToggleLike={onToggleLike} />
      <View style={{ paddingTop: 12, paddingHorizontal: 4, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextNew variant="title" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{job.title}</TextNew>
          {job.boosted && <AdBadgeNew />}
        </View>
        <LocationLineNew label={job.locationLabel} />
        <View style={{ marginVertical: 4 }}><PositionsBarNew left={job.positionsLeft} total={job.positionsTotal} /></View>
        <TextNew variant="title" heading weight="extrabold" color={colorsNew.deep}>{job.payLabel}</TextNew>
      </View>
    </PressableScaleNew>
  );
}

/* ---------- compact row: thumbnail, title, location, positions, pay. Hairline divider, no box ---------- */
export function JobRowNew({ job, onPress, divider = true }: CardProps & { divider?: boolean }) {
  return (
    <PressableScaleNew onPress={onPress} accessibilityLabel={job.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: divider ? 1 : 0, borderColor: colorsNew.border }}>
      <View style={{ width: 56, height: 56, borderRadius: radiusNew.tile, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {job.imageUri
          ? <Image source={{ uri: job.imageUri }} style={{ width: 56, height: 56 }} />
          : <PhotoPlaceholder compact style={{ alignSelf: 'stretch' }} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextNew variant="title" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{job.title}</TextNew>
          {job.boosted && <AdBadgeNew />}
        </View>
        <LocationLineNew label={job.locationLabel} />
        <View style={{ marginTop: 4 }}><PositionsBarNew left={job.positionsLeft} total={job.positionsTotal} /></View>
      </View>
      <TextNew variant="title" heading weight="extrabold" color={colorsNew.deep}>{job.payLabel}</TextNew>
    </PressableScaleNew>
  );
}

/* ---------- search result: image left, details right, hairline divider ---------- */
export function JobResultCardNew({ job, onPress, onToggleLike }: CardProps) {
  return (
    <PressableScaleNew onPress={onPress} accessibilityLabel={job.title}
      style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colorsNew.border }}>
      <JobPhotoNew job={job} width={112} height={112} radius={radiusNew.tile} hideHeart />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ paddingRight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextNew variant="title" heading weight="bold" numberOfLines={2} style={{ flex: 1 }}>{job.title}</TextNew>
          {job.boosted && <AdBadgeNew />}
        </View>
        <LocationLineNew label={job.locationLabel} />
        {!!job.typeLabel && <View style={{ marginVertical: 2 }}><ChipNew label={job.typeLabel} /></View>}
        <PositionsBarNew left={job.positionsLeft} total={job.positionsTotal} />
        <TextNew variant="title" heading weight="extrabold" color={colorsNew.deep}>{job.payLabel}</TextNew>
        <View style={{ position: 'absolute', right: -8, top: -8 }}><HeartButtonNew liked={job.liked} onPress={onToggleLike} /></View>
      </View>
    </PressableScaleNew>
  );
}
