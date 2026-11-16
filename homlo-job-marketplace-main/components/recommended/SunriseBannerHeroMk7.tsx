// SunriseBannerHeroMk7.tsx — the complete Recommended banner:
// backdrop + person (outfit swap) + check chip + headline. Mobile only.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SunriseLagoonBackdropMk7 from './SunriseLagoonBackdropMk7';
import SunriseOutfitPersonMk7, { OutfitVariant } from './SunriseOutfitPersonMk7';
import SunriseJobChipMk7 from './SunriseJobChipMk7';

type Props = {
  title?: string;
  subtitle?: string;
  edgeColor?: string;        // MUST equal the screen background under the banner
  bodyHeight?: number;       // banner height below the status bar (default 290)
  cycleMs?: number;          // time per outfit (default 5600)
  headingFont?: string;      // app heading font family (Plus Jakarta Sans)
  bodyFont?: string;         // app body font family (Inter)
};

export default function SunriseBannerHeroMk7({
  title = 'Recommended for you',
  subtitle = 'Matched to your skills, schedule and area.',
  edgeColor = '#F4F8F8', bodyHeight = 290, cycleMs = 5600, headingFont, bodyFont,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [v, setV] = useState<OutfitVariant>(0);
  const i = useRef(0);
  useEffect(() => {
    const t = setInterval(() => { i.current = (i.current + 1) % 3; setV(i.current as OutfitVariant); }, cycleMs);
    return () => clearInterval(t);
  }, [cycleMs]);

  const H = insets.top + bodyHeight;
  const personW = Math.round(width * 0.54);       // large on purpose, about half the screen
  const personH = personW * 1.3;

  return (
    <View style={{ width, height: H, overflow: 'hidden' }}>
      <SunriseLagoonBackdropMk7 variant={v} edgeColor={edgeColor} />
      <View style={{ position: 'absolute', right: -width * 0.02, bottom: -personH * 0.04 }} pointerEvents="none">
        <SunriseOutfitPersonMk7 variant={v} width={personW} />
      </View>
      <View style={{ position: 'absolute', left: 22, top: insets.top + 24, width: width * 0.5 }}>
        <Text style={[s.title, { fontFamily: headingFont, fontSize: width < 420 ? 24 : 28, lineHeight: width < 420 ? 27 : 31 }]}>{title}</Text>
        <Text style={[s.sub, { fontFamily: bodyFont }]}>{subtitle}</Text>
      </View>
      <View style={{ position: 'absolute', left: 22, top: insets.top + 24 + 118 }}>
        <SunriseJobChipMk7 variant={v} headingFont={headingFont} bodyFont={bodyFont} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  title: { color: '#fff', fontSize: 28, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#D4EFEE', fontSize: 13, lineHeight: 18, marginTop: 9 },
});
