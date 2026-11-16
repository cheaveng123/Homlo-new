import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { Icon, Job, PressableScale, SegmentedSwitch, ViewMode } from './ExploreUI';
import { c, fonts, r, shadow, sp, type } from './tokens';

/* Custom marker for the free map (MapLibre / OpenStreetMap). Use it as the marker's child view.
   Style the map itself to the palette: water #B5E2DF, parks #D8F0EE, land #E6F3F1, roads #FFFFFF, labels #58696B.
   Draw the radius as a map circle layer: stroke #0E7C86 dashed 1.5, fill rgba(14,124,134,0.07). */
export function PricePin({ pay, selected, index = 0 }: { pay: string; selected?: boolean; index?: number }) {
  const reduce = useReducedMotion();
  const pop = useSharedValue(reduce ? 1 : 0);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!reduce) pop.value = withDelay(index * 90, withSpring(1, { damping: 9, stiffness: 180 }));
  }, [index, reduce, pop]);
  useEffect(() => {
    if (reduce || !selected) return;
    ring.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1);
    return () => { cancelAnimation(ring); ring.value = 0; };
  }, [selected, reduce, ring]);
  const body = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.4 + 0.6 * pop.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - ring.value), transform: [{ scale: 0.8 + 1.2 * ring.value }] }));
  return (
    <Animated.View style={body}>
      {selected && <Animated.View pointerEvents="none" style={[styles.halo, halo]} />}
      <View style={[styles.pin, selected && styles.pinOn]}>
        <Text style={[type.meta, { fontFamily: fonts.semi, color: selected ? c.white : c.clay }]}>{pay}</Text>
        {selected && <View style={styles.pinSun} />}
      </View>
    </Animated.View>
  );
}

type Props = {
  map: React.ReactNode;              // the existing map view (with PricePin markers)
  radii: string[];                   // e.g. ['1 km','3 km','5 km','10 km']  (use the app's real options)
  radius: string;
  onRadius: (r: string) => void;
  title: string;                     // e.g. "42 jobs within 3 km"
  selected?: Job;
  onBack: () => void;
  onViewList: () => void;            // also used by the List side of the switch
  onSearch: () => void;
  onLocate: () => void;
  onOpenJob?: (j: Job) => void;
};

export default function JobMapScreen(p: Props) {
  const insets = useSafeAreaInsets();
  const sheetY = useSharedValue(reduceInit());
  const reduce = useReducedMotion();
  useEffect(() => {
    sheetY.value = reduce ? 0 : withDelay(350, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [reduce, sheetY]);
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const onSwitch = (v: ViewMode) => { if (v === 'list') p.onViewList(); };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>{p.map}</View>

      {/* Top controls stay still (no entrance animation). */}
      <LinearGradient pointerEvents="none" colors={[c.page, 'rgba(244,248,248,0.85)', 'rgba(244,248,248,0)']}
        locations={[0, 0.55, 1]} style={[styles.scrim, { height: insets.top + 190 }]} />
      <View style={[styles.top, { top: insets.top + sp.s }]}>
        <View style={styles.row}>
          <Pressable onPress={p.onBack} accessibilityLabel="Back" style={[styles.round, shadow.float]}>
            <Icon name="back" size={22} color={c.deep} />
          </Pressable>
          <PressableScale onPress={p.onSearch} style={[styles.searchBar, shadow.float]} accessibilityRole="search">
            <Icon name="search" size={20} color={c.teal} />
            <Text style={[type.body, { color: c.muted }]}>Search this area</Text>
          </PressableScale>
        </View>
        <SegmentedSwitch value="map" onChange={onSwitch} style={[styles.floatSeg, shadow.float]} />
        <View style={styles.row}>
          {p.radii.map((rd) => {
            const on = rd === p.radius;
            return (
              <PressableScale key={rd} onPress={() => p.onRadius(rd)} hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.rchip, on && styles.rchipOn]} accessibilityState={{ selected: on }}>
                <Text style={[type.meta, { fontFamily: on ? fonts.semi : fonts.body, color: on ? c.white : c.text }]}>{rd}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <Pressable onPress={p.onLocate} accessibilityLabel="My location"
        style={[styles.round, shadow.float, { position: 'absolute', right: sp.l, bottom: 232 + insets.bottom }]}>
        <Icon name="locate" size={22} color={c.teal} />
      </Pressable>

      <Animated.View style={[styles.sheet, { paddingBottom: sp.l + insets.bottom }, shadow.float, sheet]}>
        <View style={styles.grab} />
        <View style={styles.between}>
          <Text style={[type.section, { color: c.text }]}>{p.title}</Text>
          <Text style={[type.meta, { fontFamily: fonts.semi, color: c.teal }]}>Sort</Text>
        </View>
        {p.selected && (
          <PressableScale onPress={() => p.onOpenJob?.(p.selected!)} style={styles.pick} accessibilityRole="button">
            <View style={[styles.logo, { backgroundColor: p.selected.logoColor }]}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: c.white }}>{p.selected.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontFamily: fonts.heading, color: c.deep }]} numberOfLines={1}>{p.selected.title}</Text>
              <Text style={[type.meta, { color: c.deep }]} numberOfLines={1}>{p.selected.company} · {p.selected.distance}</Text>
            </View>
            <Text style={[type.body, { fontFamily: fonts.semi, color: c.clay }]}>{p.selected.pay}</Text>
          </PressableScale>
        )}
        <PressableScale onPress={p.onViewList} style={styles.cta} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.white }}>View all as list</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}
function reduceInit() { return 260; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E6F3F1' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  top: { position: 'absolute', left: sp.l, right: sp.l, gap: sp.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.s },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 999, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flex: 1, height: 48, borderRadius: 999, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: sp.s, paddingHorizontal: sp.l },
  floatSeg: { backgroundColor: c.card },
  rchip: { height: 36, paddingHorizontal: 14, borderRadius: r.chip, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  rchipOn: { backgroundColor: c.teal },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: r.sheet, borderTopRightRadius: r.sheet, paddingHorizontal: sp.l, paddingTop: sp.s },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.track, alignSelf: 'center', marginBottom: sp.m },
  pick: { marginTop: sp.m, flexDirection: 'row', alignItems: 'center', gap: sp.m, padding: sp.m, borderRadius: r.tile, backgroundColor: c.tint },
  logo: { width: 44, height: 44, borderRadius: r.tile, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: sp.m, height: 48, borderRadius: 999, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center' },
  pin: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: c.card, ...shadow.float },
  pinOn: { backgroundColor: c.teal },
  pinSun: { position: 'absolute', left: -4, top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: c.sun },
  halo: { position: 'absolute', left: -6, right: -6, top: -6, bottom: -6, borderRadius: 999, borderWidth: 2, borderColor: c.sun },
});
