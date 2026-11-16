import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIconNew } from '../icons/AppIconNew';
import { TextNew } from '../components/TextNew';
import { ButtonNew } from '../components/PrimitivesNew';
import { colorsNew } from '../theme/tokensNew';
import { useCopyNew } from '../theme/copyNew';
import { useEnterNew } from '../theme/motionNew';

const AC = Animated.createAnimatedComponent(Circle);
const AP = Animated.createAnimatedComponent(Path);

function AnimatedCheckNew() {
  const reduced = useReducedMotion();
  const c = useSharedValue(reduced ? 0 : 226);
  const k = useSharedValue(reduced ? 0 : 60);
  const rip = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    c.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
    k.value = withDelay(800, withTiming(0, { duration: 500 }));
    rip.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
  }, [reduced]);
  const cp = useAnimatedProps(() => ({ strokeDashoffset: c.value }));
  const kp = useAnimatedProps(() => ({ strokeDashoffset: k.value }));
  const ripple = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - rip.value), transform: [{ scale: 1 + rip.value * 0.6 }] }));
  return (
    <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colorsNew.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: colorsNew.tint2 }, ripple]} />
      <Svg width={96} height={96} viewBox="0 0 80 80">
        <AC cx={40} cy={40} r={36} stroke={colorsNew.tint2} strokeWidth={3} fill="none" strokeDasharray="226" animatedProps={cp} />
        <AP d="M24 41l11 11 21-24" stroke={colorsNew.deep} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" animatedProps={kp} />
      </Svg>
    </View>
  );
}

type Props = { cvName?: string; onViewApplications: () => void; onBackToJobs: () => void };

export function ApplySuccessScreenNew({ cvName, onViewApplications, onBackToJobs }: Props) {
  const copy = useCopyNew();
  const insets = useSafeAreaInsets();
  const enter = useEnterNew();
  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <AnimatedCheckNew />
      <Animated.View entering={enter(2)} style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
        <TextNew variant="hero" align="center">{copy.success.title}</TextNew>
        <TextNew variant="body" color={colorsNew.muted} align="center" style={{ maxWidth: 280 }}>{copy.success.body}</TextNew>
        {!!cvName && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colorsNew.cream, marginTop: 8 }}>
            <AppIconNew name="file" color={colorsNew.creamInk} />
            <TextNew variant="body" weight="semibold" color={colorsNew.creamInk}>{cvName}</TextNew>
          </View>
        )}
      </Animated.View>
      <Animated.View entering={enter(4)} style={{ width: '100%', maxWidth: 320, gap: 8, marginTop: 16 }}>
        <ButtonNew label={copy.success.viewApplications} onPress={onViewApplications} />
        <ButtonNew variant="tint" label={copy.success.backToJobs} onPress={onBackToJobs} />
      </Animated.View>
    </View>
  );
}
