import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PolygonDrawMap } from '@/components/search/polygon-draw-map';

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

export function DrawAreaMap({ onAreaChange, initialRegion }: Props) {
  const [polygon, setPolygon] = useState<LatLng[]>([]);

  const update = useCallback(
    (next: LatLng[]) => {
      setPolygon(next);
      onAreaChange(next);
    },
    [onAreaChange],
  );

  const addPoint = useCallback(
    (point: LatLng) => update([...polygon, point]),
    [polygon, update],
  );

  const removeLast = useCallback(() => update(polygon.slice(0, -1)), [polygon, update]);
  const clear = useCallback(() => update([]), [update]);

  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <PolygonDrawMap
          center={
            initialRegion
              ? { latitude: initialRegion.latitude, longitude: initialRegion.longitude }
              : undefined
          }
          polygon={polygon}
          onAddPoint={addPoint}
          onRemoveLastPoint={removeLast}
          onClear={clear}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {polygon.length === 0
            ? 'Tap the map to start drawing an area'
            : `${polygon.length} point${polygon.length === 1 ? '' : 's'} · tap to add another`}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={polygon.length === 0}
            onPress={removeLast}
            style={[styles.action, polygon.length === 0 && styles.actionDisabled]}
          >
            <Text style={styles.actionText}>Undo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={polygon.length === 0}
            onPress={clear}
            style={[styles.action, polygon.length === 0 && styles.actionDisabled]}
          >
            <Text style={styles.actionText}>Clear</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: 1, borderColor: '#DDEAE6', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  map: { height: 300, backgroundColor: '#E4F0E7' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF4F1',
  },
  hint: { flex: 1, fontSize: 11.5, color: '#5F7A6E' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { borderRadius: 999, borderWidth: 1, borderColor: '#DDEAE6', paddingHorizontal: 12, paddingVertical: 6 },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontSize: 11.5, fontWeight: '700', color: '#0B6F8A' },
});
