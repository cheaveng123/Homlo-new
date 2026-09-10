import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import type { PolygonDrawMapProps } from "./polygon-draw-map";

const styleUrl = "https://tiles.openfreemap.org/styles/liberty";
const selectedColor = "#16803C";

export function PolygonDrawMap({ center, polygon, onAddPoint }: PolygonDrawMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialCenter = useRef(center ?? { latitude: 11.5564, longitude: 104.9282 });
  const onAddPointRef = useRef(onAddPoint);
  const readyRef = useRef(false);

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  });

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: elementRef.current,
      style: styleUrl,
      center: [initialCenter.current.longitude, initialCenter.current.latitude],
      zoom: 13,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.on("click", (event: maplibregl.MapMouseEvent) => {
      onAddPointRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });
    map.on("load", () => {
      map.addSource("draw-area", { type: "geojson", data: emptyGeoJson() });
      map.addLayer({ id: "draw-fill", type: "fill", source: "draw-area", filter: ["==", ["get", "kind"], "polygon"], paint: { "fill-color": selectedColor, "fill-opacity": 0.18 } });
      map.addLayer({ id: "draw-line", type: "line", source: "draw-area", filter: ["==", ["get", "kind"], "polygon"], paint: { "line-color": selectedColor, "line-opacity": 0.8, "line-width": 2 } });
      map.addLayer({ id: "draw-vertices", type: "circle", source: "draw-area", filter: ["==", ["get", "kind"], "vertex"], paint: { "circle-color": selectedColor, "circle-radius": 10, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 3 } });
      readyRef.current = true;
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; readyRef.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("draw-area") as maplibregl.GeoJSONSource | undefined;
    if (source && map.isStyleLoaded()) source.setData(buildDrawGeoJson(polygon));
  }, [polygon]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <div ref={elementRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

function emptyGeoJson() {
  return { type: "FeatureCollection" as const, features: [] };
}

function buildDrawGeoJson(polygon: MapCoordinate[]) {
  if (polygon.length < 2) return { type: "FeatureCollection" as const, features: [] };
  const closed = polygon.length >= 3 ? [...polygon, polygon[0]] : polygon;
  return {
    type: "FeatureCollection" as const,
    features: [
      polygon.length >= 3
        ? { type: "Feature" as const, properties: { kind: "polygon" }, geometry: { type: "Polygon" as const, coordinates: [closed.map((p) => [p.longitude, p.latitude])] } }
        : { type: "Feature" as const, properties: { kind: "polygon" }, geometry: { type: "LineString" as const, coordinates: closed.map((p) => [p.longitude, p.latitude]) } },
      ...polygon.map((p, index) => ({ type: "Feature" as const, properties: { kind: "vertex" }, geometry: { type: "Point" as const, coordinates: [p.longitude, p.latitude] } })),
    ],
  };
}
