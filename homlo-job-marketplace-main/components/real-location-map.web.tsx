import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE_URL } from "@/lib/map-config";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { useUserLocation } from "@/lib/use-user-location";

type RealLocationMapProps = { coordinate: MapCoordinate; radiusKm: number; onSelect: (coordinate: MapCoordinate) => void };
const openStreetMapStyle = MAP_STYLE_URL;

export function RealLocationMap({ coordinate, radiusKm, onSelect }: RealLocationMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialCoordinate = useRef(coordinate);
  const initialRadius = useRef(radiusKm);
  const onSelectRef = useRef(onSelect);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { location: userLocation } = useUserLocation({ requestOnMount: true });

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: elementRef.current, style: openStreetMapStyle, center: [initialCoordinate.current.longitude, initialCoordinate.current.latitude], zoom: 10.5, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true, showAccuracyCircle: true, fitBoundsOptions: { maxZoom: 15 } }), "top-right");
    map.on("click", (event: maplibregl.MapMouseEvent) => onSelectRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    map.on("load", () => {
      map.addSource("job-search-area", { type: "geojson", data: buildSelectionGeoJson(initialCoordinate.current, initialRadius.current) });
      map.addLayer({ id: "job-search-radius-fill", type: "fill", source: "job-search-area", filter: ["==", ["get", "kind"], "radius"], paint: { "fill-color": "#0B6F8A", "fill-opacity": 0.18 } });
      map.addLayer({ id: "job-search-radius-line", type: "line", source: "job-search-area", filter: ["==", ["get", "kind"], "radius"], paint: { "line-color": "#14324A", "line-width": 2 } });
      map.addLayer({ id: "job-search-center", type: "circle", source: "job-search-area", filter: ["==", ["get", "kind"], "center"], paint: { "circle-color": "#14324A", "circle-radius": 7, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2 } });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; userMarkerRef.current = null; };
  }, [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [userLocation.longitude, userLocation.latitude];
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ color: "#007AFF" })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText("Your location"))
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(lngLat);
    }
  }, [userLocation]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("job-search-area") as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildSelectionGeoJson(coordinate, radiusKm));
    map.easeTo({ center: [coordinate.longitude, coordinate.latitude], duration: 450 });
  }, [coordinate, radiusKm]);
  return <div ref={elementRef} style={{ height: "100%", width: "100%" }} />;
}

function buildSelectionGeoJson(center: MapCoordinate, radiusKm: number) {
  const points = 48;
  const coordinates: number[][] = [];
  const earthRadiusKm = 6371;
  const angularDistance = radiusKm / earthRadiusKm;
  const latRadians = (center.latitude * Math.PI) / 180;
  const lngRadians = (center.longitude * Math.PI) / 180;
  for (let index = 0; index <= points; index += 1) {
    const bearing = (2 * Math.PI * index) / points;
    const latitude = Math.asin(Math.sin(latRadians) * Math.cos(angularDistance) + Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearing));
    const longitude = lngRadians + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRadians), Math.cos(angularDistance) - Math.sin(latRadians) * Math.sin(latitude));
    coordinates.push([(longitude * 180) / Math.PI, (latitude * 180) / Math.PI]);
  }
  return { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { kind: "radius" }, geometry: { type: "Polygon" as const, coordinates: [coordinates] } }, { type: "Feature" as const, properties: { kind: "center" }, geometry: { type: "Point" as const, coordinates: [center.longitude, center.latitude] } }] };
}
