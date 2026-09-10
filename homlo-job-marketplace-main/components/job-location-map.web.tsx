import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

type JobLocationMapProps = {
  coordinate: MapCoordinate | null;
  defaultCoordinate: MapCoordinate;
  onChange: (coordinate: MapCoordinate) => void;
};

const openStreetMapStyle = "https://tiles.openfreemap.org/styles/liberty";

export function JobLocationMap({ coordinate, defaultCoordinate, onChange }: JobLocationMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const initialCoordinate = useRef(coordinate ?? defaultCoordinate);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: elementRef.current, style: openStreetMapStyle, center: [initialCoordinate.current.longitude, initialCoordinate.current.latitude], zoom: 12, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    const marker = new maplibregl.Marker({ color: "#08675F" })
      .setLngLat([initialCoordinate.current.longitude, initialCoordinate.current.latitude])
      .addTo(map);
    markerRef.current = marker;
    map.on("click", (event: maplibregl.MapMouseEvent) => {
      onChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      marker.setLngLat(event.lngLat);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !coordinate) return;
    marker.setLngLat([coordinate.longitude, coordinate.latitude]);
    map.easeTo({ center: [coordinate.longitude, coordinate.latitude], duration: 350 });
  }, [coordinate]);
  return <div ref={elementRef} style={{ height: "100%", width: "100%" }} />;
}