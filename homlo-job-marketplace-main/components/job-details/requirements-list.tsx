import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors } from "./colors";
import { type } from "./typography";

export default function RequirementsList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <Feather name="check" size={17} color={colors.mint} style={styles.icon} />
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  icon: {
    marginTop: 3,
    marginRight: 9,
  },
  text: {
    ...type.body,
    flex: 1,
    color: colors.ink,
  },
});