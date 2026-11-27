import { StyleSheet, View } from "react-native";

import { ShimmerIcon } from "@/components/shared/ShimmerIcon";

// A low-contrast shimmering stand-in that matches the spacing of the redesigned
// job cards. The animation is a staggered diagonal light per card — the same
// motion as the home-screen art — instead of the older whole-row opacity pulse
// with a scale "breathe", which flashed every card in sync.
export function JobListingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <ShimmerIcon key={index} delay={index * 140} pause={700} radius={20} style={styles.card}>
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
        </ShimmerIcon>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // `ShimmerIcon` centres by default; the card stacks from the top-left, and
  // its `style` prop lands after those defaults so it wins. The clip's `radius`
  // prop carries the corners (ShimmerIcon's overflow hidden keeps the artwork
  // box and the rounded corners crisp).
  card: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#E6EDEF",
    borderWidth: 1,
    // Rendered in `loadingBody` rather than in the list's `cardRow`, so this
    // card owns its own bottom gap and must match that row's 24px.
    marginBottom: 24,
  },
  imageArea: { aspectRatio: 16 / 9, backgroundColor: "#E6EDEF", width: "100%" },
  body: { paddingBottom: 22, paddingHorizontal: 20, paddingTop: 20 },
  titleLine: { backgroundColor: "#DCE6EA", borderRadius: 4, height: 15, width: "78%" },
  companyLine: { backgroundColor: "#DCE6EA", borderRadius: 4, height: 11, marginTop: 11, width: "48%" },
  salaryLine: { backgroundColor: "#DCE6EA", borderRadius: 4, height: 14, marginTop: 14, width: "28%" },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  metaLine: { backgroundColor: "#DCE6EA", borderRadius: 4, height: 10, width: "36%" },
  metaLineShort: { backgroundColor: "#DCE6EA", borderRadius: 4, height: 10, width: "22%" },
});