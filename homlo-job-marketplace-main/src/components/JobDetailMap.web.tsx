import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { JobPin } from "../types";

export type JobDetailMapProps = {
  job: JobPin;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function JobDetailMap({ job, height, style }: JobDetailMapProps) {
  return (
    <View
      style={[
        styles.container,
        height !== undefined ? { height } : null,
        style,
      ]}
    >
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.body}>
        Route maps are available in the iOS and Android app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
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
