// SunriseOutfitPersonMk7.tsx
// The person for the Homlo Jobs "Recommended" banner. One person, three outfits that
// crossfade slowly (café / delivery / office). Breathes, nods, blinks. Mobile only.
// Needs: react-native-reanimated, react-native-svg. Size comes from the `width` prop.

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export type OutfitVariant = 0 | 1 | 2;
const SKIN = '#F2B78C';
const HAND = '#EDAE84';
const AnimatedG = Animated.createAnimatedComponent(G);

function useFade(on: boolean, ms = 1100) {
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => { o.value = withTiming(on ? 1 : 0, { duration: ms, easing: Easing.inOut(Easing.quad) }); }, [on, ms, o]);
  return o;
}

function Layer({ W, H, on, children }: { W: number; H: number; on: boolean; children: React.ReactNode }) {
  const o = useFade(on);
  const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * H * 0.045 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, s]}>
      <Svg width={W} height={H} viewBox="0 0 200 260">{children}</Svg>
    </Animated.View>
  );
}

const Sleeves = ({ c }: { c: string }) => (
  <>
    <Path d="M26 262c-4-40 4-80 36-96l8 18c-18 16-18 44-14 78z" fill={c} />
    <Path d="M174 262c4-40-4-80-36-96l-8 18c18 16 18 44 14 78z" fill={c} />
  </>
);
const Torso = ({ c }: { c: string }) => <Path d="M18 262c0-60 26-100 66-110h32c40 10 66 50 66 110z" fill={c} />;

function Steam({ clock, x, phase, k }: { clock: SharedValue<number>; x: number; phase: number; k: number }) {
  const s = useAnimatedStyle(() => {
    const p = (clock.value * 3 + phase) % 1;
    return { opacity: p < 0.4 ? p * 2 : 0.8 * (1 - (p - 0.4) / 0.6), transform: [{ translateY: -14 * k * p }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x * k, top: 176 * k, width: 12 * k, height: 20 * k }, s]}>
      <Svg width={12 * k} height={20 * k} viewBox="0 0 12 20"><Path d="M6 18Q1 12 6 6" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" /></Svg>
    </Animated.View>
  );
}

export default function SunriseOutfitPersonMk7({ variant, width }: { variant: OutfitVariant; width: number }) {
  const W = width, H = width * 1.3, k = W / 200;
  const clock = useSharedValue(0);
  const blink = useSharedValue(0);
  const breathe = useSharedValue(0);
  const nod = useSharedValue(0);
  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    blink.value = withRepeat(withTiming(1, { duration: 4600, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }), -1, true);
    nod.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [clock, blink, breathe, nod]);

  const bodyS = useAnimatedStyle(() => ({
    transform: [{ translateY: H / 2 }, { scaleX: 1 + 0.008 * breathe.value }, { scaleY: 1 + 0.02 * breathe.value }, { translateY: -H / 2 }],
  }));
  const headS = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1.4 + 2.8 * nod.value}deg` }, { translateY: -1 * nod.value }],
  }));
  const lidProps = useAnimatedProps(() => ({ opacity: blink.value > 0.93 && blink.value < 0.97 ? 1 : 0 }));

  return (
    <View pointerEvents="none" style={{ width: W, height: H }}>
      <Animated.View style={[{ width: W, height: H }, bodyS]}>
        {/* neck */}
        <Svg width={W} height={H} viewBox="0 0 200 260" style={{ position: 'absolute' }}>
          <Path d="M87 118h26v30c-6 8-20 8-26 0z" fill="#DE9C72" />
        </Svg>

        {/* CAFÉ */}
        <Layer W={W} H={H} on={variant === 0}>
          <Torso c="#FFF1D2" />
          <Path d="M86 150l14 14 14-14" fill="#DE9C72" />
          <Path d="M82 148l18 20 18-20" fill="none" stroke="#E8D3A0" strokeWidth={3} />
          <Path d="M72 262l-4-92h64l-4 92z" fill="#C4531F" />
          <Path d="M80 152l-10 20M120 152l10 20" stroke="#A8431A" strokeWidth={6} strokeLinecap="round" />
          <Rect x={76} y={196} width={22} height={18} rx={3} fill="#A8431A" opacity={0.55} />
          <Rect x={124} y={182} width={14} height={8} rx={2} fill="#FFF1D2" />
          <Sleeves c="#F4E2B6" />
          <Path d="M86 196h28l-3 34H89z" fill="#fff" />
          <Rect x={85} y={206} width={30} height={10} fill="#F5B52B" />
          <Path d="M114 200c8 0 8 12 0 12" fill="none" stroke="#fff" strokeWidth={3.5} />
          <Ellipse cx={82} cy={224} rx={9} ry={7} fill={HAND} /><Ellipse cx={118} cy={224} rx={9} ry={7} fill={HAND} />
        </Layer>

        {/* DELIVERY */}
        <Layer W={W} H={H} on={variant === 1}>
          <Torso c="#F5B52B" />
          <Path d="M66 262c-6-40-4-80 18-112h-6c-28 28-40 70-38 112zM134 262c6-40 4-80-18-112h6c28 28 40 70 38 112z" fill="#E09B10" />
          <Path d="M78 150l22 26 22-26-8-8H86z" fill="#E09B10" />
          <Path d="M100 176v86" stroke="#B9780A" strokeWidth={3} />
          <Rect x={30} y={206} width={140} height={9} fill="#fff" opacity={0.85} />
          <Path d="M62 150l82 112" stroke="#0A4D55" strokeWidth={12} opacity={0.9} />
          <Sleeves c="#F5B52B" />
          <Path d="M70 200l30-14 30 14v36l-30 14-30-14z" fill="#E8B27A" />
          <Path d="M70 200l30 14 30-14M100 214v36" stroke="#C48A4E" strokeWidth={3} fill="none" />
          <Rect x={88} y={192} width={24} height={9} fill="#F7D27A" />
          <Ellipse cx={72} cy={226} rx={9} ry={8} fill={HAND} /><Ellipse cx={128} cy={226} rx={9} ry={8} fill={HAND} />
        </Layer>

        {/* OFFICE */}
        <Layer W={W} H={H} on={variant === 2}>
          <Torso c="#073B42" />
          <Path d="M84 150l16 112 16-112-16 8z" fill="#fff" />
          <Path d="M84 150l-14 14 18 60 12-62zM116 150l14 14-18 60-12-62z" fill="#0A5560" />
          <Path d="M96 160h8l4 14-8 56-8-56z" fill="#C4531F" />
          <Path d="M92 158h16l-8 8z" fill="#9E3F16" />
          <Path d="M76 140c10 40 14 70 24 90" stroke="#9FE3E0" strokeWidth={2.5} fill="none" />
          <Rect x={108} y={196} width={18} height={24} rx={4} fill="#9FE3E0" />
          <Circle cx={117} cy={203} r={3.5} fill="#073B42" />
          <Sleeves c="#0A5560" />
          <Rect x={66} y={204} width={68} height={44} rx={6} fill="#14272B" />
          <Rect x={71} y={209} width={58} height={34} rx={3} fill="#EAF6F5" />
          <Path d="M78 217h30M78 226h40M78 235h22" stroke="#0E7C86" strokeWidth={3} strokeLinecap="round" />
          <Ellipse cx={68} cy={230} rx={9} ry={8} fill={HAND} /><Ellipse cx={132} cy={228} rx={9} ry={8} fill={HAND} />
        </Layer>

        {variant === 0 && (<><Steam clock={clock} x={90} phase={0} k={k} /><Steam clock={clock} x={102} phase={0.5} k={k} /></>)}

        {/* HEAD (nods) */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, headS]}>
          <Svg width={W} height={H} viewBox="0 0 200 260" style={{ position: 'absolute' }}>
            <Ellipse cx={68} cy={92} rx={5.5} ry={9} fill="#E2A176" /><Ellipse cx={132} cy={92} rx={5.5} ry={9} fill="#E2A176" />
            <Path d="M70 80C70 56 84 48 100 48s30 8 30 32v16c0 20-14 34-30 34S70 116 70 96z" fill={SKIN} />
            <Path d="M130 84v12c0 20-14 34-30 34 18-4 26-18 26-40z" fill="#DE9C72" opacity={0.35} />
            <Path d="M92 124q8 5 16 0" stroke="#CE8C60" strokeWidth={2} fill="none" opacity={0.6} />
            <Path d="M66 86C58 52 80 34 102 36c24 2 40 18 32 50-2-14-8-24-18-26-14 8-34 4-44 26z" fill="#2E1D17" />
            <Path d="M78 46c10-6 24-8 36-4" stroke="#5B3A2A" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
            <Path d="M80 72q8-5 16-1M104 71q8-4 16 1" stroke="#2E1D17" strokeWidth={3.2} fill="none" strokeLinecap="round" />
            <Ellipse cx={89} cy={85} rx={6} ry={4} fill="#fff" /><Circle cx={89.5} cy={85} r={3.2} fill="#3B2A20" /><Circle cx={90.6} cy={83.9} r={1} fill="#fff" />
            <Ellipse cx={111} cy={85} rx={6} ry={4} fill="#fff" /><Circle cx={111.5} cy={85} r={3.2} fill="#3B2A20" /><Circle cx={112.6} cy={83.9} r={1} fill="#fff" />
            <AnimatedG animatedProps={lidProps}><Ellipse cx={89} cy={85} rx={7} ry={5} fill={SKIN} /><Ellipse cx={111} cy={85} rx={7} ry={5} fill={SKIN} /></AnimatedG>
            <Path d="M82 81q7-4 14 0M104 81q7-4 14 0" stroke="#2E1D17" strokeWidth={1.6} fill="none" />
            <Path d="M100 89q-4 11 0 14 4 1 6-2" stroke="#D08A60" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Circle cx={80} cy={100} r={5.5} fill="#EE8F7C" opacity={0.4} /><Circle cx={120} cy={100} r={5.5} fill="#EE8F7C" opacity={0.4} />
            <Path d="M90 110q10 9 20 0q-10 3-20 0z" fill="#B65850" />
            <Path d="M90 110q10 4 20 0" stroke="#9A4540" strokeWidth={1.6} fill="none" />
          </Svg>
          <Layer W={W} H={H} on={variant === 1}>
            <Path d="M66 70C66 44 82 34 100 34s34 10 34 36c-12-6-24-8-34-8s-22 2-34 8z" fill="#0A4D55" />
            <Path d="M62 72c14-8 28-12 38-12s30 4 40 12c-12 2-24 0-40 0s-26 2-38 0z" fill="#073B42" />
            <Circle cx={100} cy={46} r={3.5} fill="#F5B52B" />
          </Layer>
          <Layer W={W} H={H} on={variant === 2}>
            <G fill="none" stroke="#14272B" strokeWidth={2.6}>
              <Circle cx={89} cy={85} r={10} fill="#fff" fillOpacity={0.14} /><Circle cx={111} cy={85} r={10} fill="#fff" fillOpacity={0.14} />
              <Path d="M99 84h2M79 83l-9-2M121 83l9-2" />
            </G>
          </Layer>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
