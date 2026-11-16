import { StyleSheet, View } from "react-native";

import { ShimmerIcon } from "@/components/shared/ShimmerIcon";

// A shimmering skeleton that mimics the popular search tile layout (image +
// text). The animation is a staggered diagonal light running across each card
// — the same motion language as the home-screen art — rather than the whole
// row pulsing in sync, which read as a flicker.
export function QuickSearchSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <ShimmerIcon key={index} delay={index * 180} pause={700} radius={16} style={styles.card}>
          <View style={styles.imageArea} />
          <View style={styles.copy}>
            <View style={styles.titleLine} />
            <View style={styles.subtitleLine} />
          </View>
        </ShimmerIcon>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // `ShimmerIcon` centres by default; the card wants its content stacked from
  // the top-left, and its `style` prop lands after those defaults so it wins.
  card: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8ECEA",
    borderWidth: 1,
    marginBottom: 12,
  },
  imageArea: { backgroundColor: "#E8F0EC", height: 52, width: "100%" },
  copy: { padding: 12 },
  titleLine: { backgroundColor: "#CAD5CF", borderRadius: 4, height: 14, marginBottom: 6, width: "70%" },
  subtitleLine: { backgroundColor: "#D8E1DC", borderRadius: 4, height: 11, width: "45%" },
});