import { ReactNode } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { AppIconNameNew, AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { AccordionNew, ButtonNew, IconDiscNew, PressableScaleNew, PulseDotNew, RoundButtonNew, SectionTitleNew } from '../components/PrimitivesNew';
import { HeartButtonNew, PositionsBarNew } from '../components/JobPartsNew';
import { colorsNew, radiusNew, shadowNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';

export type JobDetailNew = {
  id: string; employerId?: string; title: string; employerName: string; employerInitials: string; imageUri?: string;
  locationLabel: string; addressNote?: string; payLabel: string; typeLabel: string;
  positionsLeft: number; positionsTotal: number; description: string; requirements: string[]; liked?: boolean;
  employerAbout?: string | null;
};
type Props = {
  job: JobDetailNew; mapSlot?: ReactNode; showMap?: boolean; onBack: () => void; onToggleLike: () => void; onAboutEmployer: () => void; onApply: () => void;
  onShare?: () => void; onPressLocation?: () => void; applyDisabled?: boolean; applyLabel?: string;
  onRefresh?: () => void; refreshing?: boolean;
};

function Fact({ icon, label, value }: { icon: AppIconNameNew; label: string; value: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <AppIconNew name={icon} size={16} color={colorsNew.deep} />
        <TextNew variant="caption" color={colorsNew.muted}>{label}</TextNew>
      </View>
      <TextNew variant="title" heading weight="extrabold" numberOfLines={1}>{value}</TextNew>
    </View>
  );
}

/** Stylised mini map. Replace via `mapSlot` if the app already has a real map component. */
function MiniMapNew() {
  return (
    <View style={{ height: 128, borderRadius: radiusNew.card, overflow: 'hidden', marginHorizontal: 16 }}>
      <Svg width="100%" height="100%" viewBox="0 0 360 128" preserveAspectRatio="xMidYMid slice">
        <Rect width="360" height="128" fill="#EAF3F1" />
        <Path d="M250 0c10 30 40 40 30 70s-30 40-14 58H360V0z" fill="#BFE0E6" />
        <Rect x="20" y="16" width="70" height="34" rx="8" fill="#DDEDEA" />
        <Rect x="120" y="84" width="80" height="30" rx="8" fill="#DDEDEA" />
        <G stroke="#fff" fill="none" strokeLinecap="round"><Path d="M0 70C80 60 150 80 240 50" strokeWidth={7} /><Path d="M110 0C118 40 130 90 120 128" strokeWidth={5} /></G>
      </Svg>
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -7, marginTop: -7 }}>
        <View style={{ position: 'absolute', left: -9, top: -9 }}><PulseDotNew color={colorsNew.primary} size={32} /></View>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colorsNew.deep, borderWidth: 3, borderColor: colorsNew.white }} />
      </View>
    </View>
  );
}

export function JobDetailScreenNew({ job, mapSlot, showMap = true, onBack, onToggleLike, onAboutEmployer, onApply, onShare, onPressLocation, applyDisabled, applyLabel, onRefresh, refreshing }: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  const positionsAccepted = Math.max(0, Math.min(job.positionsTotal, job.positionsTotal - job.positionsLeft));
  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colorsNew.primary} colors={[colorsNew.primary]} /> : undefined}
      >
        <View style={{ height: 280 }}>
          {job.imageUri
            ? <Image source={{ uri: job.imageUri }} style={{ width: '100%', height: '100%' }} />
            : <LinearGradient colors={['#6F8F94', '#D9E6E4', '#9DB8BB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />}
          <LinearGradient colors={['rgba(7,59,66,0.35)', 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }} />
          <View style={{ position: 'absolute', left: 16, top: insets.top + 8 }}><RoundButtonNew icon="back" bg={colorsNew.white} onPress={onBack} accessibilityLabel={copy.common.back} /></View>
          {!!onShare && <View style={{ position: 'absolute', right: 16, top: insets.top + 8 }}><RoundButtonNew icon="send" bg={colorsNew.white} onPress={onShare} accessibilityLabel="Share" /></View>}
        </View>

        {/* white sheet with rounded top overlapping the photo */}
        <Animated.View entering={enter(0)} style={{ marginTop: -28, backgroundColor: colorsNew.white, borderTopLeftRadius: radiusNew.sheet, borderTopRightRadius: radiusNew.sheet, paddingTop: 44, paddingHorizontal: 16 }}>
          <PressableScaleNew
            onPress={onAboutEmployer}
            disabled={!onAboutEmployer || !job.employerId}
            style={{ position: 'absolute', left: 16, top: -32, width: 64, height: 64, borderRadius: radiusNew.tile, backgroundColor: colorsNew.deep, borderWidth: 4, borderColor: colorsNew.white, alignItems: 'center', justifyContent: 'center', ...shadowNew.lg }}>
            <TextNew variant="header" color={colorsNew.white}>{job.employerInitials}</TextNew>
          </PressableScaleNew>
          <TextNew variant="hero">{job.title}</TextNew>
          <TextNew variant="meta" color={colorsNew.muted}>{job.employerName} · {job.locationLabel}</TextNew>
          {/* facts: no boxes, blends into the page */}
          <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 12 }}>
            <Fact icon="brief" label={copy.job.pay} value={job.payLabel} />
            <View style={{ width: 1, backgroundColor: colorsNew.border }} />
            <Fact icon="clock" label={copy.job.type} value={job.typeLabel} />
            {job.positionsTotal != null && job.positionsTotal > 0 && (
              <>
                <View style={{ width: 1, backgroundColor: colorsNew.border }} />
                <Fact icon="users" label={copy.job.positions} value={`${positionsAccepted}/${job.positionsTotal}`} />
              </>
            )}
          </View>
          <PositionsBarNew left={job.positionsLeft} total={job.positionsTotal} maxWidth={9999} />
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SectionTitleNew title={copy.job.location} icon="pin" />
          {showMap && (mapSlot ?? <MiniMapNew />)}
          <PressableScaleNew
            onPress={onPressLocation}
            disabled={!onPressLocation}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 12 }}
          >
            <IconDiscNew icon="pin" tone="sunrise" />
            <View style={{ flex: 1 }}>
              <TextNew variant="title" weight="semibold">{job.locationLabel}</TextNew>
              {!!job.addressNote && <TextNew variant="meta" color={colorsNew.muted}>{job.addressNote}</TextNew>}
            </View>
          </PressableScaleNew>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SectionTitleNew title={copy.job.details} icon="file" />
          <AccordionNew title={copy.job.description}><TextNew variant="body" color={colorsNew.muted}>{job.description}</TextNew></AccordionNew>
          <AccordionNew title={copy.job.requirements}>
            {job.requirements.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <TextNew variant="body" color={colorsNew.muted}>•</TextNew>
                <TextNew variant="body" color={colorsNew.muted} style={{ flex: 1 }}>{r}</TextNew>
              </View>
            ))}
          </AccordionNew>
        </Animated.View>

        {!!job.employerAbout && (
          <Animated.View entering={enter(3)}>
            <SectionTitleNew title="About this employer" icon="user" />
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <TextNew variant="body" color={colorsNew.muted}>{job.employerAbout}</TextNew>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* sticky action bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom, backgroundColor: colorsNew.white, borderTopWidth: 1, borderColor: colorsNew.border }}>
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colorsNew.tint }}><HeartButtonNew liked={job.liked} onPress={onToggleLike} /></View>
        <ButtonNew iconOnly variant="tint" leftIcon="bld" onPress={onAboutEmployer} accessibilityLabel={copy.job.aboutEmployer} />
        <ButtonNew sweep label={applyLabel ?? copy.job.apply} onPress={applyDisabled ? undefined : onApply} disabled={applyDisabled} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
