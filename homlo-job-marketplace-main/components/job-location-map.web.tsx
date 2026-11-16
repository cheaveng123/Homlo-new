import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE_URL } from "@/lib/map-config";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { useUserLocation } from "@/lib/use-user-location";

type JobLocationMapProps = {
  coordinate: MapCoordinate | null;
  defaultCoordinate: MapCoordinate;
  onChange: (coordinate: MapCoordinate) => void;
};

const openStreetMapStyle = MAP_STYLE_URL;

export function JobLocationMap({ coordinate, defaultCoordinate, onChange }: JobLocationMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userFitRef = useRef(false);
  const initialCoordinate = useRef(coordinate ?? defaultCoordinate);
  const coordinateRef = useRef(coordinate);
  const onChangeRef = useRef(onChange);
  const { location: userLocation, permissionStatus, requestPermission } = useUserLocation({ requestOnMount: true });

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    coordinateRef.current = coordinate;
  }, [coordinate]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: elementRef.current, style: openStreetMapStyle, center: [initialCoordinate.current.longitude, initialCoordinate.current.latitude], zoom: 12, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true, showAccuracyCircle: true, fitBoundsOptions: { maxZoom: 15 } }), "top-right");
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
      userMarkerRef.current = null;
      userFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      userFitRef.current = false;
      return;
    }
    const lngLat: [number, number] = [userLocation.longitude, userLocation.latitude];
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({ element: createUserMarkerElement(), anchor: "center" })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText("Your location"))
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(lngLat);
    }
    const job = coordinateRef.current;
    if (job && !userFitRef.current) {
      userFitRef.current = true;
      map.fitBounds([lngLat, [job.longitude, job.latitude]], { padding: 56, maxZoom: 15, duration: 450 });
    }
  }, [userLocation, coordinate]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !coordinate) return;
    marker.setLngLat([coordinate.longitude, coordinate.latitude]);
    if (!userLocation) map.easeTo({ center: [coordinate.longitude, coordinate.latitude], duration: 350 });
  }, [coordinate, userLocation]);
  function handleLocationBadgePress() {
    if (!userLocation) {
      void requestPermission();
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    try {
      map.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: Math.max(map.getZoom(), 15),
        duration: 400,
      });
    } catch {}
  }

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <div ref={elementRef} style={{ height: "100%", width: "100%" }} />
      <button
        type="button"
        aria-label={userLocation ? "Center map on your location" : "Show my current location"}
        onClick={handleLocationBadgePress}
        style={{
          alignItems: "center",
          background: "rgba(255,255,255,0.94)",
          border: "1px solid #E4ECEC",
          borderRadius: 999,
          color: "#14272B",
          cursor: "pointer",
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          gap: 6,
          left: 10,
          padding: "6px 10px",
          position: "absolute",
          top: 10,
        }}
      >
        <span style={{ background: userLocation ? "#007AFF" : "#C0392B", borderRadius: 4, height: 8, width: 8 }} />
        {userLocation ? "Center on me" : permissionStatus === "denied" ? "Turn on location" : "Locating you…"}
      </button>
    </div>
  );
}

function createUserMarkerElement() {
  const element = document.createElement("div");
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Your current location");
  element.style.background = "#007AFF";
  element.style.border = "3px solid #FFFFFF";
  element.style.borderRadius = "50%";
  element.style.boxShadow = "0 0 0 6px rgba(0,122,255,0.22), 0 2px 6px rgba(11,61,48,0.3)";
  element.style.height = "14px";
  element.style.width = "14px";
  return element;
}