import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorBoundaryState = { error: Error | null };

/**
 * Last-resort guard against an unrecoverable render crash (white screen).
 * Resetting re-renders the child tree so expo-router can rebuild the navigator
 * instead of leaving the user stuck on a blank screen.
 */
export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.screen}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.copy}>Homlo hit an unexpected error on this screen.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={this.reset}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { alignItems: "center", backgroundColor: "#F7F8F6", flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  icon: { alignItems: "center", backgroundColor: "#FBEcec", borderRadius: 22, height: 52, justifyContent: "center", width: 52 },
  iconText: { color: "#A04141", fontSize: 24, fontWeight: "800" },
  title: { color: "#17201A", fontSize: 18, fontWeight: "800", marginTop: 16 },
  copy: { color: "#66736A", fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" },
  button: { alignItems: "center", backgroundColor: "#0891B2", borderRadius: 13, marginTop: 22, minWidth: 160, paddingHorizontal: 20, paddingVertical: 13 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.86 },
});