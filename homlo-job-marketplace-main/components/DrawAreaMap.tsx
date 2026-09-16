import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, { Polygon, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Undo2 } from 'lucide-react-native';

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

export function DrawAreaMap({ onAreaChange, initialRegion = PHNOM_PENH }: Props) {
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const pointsRef = useRef<LatLng[]>([]);
  const regionRef = useRef<Region>(initialRegion);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const drawingRef = useRef(drawing);
  const onAreaChangeRef = useRef(onAreaChange);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    onAreaChangeRef.current = onAreaChange;
  });

  // The panResponder must be created outside render so its handlers can read
  // refs; it is held in state (with the latest drawing/onAreaChange mirrored
  // through refs) so the overlay can spread its panHandlers in JSX.
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => drawingRef.current,
      onMoveShouldSetPanResponder: () => drawingRef.current,
      onPanResponderGrant: () => {
        pointsRef.current = [];
        setPolygon([]);
      },
      onPanResponderMove: (evt) => {
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
      onPanResponderRelease: () => {
        if (pointsRef.current.length > 2) {
          const closed = [...pointsRef.current, pointsRef.current[0]];
          setPolygon(closed);
          onAreaChangeRef.current(closed);
          setDrawing(false);
        }
        // Fewer than 3 points is a mis-draw: stay in drawing mode so the user
        // can trace the lasso again instead of it silently doing nothing.
      },
    });
    setPanResponder(responder);
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    sizeRef.current = { width, height };
  };

  const onRegionChangeComplete = (region: Region) => {
    regionRef.current = region;
  };

  const clear = () => {
    pointsRef.current = [];
    setPolygon([]);
    onAreaChange([]);
  };

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        scrollEnabled={!drawing}
        zoomEnabled={!drawing}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {drawing && polygon.length > 1 && (
          <Polyline
            coordinates={polygon}
            strokeColor="#5DCAA5"
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
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

      {drawing && panResponder && (
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
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
            <Undo2 size={14} color="#12271F" />
          </Pressable>
        )}
      </View>

      {drawing && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Drag to trace your area</Text>
        </View>
      )}
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