// Location question for the post-a-job flow, built on the app's current job map
// (src/components/AppMap + the MapChrome look): a rounded MapLibre map with a
// fixed centre pin (drag the map under it), a floating search pill, a round
// locate button, and an address card below. Reverse geocoding runs when the
// map settles; search results move the camera without a second lookup.
//
// Motion: decelerating ease only (SMOOTH), no springs. The pin lifts 10pt while
// the map moves and settles back when it stops.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppMap } from '@/src/components/AppMap';
import { NEARBY_RADIUS_KM } from '@/src/components/map/MapChrome';
import { FALLBACK_MAP_CENTER } from '@/src/config';
import { useLocation } from '@/src/context/LocationContext';
import { MapLibre, type CameraRef } from '@/src/native-support';
import type { Coordinate } from '@/src/types';
import { PressableScale, SMOOTH } from '@/src/design/motion';
import { Skeleton } from '@/src/design/primitives';
import { palette, radii, shadows } from '@/src/design/tokens';
import { TextNew } from '@/src/new/components/TextNew';
import { familyNew } from '@/src/new/theme/fontsNew';
import { haptic } from '@/lib/haptics';
import {
  reverseOpenStreetMapPlace,
  searchOpenStreetMapPlace,
  type OpenStreetMapPlace,
} from '@/lib/openstreetmap-geocoding';
import {
  CenterPinArt, ClearGlyph, LocateGlyph, PlaceGlyph, ReachGlyph, SearchPlaceGlyph, StorefrontGlyph, WarnGlyph,
} from './PostJobIcons';

export type MapChange = { address: string; latitude: number; longitude: number };

type Lookup = 'idle' | 'moving' | 'resolving' | 'resolved' | 'offline';
type Place = { title: string; subtitle: string };

const MAP_H = 300;
const PIN_W = 46;
const PIN_H = 58;

const valid = (c: Partial<Coordinate> | null | undefined): c is Coordinate =>
  !!c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
  && Math.abs(c.latitude as number) <= 90 && Math.abs(c.longitude as number) <= 180;

/**
 * "Central Market, 130 Street, Daun Penh, Phnom Penh, Cambodia" ->
 * title "Central Market", subtitle "130 Street, Daun Penh". A bare house number
 * as the first part falls back to the street line.
 */
function splitPlace(place: OpenStreetMapPlace): Place {
  const parts = place.label.split(',').map((p) => p.trim()).filter(Boolean);
  const head = parts[0] ?? '';
  const title = (head && !/^\d+\w{0,3}$/.test(head) ? head : place.addressLine || head) || 'Dropped pin';
  const subtitle = [place.addressLine, place.district, place.city]
    .filter((p, i, all) => p && p !== title && all.indexOf(p) === i)
    .slice(0, 2)
    .join(', ') || parts.slice(1, 3).join(', ');
  return { title, subtitle };
}

function addressOf(place: OpenStreetMapPlace) {
  return place.label || [place.addressLine, place.district, place.city].filter(Boolean).join(', ');
}

export function LocationMapPicker({
  value, onChange, onInteract,
}: {
  value: MapChange | null;
  onChange: (v: MapChange) => void;
  /** True while a finger is on the map, so the page scroll can pause. */
  onInteract?: (active: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const { location, requestPermission, permissionDenied } = useLocation();
  const cameraRef = useRef<CameraRef | null>(null);

  // Where the camera starts: the saved pin, else the employer's position, else the city.
  const [start] = useState<Coordinate>(() =>
    valid(value) ? { latitude: value.latitude, longitude: value.longitude } : location ?? FALLBACK_MAP_CENTER);
  const [startZoom] = useState(() => (valid(value) ? 16 : location ? 15 : 12.5));

  const [lookup, setLookup] = useState<Lookup>(valid(value) ? 'resolved' : 'idle');
  const [place, setPlace] = useState<Place | null>(
    valid(value) && value.address ? { title: value.address.split(',')[0] ?? value.address, subtitle: value.address.split(',').slice(1, 3).join(',').trim() } : null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenStreetMapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  /** The next camera stop came from code that already knows the address (a search pick). */
  const skipIdle = useRef(false);
  /** The next camera stop should be looked up even though no finger moved it (locate). */
  const resolveIdle = useRef(false);
  const pendingLocate = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCtl = useRef<AbortController | null>(null);
  const reverseCtl = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchCtl.current?.abort();
    reverseCtl.current?.abort();
  }, []);

  /* pin lift */
  const lift = useSharedValue(0);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * lift.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 0.32 - 0.16 * lift.value, transform: [{ scale: 1 - 0.35 * lift.value }] }));
  const setLift = (up: boolean) => {
    lift.value = reduce ? (up ? 1 : 0) : withTiming(up ? 1 : 0, { duration: up ? 160 : 220, easing: SMOOTH });
  };

  const fly = (c: Coordinate, zoom = 16) => {
    cameraRef.current?.setCamera({ centerCoordinate: [c.longitude, c.latitude], zoomLevel: zoom, animationDuration: reduce ? 0 : 450 });
  };

  const resolve = async (c: Coordinate) => {
    reverseCtl.current?.abort();
    const ctl = new AbortController();
    reverseCtl.current = ctl;
    setLookup('resolving');
    try {
      const found = await reverseOpenStreetMapPlace(c, ctl.signal);
      if (ctl.signal.aborted) return;
      setPlace(splitPlace(found));
      setLookup('resolved');
      onChange({ address: addressOf(found), latitude: c.latitude, longitude: c.longitude });
    } catch {
      if (ctl.signal.aborted) return;
      // Keep the spot even when the lookup is offline; the address can be typed below.
      const coords = `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
      setPlace({ title: 'Pinned spot', subtitle: coords });
      setLookup('offline');
      onChange({ address: value?.address || coords, latitude: c.latitude, longitude: c.longitude });
    }
  };

  const onMoveStart = (byUser: boolean) => {
    if (!byUser && !resolveIdle.current) return;
    setLift(true);
    setLookup('moving');
    reverseCtl.current?.abort();
  };

  const onIdle = (center: Coordinate, _zoom: number, byUser: boolean) => {
    setLift(false);
    if (skipIdle.current && !byUser) { skipIdle.current = false; return; }
    if (!byUser && !resolveIdle.current) {
      if (lookup === 'moving') setLookup(place ? 'resolved' : 'idle');
      return;
    }
    resolveIdle.current = false;
    if (!valid(center)) return;
    haptic.selection();
    void resolve(center);
  };

  const locate = () => {
    if (location) {
      resolveIdle.current = true;
      fly(location, 16.5);
      return;
    }
    pendingLocate.current = true;
    void requestPermission();
  };

  // Permission granted after a locate tap: fly there once the first fix arrives.
  useEffect(() => {
    if (!location || !pendingLocate.current) return;
    pendingLocate.current = false;
    resolveIdle.current = true;
    fly(location, 16.5);
    // fly is stable enough for a one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const onQuery = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchCtl.current?.abort();
    if (text.trim().length < 3) { setResults([]); setSearching(false); setSearchNote(null); return; }
    searchTimer.current = setTimeout(async () => {
      const ctl = new AbortController();
      searchCtl.current = ctl;
      setSearching(true);
      setSearchNote(null);
      try {
        const found = (await searchOpenStreetMapPlace(text, ctl.signal)).filter((p) => valid(p.coordinate));
        if (ctl.signal.aborted) return;
        setResults(found.slice(0, 5));
        setSearchNote(found.length ? null : 'No matching places. Try a street or landmark, or move the map.');
      } catch {
        if (ctl.signal.aborted) return;
        setResults([]);
        setSearchNote('Search is offline right now. Move the map to place the pin instead.');
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 400);
  };

  const pick = (p: OpenStreetMapPlace) => {
    searchCtl.current?.abort();
    setSearching(false);
    setResults([]);
    setQuery('');
    setFocused(false);
    Keyboard.dismiss();
    setPlace(splitPlace(p));
    setLookup('resolved');
    haptic.selection();
    onChange({ address: addressOf(p), latitude: p.coordinate.latitude, longitude: p.coordinate.longitude });
    if (MapLibre) {
      skipIdle.current = true;
      fly(p.coordinate, 16.5);
    }
  };

  const hasPin = valid(value) || lookup === 'resolving' || lookup === 'moving';

  return (
    <View>
      {/* Search pill (MapTopBar look) */}
      <View style={[s.search, shadows.card, focused && s.searchOn]}>
        <SearchPlaceGlyph size={20} color={focused ? palette.cyan : palette.slate} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search a street, building or landmark"
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          autoCorrect={false}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Search for the job's address"
          style={s.searchInput}
        />
        {searching ? <ActivityIndicator size="small" color={palette.cyan} /> : null}
        {!searching && query ? (
          <Pressable onPress={() => onQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <ClearGlyph />
          </Pressable>
        ) : null}
      </View>

      {results.length > 0 ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} exiting={reduce ? undefined : FadeOut.duration(120)} style={[s.results, shadows.card]}>
          {results.map((r, i) => {
            const p = splitPlace(r);
            return (
              <Pressable
                key={r.id}
                onPress={() => pick(r)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                style={({ pressed }) => [s.resultRow, i > 0 && s.resultDivider, pressed && { backgroundColor: palette.field }]}
              >
                <PlaceGlyph size={22} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextNew variant="body" weight="semibold" color={palette.ink} numberOfLines={1}>{p.title}</TextNew>
                  {p.subtitle ? <TextNew variant="caption" color={palette.muted} numberOfLines={1}>{p.subtitle}</TextNew> : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
      {searchNote ? (
        <View style={s.note}>
          <WarnGlyph size={14} color={palette.amberDeep} />
          <TextNew variant="caption" color={palette.amberInk} style={{ flex: 1 }}>{searchNote}</TextNew>
        </View>
      ) : null}

      {/* Map */}
      <View
        style={s.mapCard}
        onTouchStart={() => onInteract?.(true)}
        onTouchEnd={() => onInteract?.(false)}
        onTouchCancel={() => onInteract?.(false)}
      >
        {MapLibre ? (
          <AppMap
            style={StyleSheet.absoluteFill}
            initialCenter={start}
            initialZoom={startZoom}
            cameraRef={cameraRef}
            bannerTop={12}
            userLocation={location}
            onCameraMoveStart={onMoveStart}
            onCameraIdle={onIdle}
            attributionPosition={{ bottom: 8, left: 8 }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.mapFallback]}>
            <TextNew variant="caption" color={palette.muted} align="center">
              The map needs the Homlo development build. Search for the address above instead.
            </TextNew>
          </View>
        )}

        {/* Fixed centre pin: its tip marks the map centre. */}
        {MapLibre ? (
          <View pointerEvents="none" style={s.pinLayer}>
            <Animated.View style={[s.pinShadow, shadowStyle]} />
            <Animated.View style={[s.pin, pinStyle]}>
              <CenterPinArt width={PIN_W} />
            </Animated.View>
          </View>
        ) : null}

        {MapLibre && !hasPin ? (
          <View pointerEvents="none" style={s.hint}>
            <TextNew variant="caption" weight="semibold" color="#fff">Move the map to place the pin</TextNew>
          </View>
        ) : null}

        {MapLibre ? (
          <View style={s.locateSlot}>
            <PressableScale
              onPress={locate}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              style={[s.locate, shadows.lift]}
            >
              <LocateGlyph size={22} active={!!location} />
            </PressableScale>
          </View>
        ) : null}
      </View>

      {/* Use my location (big target, also explains a denied permission) */}
      <PressableScale onPress={locate} accessibilityRole="button" style={s.useMine}>
        <View style={s.useMineIcon}><LocateGlyph size={20} color={palette.cyanDeep} active={!!location} /></View>
        <View style={{ flex: 1 }}>
          <TextNew variant="body" weight="semibold" color={palette.cyanDeep}>Use my current location</TextNew>
          <TextNew variant="caption" color={palette.muted}>
            {permissionDenied ? 'Location is off. Allow it in Settings, or search above.' : "Best when you're at the workplace now"}
          </TextNew>
        </View>
      </PressableScale>

      {/* Address card */}
      <View style={[s.card, lookup === 'offline' && s.cardWarn]}>
        <View style={s.cardIcon}><StorefrontGlyph size={26} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextNew variant="caption" weight="semibold" color={palette.muted}>PIN LOCATION</TextNew>
          {lookup === 'resolving' || lookup === 'moving' ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="45%" height={11} />
            </View>
          ) : place ? (
            <>
              <TextNew variant="title" heading weight="bold" color={palette.ink} numberOfLines={2} style={{ marginTop: 2 }}>{place.title}</TextNew>
              {place.subtitle ? <TextNew variant="meta" color={palette.muted} numberOfLines={1}>{place.subtitle}</TextNew> : null}
            </>
          ) : (
            <TextNew variant="body" color={palette.muted} style={{ marginTop: 2 }}>No pin yet. Search, or move the map.</TextNew>
          )}
          {lookup === 'offline' ? (
            <View style={[s.note, { marginTop: 8, marginBottom: 0 }]}>
              <WarnGlyph size={14} color={palette.amberDeep} />
              <TextNew variant="caption" color={palette.amberInk} style={{ flex: 1 }}>
                {"We couldn't read the street name. The pin is saved; type the address below."}
              </TextNew>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.reach}>
        <ReachGlyph size={18} />
        <TextNew variant="caption" color={palette.slate} style={{ flex: 1 }}>
          {`Job seekers within ${NEARBY_RADIUS_KM} km see this job on the "Jobs near you" map.`}
        </TextNew>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: radii.pill,
    backgroundColor: palette.surface, paddingHorizontal: 16, borderWidth: 1.5, borderColor: palette.line,
  },
  searchOn: { borderColor: palette.cyan },
  searchInput: { flex: 1, fontFamily: familyNew.body.medium, fontSize: 15, color: palette.ink, paddingVertical: 12 },
  results: {
    marginTop: 8, borderRadius: radii.tile, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, overflow: 'hidden',
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.input, backgroundColor: palette.amberTint,
  },
  mapCard: {
    height: MAP_H, marginTop: 12, borderRadius: radii.card, overflow: 'hidden', backgroundColor: palette.placeholderA,
    borderWidth: 1, borderColor: palette.line,
  },
  mapFallback: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  pinLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // The pin's tip sits on the exact centre: shift it up by its own height / 2.
  pin: { position: 'absolute', top: MAP_H / 2 - PIN_H + 2 },
  pinShadow: {
    position: 'absolute', top: MAP_H / 2 - 4, width: 18, height: 8, borderRadius: 9, backgroundColor: palette.navy,
  },
  hint: {
    position: 'absolute', top: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill,
    backgroundColor: 'rgba(20,50,74,0.86)',
  },
  locateSlot: { position: 'absolute', right: 12, bottom: 12 },
  locate: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: palette.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  useMine: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: radii.tile,
    backgroundColor: '#F3FAFC', borderWidth: 1, borderColor: palette.cyanTint,
  },
  useMineIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center',
  },
  card: {
    flexDirection: 'row', gap: 12, marginTop: 12, padding: 14, borderRadius: radii.tile,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
  },
  cardWarn: { borderColor: '#F8D9A6' },
  cardIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: palette.cyanTint, alignItems: 'center', justifyContent: 'center',
  },
  reach: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 4 },
});
