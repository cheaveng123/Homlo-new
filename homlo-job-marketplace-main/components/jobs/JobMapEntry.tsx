import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppIcon } from "@/components/ui/AppIcon";
import { router } from '@/lib/router';

const FOREST = '#0E3B2E';
const MINT = '#0891B2';
const MINT100 = '#DFF7E9';
const BORDER = '#E2E8E5';
const MUTED = '#66736A';
const SHADOW = '#173C25';

// Pin positions inside the 172x104 mini-map viewBox. The SVG scales to fill the tile via
// preserveAspectRatio="slice" (static drawing, not a live MapView).
const MINI_PINS: [number, number][] = [[46, 30], [128, 38], [62, 64], [118, 66], [100, 22]];

function MiniMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 172 104" preserveAspectRatio="xMidYMid slice">
      <Path d="M-10 70 L90 40 L190 60 M60 -10 L80 120 M120 -10 L100 120" stroke="#fff" strokeWidth={7} fill="none" />
      <Path d="M-10 30 L190 90" stroke="#fff" strokeWidth={4} fill="none" />
      {MINI_PINS.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={4.5} fill={FOREST} />
      ))}
      <Circle cx={86} cy={46} r={7} fill={MINT} stroke="#fff" strokeWidth={3} />
    </Svg>
  );
}

/** Guide illustration. Swap this component for an Image/asset whenever a final illustration exists. */
function GuideArt({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M8 20 24 14 40 20 56 14V46L40 52 24 46 8 52Z" fill="#BFE7D0" />
      <Path d="M24 14V46M40 20V52" stroke="#fff" strokeWidth={2} />
      <Path d="M26 32 32 44 38 32Z" fill={FOREST} />
      <Circle cx={32} cy={26} r={9} fill={FOREST} />
      <Circle cx={32} cy={26} r={3.5} fill="#fff" />
      <Circle cx={50} cy={42} r={4} fill="#F26A1B" />
    </Svg>
  );
}

type Props = { onPress?: () => void; nearbyCount?: number };

export function JobMapEntry({ onPress, nearbyCount = 30 }: Props) {
  const go = onPress ?? (() => router.push('/jobs-map'));
  return (
    <View style={s.row}>
      <Pressable
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={`Open jobs map, ${nearbyCount} jobs near you`}
        style={({ pressed }) => [s.tile, pressed && s.pressed]}
      >
        <View style={StyleSheet.absoluteFill}>
          <MiniMap />
        </View>
        <View style={s.labelWrap}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Jobs map</Text>
            <Text style={s.sub}>{nearbyCount} nearest to you</Text>
          </View>
          <View style={s.go}>
            <AppIcon name="chevron" size={14} color="#fff" />
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel="Explore nearby jobs"
        style={({ pressed }) => [s.side, pressed && s.pressed]}
      >
        <GuideArt />
        <Text style={s.sideText}>Explore nearby</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  // Sits inside the Search screen's heroHeader (20px gutter); the tile is fixed-width so the guide card flexes.
  row: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 16 },
  tile: {
    width: 210,
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E9F1EC',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: SHADOW,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  labelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: FOREST },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 11, color: MUTED },
  go: { width: 26, height: 26, borderRadius: 999, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' },
  side: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    backgroundColor: MINT100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sideText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: FOREST },
  pressed: { transform: [{ scale: 0.975 }] },
});
