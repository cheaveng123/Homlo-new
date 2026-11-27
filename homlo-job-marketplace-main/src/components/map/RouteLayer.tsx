import type { Feature, LineString } from "geojson";
import { COLORS } from "../../config";
import { MapLibre } from "../../native-support";
import type { Coordinate } from "../../types";

export type RouteLayerProps = {
  shape: Feature<LineString> | null;
  fallback: Coordinate[] | null;
};

export function RouteLayer({ shape, fallback }: RouteLayerProps) {
  if (!MapLibre) return null;
  if (!shape && !fallback) return null;

  const { ShapeSource, LineLayer } = MapLibre;
  const sourceId = "job-detail-route";

  return (
    <>
      {shape ? (
        <ShapeSource id={sourceId} shape={shape} />
      ) : null}

      {shape ? (
        <>
          <LineLayer
            key="job-detail-route-casing"
            id="job-detail-route-casing"
            sourceID={sourceId}
            style={{
              lineColor: COLORS.routeCasing,
              lineWidth: 9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <LineLayer
            key="job-detail-route-line"
            id="job-detail-route-line"
            sourceID={sourceId}
            style={{
              lineColor: COLORS.primary,
              lineWidth: 5,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      ) : null}

      {!shape && fallback ? (
        <ShapeSource
          id="job-detail-route-fallback"
          shape={{ type: "LineString", coordinates: fallback.map((c) => [c.longitude, c.latitude]) }}
        >
          <LineLayer
            id="job-detail-route-fallback-line"
            sourceID="job-detail-route-fallback"
            style={{
              lineColor: COLORS.textMuted,
              lineWidth: 4,
              lineCap: "round",
              lineJoin: "round",
              lineDasharray: [2, 2],
            }}
          />
        </ShapeSource>
      ) : null}
    </>
  );
}
