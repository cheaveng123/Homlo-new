import React, { useEffect } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import LinearGradient from '@/lib/native/linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { C, F, shadow } from './01_exploreShared';

// Light Google-Maps-style theme: keeps roads/water/parks, hides business + transit clutter
const MAP_STYLE = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#CDEFD9' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#BEE3F2' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
const REGION = { latitude: 11.5564, longitude: 104.9282, latitudeDelta: 0.045, longitudeDelta: 0.045 };

function Pin({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + t.value * 1.9 }], opacity: 0.9 * (1 - t.value) }));
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * Math.sin(t.value * Math.PI) }] }));
  return (
    <View style={{ position: 'absolute', left: x - 7, top: y - 7 }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: -9, top: -9, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: color }, ring]} />
      <Animated.View style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 2.5, borderColor: '#fff' }, bob]} />
    </View>
  );
}

export function JobsMapHero({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, shadow]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={REGION}
        customMapStyle={MAP_STYLE}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
        toolbarEnabled={false} showsUserLocation={false} pointerEvents="none"
      />
      <LinearGradient pointerEvents="none" colors={['rgba(228,246,236,0.96)', 'rgba(228,246,236,0.55)', 'rgba(228,246,236,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <Pin x={70} y={150} color={C.forest} delay={0} />
      <Pin x={150} y={125} color={C.orange} delay={1200} />
      <Pin x={255} y={95} color={C.mint} delay={600} />
      <Pin x={320} y={62} color={C.mint} delay={1800} />

      <View style={{ position: 'absolute', left: 20, top: 22, width: 170 }}>
        <Text style={{ fontFamily: F.h800, fontSize: 24, color: C.forest }}>Jobs map</Text>
        <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.forest, opacity: 0.75, marginTop: 4 }}>30 nearest to you</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 220, borderRadius: 32, overflow: 'hidden', backgroundColor: '#E4F6EC' },
});
