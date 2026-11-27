import type {
  SymbolLayerStyle,
  CircleLayerStyle,
} from "@maplibre/maplibre-react-native";
import { COLORS } from "../../config";
import { MapLibre } from "../../native-support";
import type { JobPin } from "../../types";

const SUITCASE = require("./assets/job-suitcase.png");

const SOURCE_ID = "nearby-jobs";

export type JobPinLayersProps = {
  jobs: JobPin[];
  selectedId: string | null;
  onPinPress: (jobId: string) => void;
};

const pinStyle: SymbolLayerStyle = {
  iconImage: ["get", "icon"] as const,
  iconSize: 1,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

const clusterStyle: CircleLayerStyle = {
  circleColor: COLORS.primary,
  circleRadius: [
    "step",
    ["get", "point_count"],
    20,
    10,
    24,
    50,
    28,
  ],
  circleStrokeColor: COLORS.onPrimary,
  circleStrokeWidth: 2,
  circleOpacity: 0.96,
};

const clusterCountStyle: SymbolLayerStyle = {
  textField: ["to-string", ["get", "point_count"]] as const,
  textFont: ["Noto Sans Regular"],
  textSize: 12,
  textColor: COLORS.onPrimary,
  textAllowOverlap: true,
  textIgnorePlacement: true,
  textAnchor: "center",
};

export function JobPinLayers({ jobs, selectedId, onPinPress }: JobPinLayersProps) {
  if (!MapLibre) return null;

  const { Images, SymbolLayer, CircleLayer } = MapLibre;

  return (
    <>
      <Images images={{ "job-suitcase": SUITCASE }} />

      <CircleLayer
        id="nearby-clusters"
        sourceID={SOURCE_ID}
        filter={["has", "point_count"] as const}
        style={clusterStyle}
      />
      <SymbolLayer
        id="nearby-cluster-count"
        sourceID={SOURCE_ID}
        filter={["has", "point_count"] as const}
        style={clusterCountStyle}
      />

      <SymbolLayer
        id="nearby-job-pins"
        sourceID={SOURCE_ID}
        filter={["!", ["has", "point_count"]] as const}
        style={pinStyle}
      />
    </>
  );
}
