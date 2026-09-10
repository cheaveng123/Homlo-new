import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.actionHitbox, pressed && styles.pressed]}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  title: { color: "#16211F", fontSize: 19, fontWeight: "600", letterSpacing: -0.35, lineHeight: 25 },
  actionHitbox: { paddingLeft: 10, paddingVertical: 3 },
  action: { color: "#16803C", fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.55 },
});
