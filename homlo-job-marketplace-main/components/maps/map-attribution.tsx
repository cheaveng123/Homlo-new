import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { MAP_ATTRIBUTION } from "@/lib/map-config";

export function MapAttribution({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <Text pointerEvents="none" style={[styles.text, style]}>
      {MAP_ATTRIBUTION}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: "absolute",
    right: 5,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.82)",
    fontSize: 9,
    color: "#5F7A6E",
  },
});
