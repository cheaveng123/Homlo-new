import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Search, MapPin } from 'lucide-react-native';

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
  initialRegion?: Region;
};

const PHNOM_PENH_REGION: Region = {
  latitude: 11.5564,
  longitude: 104.9282,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// Nominatim (OpenStreetMap) is free and keyless, but its usage policy
// requires a descriptive User-Agent/Referer and asks that you don't hammer
// it — this is fine for a location picker a user taps a few times, but add
// your own caching layer before using it for anything higher-volume.
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function searchAddress(query: string) {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HomloJobs/1.0 (contact@homlo.app)' },
  });
  if (!res.ok) return [];
  return (await res.json()) as any[];
}

async function reverseGeocode(latitude: number, longitude: number) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HomloJobs/1.0 (contact@homlo.app)' },
  });
  if (!res.ok) return null;
  return (await res.json()) as any;
}

function toPickedAddress(latitude: number, longitude: number, raw: any): PickedAddress {
  const addr = raw?.address ?? {};
  const city = addr.city ?? addr.town ?? addr.village ?? '';
  const district = addr.suburb ?? addr.county ?? addr.city_district ?? '';
  const street = [addr.road, addr.house_number].filter(Boolean).join(' ');
  const formatted =
    raw?.display_name ?? [street, district, city].filter(Boolean).join(', ');
  return { latitude, longitude, city, district, street, formatted };
}

export function JobLocationPicker({ onSelect, initialRegion = PHNOM_PENH_REGION }: Props) {
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const found = await searchAddress(text);
      setResults(found);
    }, 400);
  };

  const pickResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const picked = toPickedAddress(lat, lon, item);
    setMarker({ latitude: lat, longitude: lon });
    setAddress(picked);
    setResults([]);
    setQuery(picked.formatted);
    onSelect(picked);
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lon, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400
    );
  };

  const onMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    const raw = await reverseGeocode(latitude, longitude);
    const picked = toPickedAddress(latitude, longitude, raw);
    setAddress(picked);
    setQuery(picked.formatted);
    onSelect(picked);
  };

  return (
    <View>
      <View style={styles.searchBar}>
        <Search size={14} color="#5F7A6E" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search an address"
          placeholderTextColor="#5F7A6E"
        />
      </View>

      {results.length > 0 && (
        <View style={styles.resultsBox}>
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.place_id)}
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => pickResult(item)}>
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={onMapPress}
        >
          {marker && (
            <Marker coordinate={marker}>
              <View style={styles.pin}>
                <MapPin size={20} color="#0F3D2B" fill="#5DCAA5" />
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      <Text style={styles.selectedLabel}>
        Selected:{' '}
        <Text style={styles.selectedValue}>
          {address ? address.formatted : 'tap the map or search above'}
        </Text>
      </Text>
    </View>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 12, color: '#12271F', padding: 0 },
  resultsBox: {
    maxHeight: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF2EF',
  },
  resultText: { fontSize: 12, color: '#12271F' },
  mapWrapper: {
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EAF6EF',
  },
  map: { flex: 1 },
  pin: { alignItems: 'center', justifyContent: 'center' },
  selectedLabel: { fontSize: 12, color: '#5F7A6E', marginTop: 10 },
  selectedValue: { color: '#12271F', fontWeight: '500' },
});