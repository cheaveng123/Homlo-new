import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  PanResponder,
  Modal,
  SafeAreaView,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import MapView, { Marker, Polygon, UrlTile } from 'react-native-maps';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';
import { AppIcon } from '@/components/ui/AppIcon';
import { MAP_TILE_URL } from '@/lib/map-config';
import { useUserLocation } from '@/lib/use-user-location';

export type LatLng = { latitude: number; longitude: number };

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  onAreaChange: (polygon: LatLng[]) => void;
  initialRegion?: Region;
};

const PHNOM_PENH = {
  latitude: 11.5564,
  longitude: 104.9282,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// react-native-maps exposes no usable pixel->coordinate conversion (the
// native coordinateForPoint rejects outside the Fabric bridge), so points are
// converted synchronously from the map's visible region and measured size.
const screenToCoordinate = (
  x: number,
  y: number,
  region: Region,
  size: { width: number; height: number }
): LatLng | null => {
  if (!region || size.width <= 0 || size.height <= 0) return null;
  return {
    latitude: region.latitude + (0.5 - y / size.height) * region.latitudeDelta,
    longitude: region.longitude + (x / size.width - 0.5) * region.longitudeDelta,
  };
};

// Inverse of screenToCoordinate: converts a drawn point back to screen space so
// the live trace can be painted as an SVG overlay that repaints on every move.
const coordinateToScreen = (
  point: LatLng,
  region: Region,
  size: { width: number; height: number }
): { x: number; y: number } => ({
  x: (0.5 + (point.longitude - region.longitude) / region.longitudeDelta) * size.width,
  y: (0.5 - (point.latitude - region.latitude) / region.latitudeDelta) * size.height,
});

export function DrawAreaMap({ onAreaChange, initialRegion }: Props) {
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [twoFinger, setTwoFinger] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastRegion, setLastRegion] = useState<Region>(initialRegion ?? PHNOM_PENH);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const pointsRef = useRef<LatLng[]>([]);
  const regionRef = useRef<Region>(initialRegion ?? PHNOM_PENH);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const drawingRef = useRef(drawing);
  const twoFingerRef = useRef(twoFinger);
  const interruptedRef = useRef(false);
  const onAreaChangeRef = useRef(onAreaChange);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    twoFingerRef.current = twoFinger;
  }, [twoFinger]);

  useEffect(() => {
    onAreaChangeRef.current = onAreaChange;
  });

  // Helper to finalize the trace. Guarded by `interrupted` so a two-finger
  // gesture (which abandons the lasso to let the user move the map) never
  // accidentally commits a half-drawn area.
  const finalizeTrace = () => {
    if (interruptedRef.current || pointsRef.current.length <= 2) return;
    const closed = [...pointsRef.current, pointsRef.current[0]];
    setPolygon(closed);
    onAreaChangeRef.current(closed);
    setDrawing(false);
  };

  // The panResponder lives on a transparent OVERLAY rendered above the
  // MapView. Hit-testing delivers the touch to the topmost view, so the
  // overlay — not the native MapView beneath — owns single-finger traces.
  // A two-finger gesture is detected on the wrapper (see syncTouchCount) and
  // flips the overlay to pointerEvents="none", so the touch falls through to
  // the MapView underneath and the user can pan/zoom with two fingers.
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => drawingRef.current,
      onMoveShouldSetPanResponder: () => drawingRef.current,
      onPanResponderGrant: () => {
        interruptedRef.current = false;
        pointsRef.current = [];
        setPolygon([]);
      },
      onPanResponderMove: (evt) => {
        // A second finger means "move the map", not "draw": drop the lasso so
        // the running gesture is never committed (see finalizeTrace).
        if (evt.nativeEvent.touches.length > 1) {
          interruptedRef.current = true;
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const coord = screenToCoordinate(locationX, locationY, regionRef.current, sizeRef.current);
        if (!coord) return;
        // Thin the points out so the polygon stays light.
        const last = pointsRef.current[pointsRef.current.length - 1];
        if (
          !last ||
          Math.abs(last.latitude - coord.latitude) > 0.0004 ||
          Math.abs(last.longitude - coord.longitude) > 0.0004
        ) {
          pointsRef.current = [...pointsRef.current, coord];
          setPolygon(pointsRef.current);
        }
      },
      onPanResponderRelease: finalizeTrace,
      // A two-finger gesture can yank the responder away mid-draw; finalize
      // exactly like a normal release so we never leave a stuck draw state.
      onPanResponderTerminate: finalizeTrace,
    });
    setPanResponder(responder);
  }, []);

  // Counts active touches so a two-finger gesture unlocks the native map
  // (pan/zoom) while a single-finger trace keeps the map frozen for drawing.
  const syncTouchCount = (event: GestureResponderEvent) => {
    const active = drawingRef.current && event.nativeEvent.touches.length >= 2;
    if (active === twoFingerRef.current) return;
    twoFingerRef.current = active;
    setTwoFinger(active);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    sizeRef.current = { width, height };
    if (size.width !== width || size.height !== height) setSize({ width, height });
  };

  const onRegionChangeComplete = (region: Region) => {
    regionRef.current = region;
    setLastRegion(region);
  };

  const clear = () => {
    pointsRef.current = [];
    setPolygon([]);
    onAreaChange([]);
  };

  const touchHandlers = {
    onTouchStart: syncTouchCount,
    onTouchMove: syncTouchCount,
    onTouchEnd: syncTouchCount,
    onTouchCancel: syncTouchCount,
  };

  // Shared between the embedded card and the fullscreen modal so polygon,
  // drawing state, and controls behave identically in both.
  const renderMapArea = (isFullscreen: boolean) => (
    <>
      <MapView
        mapType="none"
        style={StyleSheet.absoluteFill}
        initialRegion={userLocation ? { ...userLocation, latitudeDelta: 0.12, longitudeDelta: 0.12 } : lastRegion}
        // Locked for a single-finger trace; unlocked the moment a second
        // finger lands so two-finger pan/zoom still works while drawing.
        scrollEnabled={!drawing || twoFinger}
        zoomEnabled={!drawing || twoFinger}
        rotateEnabled={false}
        pitchEnabled={false}
        showsMyLocationButton
        showsUserLocation
        onRegionChangeComplete={onRegionChangeComplete}
      >
        <UrlTile
          maximumZ={19}
          minimumZ={2}
          shouldReplaceMapContent
          urlTemplate={MAP_TILE_URL}
        />
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your location"
            description="You are here"
            pinColor="#007AFF"
            tracksViewChanges={false}
          />
        )}
        {!drawing && polygon.length > 2 && (
          <Polygon
            coordinates={polygon}
            strokeColor="#0F3D2B"
            strokeWidth={2}
            fillColor="rgba(93, 202, 165, 0.28)"
          />
        )}
      </MapView>

      {/* Live trace painted as an SVG overlay (react-native-maps' Polyline
          doesn't repaint reliably on every move). The map is frozen while
          drawing, so the screen-space projection stays stable; once drawing
          ends, the native Polygon above inherits all map movement. */}
      {drawing && polygon.length > 1 && size.width > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size.width} height={size.height}>
            <SvgPolyline
              points={polygon
                .map((point) => {
                  const screen = coordinateToScreen(point, lastRegion, size);
                  return `${screen.x},${screen.y}`;
                })
                .join(' ')}
              fill="none"
              stroke="#5DCAA5"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}

      {/* Transparent overlay that owns single-finger traces. When a second
          finger lands (twoFinger), pointerEvents flips to "none" so the touch
          falls through to the MapView underneath and the user can pan/zoom. */}
      {drawing && panResponder && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={twoFinger ? 'none' : 'auto'}
          {...panResponder.panHandlers}
        />
      )}

      <View style={styles.controls}>
        <Pressable
          style={[styles.control, drawing && styles.controlActive]}
          onPress={() => setDrawing((d) => !d)}
        >
          <Text style={[styles.controlText, drawing && styles.controlTextActive]}>
            {drawing ? 'Drawing…' : 'Draw area'}
          </Text>
        </Pressable>

        {polygon.length > 0 && (
          <Pressable style={styles.control} onPress={clear}>
            <AppIcon name="undo" size={14} color="#12271F" />
          </Pressable>
        )}

        {!isFullscreen && (
          <Pressable style={styles.control} onPress={() => setFullscreen(true)} hitSlop={6}>
            <AppIcon name="maximize" size={14} color="#12271F" />
          </Pressable>
        )}
      </View>

      {drawing && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>One finger traces — two fingers move the map</Text>
        </View>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <Modal animationType="fade" visible onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.fullscreenRoot}>
          <View style={styles.fullscreenHeader}>
            <Pressable onPress={() => setFullscreen(false)} hitSlop={10}>
              <AppIcon name="close" size={20} color="#12271F" />
            </Pressable>
            <Text style={styles.fullscreenTitle}>Draw area</Text>
          </View>
          <View
            style={styles.fullscreenMap}
            onLayout={onLayout}
            {...touchHandlers}
          >
            {renderMapArea(true)}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <View
      style={styles.wrapper}
      onLayout={onLayout}
      {...touchHandlers}
    >
      {renderMapArea(false)}
    </View>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  wrapper: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAF6EF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
  },
  fullscreenRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  fullscreenTitle: { fontSize: 15, fontWeight: '600', color: '#12271F' },
  fullscreenMap: { flex: 1, backgroundColor: '#EAF6EF' },
  controls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  control: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: '#5DCAA5' },
  controlText: { fontSize: 12, fontWeight: '500', color: '#12271F' },
  controlTextActive: { color: '#04342C' },
  hint: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(4, 52, 44, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hintText: { fontSize: 11, color: '#EAF6EF' },
});