import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE_URL } from "@/lib/map-config";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { colors } from "./colors";
import type { JobDistanceMapProps } from "./job-distance-map";

const openFreeMapStyle = MAP_STYLE_URL;

export function JobDistanceMap({
  userCoordinate,
  jobCoordinate,
  routeGeometry,
}: JobDistanceMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userLatitude = userCoordinate.latitude;
  const userLongitude = userCoordinate.longitude;
  const jobLatitude = jobCoordinate.latitude;
  const jobLongitude = jobCoordinate.longitude;
  const lineCoordinates =
    routeGeometry && routeGeometry.length > 1 ? routeGeometry : null;

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: elementRef.current,
      style: openFreeMapStyle,
      center: [jobLongitude, jobLatitude],
      zoom: 13,
      interactive: false,
    });

    new maplibregl.Marker({
      element: createMarkerElement("Your location", colors.mint),
      anchor: "center",
    })
      .setLngLat([userLongitude, userLatitude])
      .addTo(map);

    new maplibregl.Marker({
      element: createMarkerElement("Job location", colors.mintDeep),
      anchor: "center",
    })
      .setLngLat([jobLongitude, jobLatitude])
      .addTo(map);

    map.on("load", () => {
      map.addSource("job-distance-line", {
        type: "geojson",
        data: buildDistanceGeoJson(
          userLatitude,
          userLongitude,
          jobLatitude,
          jobLongitude,
          lineCoordinates,
        ),
      });
      map.addLayer({
        id: "job-distance-line-layer",
        type: "line",
        source: "job-distance-line",
        paint: {
          "line-color": colors.mintDark,
          "line-opacity": 0.95,
          "line-width": 3,
        },
      });

      const bounds = new maplibregl.LngLatBounds()
        .extend([userLongitude, userLatitude])
        .extend([jobLongitude, jobLatitude]);

      if (userLatitude === jobLatitude && userLongitude === jobLongitude) {
        map.jumpTo({ center: [jobLongitude, jobLatitude], zoom: 14 });
      } else {
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [jobLatitude, jobLongitude, userLatitude, userLongitude, lineCoordinates]);

  return (
    <div
      ref={elementRef}
      role="img"
      aria-label="Map showing your location connected to the job location"
      style={{
        width: "100%",
        height: 220,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
        backgroundColor: colors.mintTint,
      }}
    />
  );
}

function createMarkerElement(label: string, color: string) {
  const element = document.createElement("div");
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.style.width = "20px";
  element.style.height = "20px";
  element.style.borderRadius = "50%";
  element.style.backgroundColor = color;
  element.style.border = `3px solid ${colors.background}`;
  element.style.boxShadow = `0 0 0 2px ${color}, 0 2px 6px rgba(11, 61, 48, 0.24)`;
  return element;
}

function buildDistanceGeoJson(
  userLatitude: number,
  userLongitude: number,
  jobLatitude: number,
  jobLongitude: number,
  routeGeometry: MapCoordinate[] | null,
) {
  const coordinates =
    routeGeometry && routeGeometry.length > 1
      ? routeGeometry.map((point) => [point.longitude, point.latitude])
      : [
          [userLongitude, userLatitude],
          [jobLongitude, jobLatitude],
        ];
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  };
}
