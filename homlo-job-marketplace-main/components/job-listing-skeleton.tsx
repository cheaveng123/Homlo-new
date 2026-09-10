import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

/** A low-contrast pulsing stand-in that matches the spacing of the redesigned job cards. */
export function JobListingSkeleton({ count = 3 }: { count?: number }) {
  const pulse = useSharedValue(0.38);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.72, { duration: 780, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.card, animatedStyle]}>
          <View style={styles.imageArea} />
          <View style={styles.body}>
            <View style={styles.titleLine} />
            <View style={styles.companyLine} />
            <View style={styles.salaryLine} />
            <View style={styles.metaRow}>
              <View style={styles.metaLine} />
              <View style={styles.metaLineShort} />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E8ECEA",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  imageArea: {
    aspectRatio: 16 / 9,
    backgroundColor: "#E8F0EC",
    width: "100%",
  },
  body: {
    padding: 14,
  },
  titleLine: {
    backgroundColor: "#CAD5CF",
    borderRadius: 4,
    height: 15,
    width: "78%",
  },
  companyLine: {
    backgroundColor: "#D8E1DC",
    borderRadius: 4,
    height: 11,
    marginTop: 7,
    width: "48%",
  },
  salaryLine: {
    backgroundColor: "#D8E1DC",
    borderRadius: 4,
    height: 14,
    marginTop: 12,
    width: "28%",
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  metaLine: {
    backgroundColor: "#E1E8E3",
    borderRadius: 4,
    height: 10,
    width: "36%",
  },
  metaLineShort: {
    backgroundColor: "#E1E8E3",
    borderRadius: 4,
    height: 10,
    width: "22%",
  },
});
