import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE_URL } from "@/lib/map-config";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { useUserLocation } from "@/lib/use-user-location";

type Marker = { id: string; coordinate: MapCoordinate; label: string; selected?: boolean };

type SearchResultsMapProps = {
  center: MapCoordinate;
  zoom: number;
  radiusKm: number;
  markers: Marker[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  onMapClick?: (coordinate: MapCoordinate) => void;
};

const styleUrl = MAP_STYLE_URL;
const selectedColor = "#16803C";
const neutralColor = "#FFFFFF";
const neutralBorder = "#16803C";

export function SearchResultsMap({ center, zoom, radiusKm, markers, selectedId, onSelectMarker, onMapClick }: SearchResultsMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerElementsRef = useRef<Record<string, maplibregl.Marker>>({});
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initialCenter = useRef(center);
  const initialZoom = useRef(zoom);
  const initialRadius = useRef(radiusKm);
  const onSelectMarkerRef = useRef(onSelectMarker);
  const onMapClickRef = useRef(onMapClick);
  const { location: userLocation } = useUserLocation({ requestOnMount: true });

  useEffect(() => {
    onSelectMarkerRef.current = onSelectMarker;
    onMapClickRef.current = onMapClick;
  });

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: elementRef.current, style: styleUrl, center: [initialCenter.current.longitude, initialCenter.current.latitude], zoom: initialZoom.current, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true, showAccuracyCircle: true, fitBoundsOptions: { maxZoom: 15 } }), "top-right");
    map.on("click", (event: maplibregl.MapMouseEvent) => onMapClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    map.on("load", () => {
      map.addSource("search-area", { type: "geojson", data: buildAreaGeoJson(initialCenter.current, initialRadius.current) });
      map.addLayer({ id: "search-radius-fill", type: "fill", source: "search-area", filter: ["==", ["get", "kind"], "radius"], paint: { "fill-color": selectedColor, "fill-opacity": 0.1 } });
      map.addLayer({ id: "search-radius-line", type: "line", source: "search-area", filter: ["==", ["get", "kind"], "radius"], paint: { "line-color": selectedColor, "line-opacity": 0.5, "line-width": 1.5 } });
      map.addLayer({ id: "search-center", type: "circle", source: "search-area", filter: ["==", ["get", "kind"], "center"], paint: { "circle-color": selectedColor, "circle-radius": 5, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2 } });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; userMarkerRef.current = null; };
  }, []);

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
    const source = map.getSource("search-area") as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildAreaGeoJson(center, radiusKm));
    map.easeTo({ center: [center.longitude, center.latitude], zoom, duration: 420 });
  }, [center, radiusKm, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handle = map.once("load", () => {
      Object.values(markerElementsRef.current).forEach((marker) => marker.remove());
      markerElementsRef.current = {};
      markers.forEach((marker) => {
        const element = createMarkerElement(marker, selectedId === marker.id, () => onSelectMarkerRef.current?.(marker.id));
        const mapMarker = new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([marker.coordinate.longitude, marker.coordinate.latitude]).addTo(map);
        markerElementsRef.current[marker.id] = mapMarker;
      });
    });
    return () => {
      void handle;
    };
  }, [markers, selectedId]);

  useEffect(() => {
    Object.entries(markerElementsRef.current).forEach(([id, marker]) => {
      const isSelected = id === selectedId;
      const element = marker.getElement();
      if (!element) return;
      element.dataset.selected = String(isSelected);
      element.style.background = isSelected ? selectedColor : neutralColor;
      element.style.color = isSelected ? "#FFFFFF" : selectedColor;
      element.style.borderColor = isSelected ? selectedColor : neutralBorder;
      element.style.transform = isSelected ? "scale(1.1)" : "scale(1)";
    });
  }, [selectedId]);

  return <div ref={elementRef} style={{ height: "100%", width: "100%" }} />;
}

function createMarkerElement(marker: Marker, selected: boolean, onClick: () => void) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", marker.label);
  element.dataset.id = marker.id;
  element.style.background = selected ? selectedColor : neutralColor;
  element.style.color = selected ? "#FFFFFF" : selectedColor;
  element.style.border = `1.5px solid ${selected ? selectedColor : neutralBorder}`;
  element.style.borderRadius = "999px";
  element.style.fontFamily = "Inter, system-ui, sans-serif";
  element.style.fontSize = "11px";
  element.style.fontWeight = "700";
  element.style.padding = "5px 9px";
  element.style.boxShadow = "0 2px 6px rgba(15,32,18,0.18)";
  element.style.cursor = "pointer";
  element.style.transition = "transform 160ms ease, background 160ms ease, color 160ms ease";
  element.style.transform = selected ? "scale(1.1)" : "scale(1)";
  element.style.maxWidth = "110px";
  element.style.overflow = "hidden";
  element.style.textOverflow = "ellipsis";
  element.style.whiteSpace = "nowrap";
  element.textContent = marker.label;
  element.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return element;
}

function buildAreaGeoJson(center: MapCoordinate, radiusKm: number) {
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