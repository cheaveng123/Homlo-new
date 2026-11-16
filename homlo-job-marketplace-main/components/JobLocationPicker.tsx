import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region, UrlTile, type MapPressEvent } from 'react-native-maps';
import { AppIcon } from '@/components/ui/AppIcon';
import {
  MAP_ATTRIBUTION,
  MAP_MAX_TILE_ZOOM,
  MAP_TILE_URL,
} from '@/lib/map-config';
import {
  reverseOpenStreetMapPlace,
  searchOpenStreetMapPlace,
  type MapCoordinate,
  type OpenStreetMapPlace,
} from '@/lib/openstreetmap-geocoding';
import { useUserLocation } from '@/lib/use-user-location';

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

function isValidCoordinate(coordinate: MapCoordinate | null | undefined): coordinate is MapCoordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toPickedAddress(place: OpenStreetMapPlace): PickedAddress | null {
  if (!isValidCoordinate(place.coordinate)) return null;
  return {
    latitude: place.coordinate.latitude,
    longitude: place.coordinate.longitude,
    city: place.city,
    district: place.district,
    street: place.addressLine,
    formatted:
      place.label ||
      [place.addressLine, place.district, place.city].filter(Boolean).join(', '),
  };
}

export function JobLocationPicker({ onSelect, initialRegion = PHNOM_PENH_REGION }: Props) {
  const mapRef = useRef<MapView>(null);
  const { location: userLocation } = useUserLocation({ requestOnMount: true });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenStreetMapPlace[]>([]);
  const [marker, setMarker] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [manualText, setManualText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const reverseController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchController.current?.abort();
      reverseController.current?.abort();
    };
  }, []);

  const applyPicked = (picked: PickedAddress) => {
    setMarker({ latitude: picked.latitude, longitude: picked.longitude });
    setAddress(picked);
    setManualText(picked.street || picked.formatted);
    setQuery(picked.formatted);
    setResults([]);
    setStatus(null);
    onSelect(picked);
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchController.current?.abort();

    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      setStatus(null);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const controller = new AbortController();
      searchController.current = controller;
      setSearching(true);
      setStatus(null);
      try {
        const found = await searchOpenStreetMapPlace(text, controller.signal);
        if (controller.signal.aborted) return;
        const valid = found.filter((place) => isValidCoordinate(place.coordinate));
        setResults(valid);
        setStatus(valid.length ? null : "No matching addresses found.");
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus("Location search is unavailable. Tap the map to pick a point.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
  };

  const pickResult = (place: OpenStreetMapPlace) => {
    const picked = toPickedAddress(place);
    if (!picked) {
      setStatus("That result has an invalid location. Tap the map instead.");
      return;
    }
    searchController.current?.abort();
    setSearching(false);
    applyPicked(picked);
    mapRef.current?.animateToRegion(
      {
        latitude: picked.latitude,
        longitude: picked.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400
    );
  };

  const selectCoordinate = async (coordinate: MapCoordinate) => {
    if (!isValidCoordinate(coordinate)) {
      setStatus("That point can't be used. Tap a different spot on the map.");
      return;
    }

    reverseController.current?.abort();
    const controller = new AbortController();
    reverseController.current = controller;
    setMarker(coordinate);

    try {
      const place = await reverseOpenStreetMapPlace(coordinate, controller.signal);
      if (controller.signal.aborted) return;
      const picked = toPickedAddress({ ...place, coordinate });
      if (!picked) {
        setStatus("We couldn't read that address. Move the pin and try again.");
        return;
      }
      applyPicked(picked);
    } catch {
      if (controller.signal.aborted) return;
      // Keep the selected coordinate even when reverse geocoding is offline.
      const picked: PickedAddress = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        city: address?.city ?? "",
        district: address?.district ?? "",
        street: address?.street ?? "",
        formatted: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
      };
      setAddress(picked);
      setStatus("Address lookup failed. The map pin will be saved with its coordinates.");
      onSelect(picked);
    }
  };

  const onMapPress = (event: MapPressEvent) => {
    void selectCoordinate(event.nativeEvent.coordinate);
  };

  const onMarkerDragEnd = (event: { nativeEvent: { coordinate: MapCoordinate } }) => {
    void selectCoordinate(event.nativeEvent.coordinate);
  };

  // Manual text edits the human-readable label only when a pin already exists.
  // Without a pin there is no coordinate pair, and this picker must never invent
  // one from the default map center.
  const commitManualAddress = (text: string) => {
    setManualText(text);
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!marker) {
      setStatus("Search for the address or tap the map to place the pin first.");
      return;
    }
    const picked: PickedAddress = {
      latitude: marker.latitude,
      longitude: marker.longitude,
      city: address?.city ?? "",
      district: address?.district ?? "",
      street: trimmed,
      formatted: trimmed,
    };
    setAddress(picked);
    setStatus(null);
    onSelect(picked);
  };

  const renderBody = (isFull: boolean) => (
    <View style={isFull ? styles.bodyFull : undefined}>
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

        {!isFull && (
          <Pressable
            style={styles.expandBtn}
            onPress={() => setFullscreen(true)}
            hitSlop={6}
            accessibilityLabel="Fullscreen map"
          >
            <AppIcon name="maximize" size={15} color="#12271F" />
          </Pressable>
        )}
      </View>

      {searching && (
        <View style={styles.searchStatus}>
          <ActivityIndicator size="small" color="#0F6E56" />
          <Text style={styles.searchStatusText}>Searching…</Text>
        </View>
      )}

      {status ? <Text style={styles.statusText}>{status}</Text> : null}

      {results.length > 0 && (
        <View style={styles.resultsBox}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
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

      <View style={isFull ? styles.mapWrapperFull : styles.mapWrapper}>
        <MapView
          ref={mapRef}
          mapType="none"
          style={styles.map}
          initialRegion={initialRegion}
          onPress={onMapPress}
          showsMyLocationButton
          showsUserLocation
        >
          <UrlTile
            maximumZ={MAP_MAX_TILE_ZOOM}
            minimumZ={2}
            shouldReplaceMapContent
            urlTemplate={MAP_TILE_URL}
          />
          {marker && (
            <Marker
              coordinate={marker}
              draggable
              onDragEnd={onMarkerDragEnd}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pin}>
                <AppIcon name="pin" size={20} color="#0F3D2B" />
              </View>
            </Marker>
          )}
        </MapView>
        <Text pointerEvents="none" style={styles.attribution}>
          {MAP_ATTRIBUTION}
        </Text>
      </View>

      {userLocation ? (
        <Text style={styles.locationHint}>Using your current location as a starting point.</Text>
      ) : null}

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

  return (
    <>
      {!fullscreen && renderBody(false)}

      <Modal
        animationType="slide"
        visible={fullscreen}
        onRequestClose={() => setFullscreen(false)}
      >
        <SafeAreaView style={styles.fullscreenRoot}>
          <View style={styles.fullscreenHeader}>
            <Pressable onPress={() => setFullscreen(false)} hitSlop={10}>
              <AppIcon name="close" size={20} color="#12271F" />
            </Pressable>
            <Text style={styles.fullscreenTitle}>Choose location</Text>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.fullscreenContent}
          >
            {renderBody(true)}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
  },
  expandBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
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
  searchStatus: { alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 8 },
  searchStatusText: { fontSize: 11.5, color: '#5F7A6E' },
  statusText: { fontSize: 11.5, color: '#9A3412', marginBottom: 8 },
  locationHint: { fontSize: 11, color: '#5F7A6E', marginTop: 6 },
  attribution: {
    position: 'absolute',
    right: 5,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.82)',
    fontSize: 9,
    color: '#5F7A6E',
  },
  mapWrapper: {
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EAF6EF',
  },
  mapWrapperFull: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EAF6EF',
    marginBottom: 10,
  },
  map: { flex: 1 },
  pin: { alignItems: 'center', justifyContent: 'center' },
  manualLabel: { fontSize: 11, color: '#5F7A6E', marginTop: 10, marginBottom: 4 },
  manualInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#12271F',
  },
  selectedLabel: { fontSize: 12, color: '#5F7A6E', marginTop: 10 },
  selectedValue: { color: '#12271F', fontWeight: '500' },

  bodyFull: { flex: 1 },
  fullscreenRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF2EF',
  },
  fullscreenTitle: { fontSize: 15, fontWeight: '600', color: '#12271F' },
  fullscreenContent: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
});