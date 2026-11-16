import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type AppMapWebProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  [key: string]: unknown;
};

export function AppMap({ style, children }: AppMapWebProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
      <View pointerEvents="none" style={styles.message}>
        <Text style={styles.messageText}>
          Interactive maps are available in the mobile app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#E8EEF0",
  },
  message: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 12,
    color: "#4F5E57",
  },
});

export default AppMap;
