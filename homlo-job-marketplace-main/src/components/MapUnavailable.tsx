import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type MapUnavailableProps = {
  title?: string;
  message?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function MapUnavailable({
  title = "Map needs a development build",
  message = "MapLibre is not available in Expo Go. Run npx expo run:ios or npx expo run:android, then open the Homlo development build.",
  height,
  style,
}: MapUnavailableProps) {
  return (
    <View
      style={[
        styles.container,
        height !== undefined ? { height } : null,
        style,
      ]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Native map</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#E8EEF0",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#DCE6EA",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#0891B2",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#12303C",
  },
  message: {
    maxWidth: 360,
    fontSize: 12,
    lineHeight: 17,
    color: "#5D7480",
  },
});
