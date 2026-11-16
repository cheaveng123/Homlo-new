import React, { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { JobLocationMap } from '@/components/job-location-map';
import { AppIcon } from '@/components/ui/AppIcon';
import {
  reverseOpenStreetMapPlace,
  searchOpenStreetMapPlace,
  type MapCoordinate,
  type OpenStreetMapPlace,
} from '@/lib/openstreetmap-geocoding';

export type PickedAddress = {
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  street: string;
  formatted: string;
};

type Props = {
  onSelect: (address: PickedAddress) => void;
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
};

const PHNOM_PENH: MapCoordinate = { latitude: 11.5564, longitude: 104.9282 };

function toPickedAddress(place: OpenStreetMapPlace): PickedAddress {
  return {
    latitude: place.coordinate.latitude,
    longitude: place.coordinate.longitude,
    city: place.city,
    district: place.district,
    street: place.addressLine,
    formatted: place.label || [place.addressLine, place.district, place.city].filter(Boolean).join(', '),
  };
}

export function JobLocationPicker({ onSelect, initialRegion }: Props) {
  const fallbackCoordinate: MapCoordinate = initialRegion
    ? { latitude: initialRegion.latitude, longitude: initialRegion.longitude }
    : PHNOM_PENH;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenStreetMapPlace[]>([]);
  const [marker, setMarker] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [manualText, setManualText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        setStatus('Searching…');
        const found = await searchOpenStreetMapPlace(text);
        setResults(found);
        setStatus(found.length ? null : 'No matching addresses.');
      } catch {
        setStatus('Location search is unavailable.');
      }
    }, 400);
  };

  const applyPicked = (picked: PickedAddress) => {
    setMarker({ latitude: picked.latitude, longitude: picked.longitude });
    setAddress(picked);
    setManualText(picked.street || picked.formatted);
    setQuery(picked.formatted);
    setResults([]);
    setStatus(null);
    onSelect(picked);
  };

  const pickResult = (place: OpenStreetMapPlace) => {
    applyPicked(toPickedAddress(place));
  };

  const handleMapChange = async (coordinate: MapCoordinate) => {
    setMarker(coordinate);
    try {
      const place = await reverseOpenStreetMapPlace(coordinate);
      applyPicked(toPickedAddress({ ...place, coordinate }));
    } catch {
      const picked: PickedAddress = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        city: address?.city || 'Phnom Penh',
        district: address?.district ?? '',
        street: address?.street ?? '',
        formatted: [address?.street, address?.district, address?.city].filter(Boolean).join(', ') || 'Pinned location',
      };
      setAddress(picked);
      onSelect(picked);
    }
  };

  const commitManualAddress = (text: string) => {
    setManualText(text);
    const trimmed = text.trim();
    if (!trimmed) return;
    const coordinate = marker ?? fallbackCoordinate;
    if (!marker) setMarker(coordinate);
    const picked: PickedAddress = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      city: address?.city || 'Phnom Penh',
      district: address?.district ?? '',
      street: trimmed,
      formatted: trimmed,
    };
    setAddress(picked);
    onSelect(picked);
  };

  return (
    <View>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={14} color="#5F7A6E" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search an address"
            placeholderTextColor="#5F7A6E"
          />
        </View>
      </View>

      {results.length > 0 && (
        <View style={styles.resultsBox}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => pickResult(item)}>
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.mapWrapper}>
        <JobLocationMap
          coordinate={marker}
          defaultCoordinate={fallbackCoordinate}
          onChange={(coordinate) => void handleMapChange(coordinate)}
        />
      </View>

      <Text style={styles.manualLabel}>Manual address</Text>
      <TextInput
        style={styles.manualInput}
        value={manualText}
        onChangeText={commitManualAddress}
        placeholder="Type the address exactly (optional)"
        placeholderTextColor="#8FA69B"
      />

      <Text style={styles.selectedLabel}>
        Selected:{' '}
        <Text style={styles.selectedValue}>
          {address ? address.formatted : 'tap the map, search, or type a manual address'}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBar: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDEAE6',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#12271F' },
  resultsBox: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: '#DDEAE6', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  resultRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EDF4F1' },
  resultText: { fontSize: 12.5, color: '#12271F' },
  status: { marginTop: 6, fontSize: 11.5, color: '#5F7A6E' },
  mapWrapper: { height: 260, marginTop: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E4F0E7' },
  manualLabel: { marginTop: 12, fontSize: 11, fontWeight: '700', color: '#5F7A6E' },
  manualInput: { marginTop: 4, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#DDEAE6', backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 13, color: '#12271F' },
  selectedLabel: { marginTop: 10, fontSize: 11, color: '#5F7A6E' },
  selectedValue: { fontWeight: '700', color: '#12271F' },
});
