import { MapLibre } from "../native-support";
import type { Coordinate } from "../types";
import { circlePolygon, pointFeature } from "../utils/geo";

export type UserLocationLayerProps = {
  location: Coordinate | null;
  accuracy?: number | null;
};

export function UserLocationLayer({
  location,
  accuracy,
}: UserLocationLayerProps) {
  if (!MapLibre || !location) return null;

  const { CircleLayer, FillLayer, LineLayer, ShapeSource } = MapLibre;

  const accuracyShape =
    typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy > 0
      ? circlePolygon(location, accuracy)
      : null;

  return (
    <>
      {accuracyShape ? (
        <ShapeSource id="user-location-accuracy" shape={accuracyShape}>
          <FillLayer
            id="user-location-accuracy-fill"
            style={{ fillColor: "rgba(10,132,255,0.16)" }}
          />
          <LineLayer
            id="user-location-accuracy-outline"
            style={{
              lineColor: "rgba(10,132,255,0.45)",
              lineWidth: 1,
            }}
          />
        </ShapeSource>
      ) : null}

      <ShapeSource
        id="user-location-dot"
        shape={pointFeature(location, { kind: "user-location" })}
      >
        <CircleLayer
          id="user-location-halo"
          style={{
            circleRadius: 15,
            circleColor: "rgba(10,132,255,0.18)",
          }}
        />
        <CircleLayer
          id="user-location-core"
          style={{
            circleRadius: 7,
            circleColor: "#0A84FF",
            circleStrokeColor: "#FFFFFF",
            circleStrokeWidth: 3,
          }}
        />
      </ShapeSource>
    </>
  );
}
