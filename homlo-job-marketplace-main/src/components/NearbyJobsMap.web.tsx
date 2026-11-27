import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { JobPin } from "../types";

export type NearbyJobsMapProps = {
  jobs: JobPin[];
  onViewJob: (job: JobPin) => void;
  radiusKm?: number;
  maxPins?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function NearbyJobsMap({ jobs, height, style }: NearbyJobsMapProps) {
  return (
    <View
      style={[
        styles.container,
        height !== undefined ? { height } : null,
        style,
      ]}
    >
      <Text style={styles.title}>Nearby jobs map</Text>
      <Text style={styles.body}>
        {jobs.length} job{jobs.length === 1 ? "" : "s"} ready to show in the iOS
        and Android app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#E8EEF0",
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#12303C",
  },
  body: {
    fontSize: 12,
    color: "#5D7480",
  },
});
