import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";

import ImagePlaceholder from "./image-placeholder";
import { colors } from "./colors";
import { fonts, type } from "./typography";

type Props = {
  name: string;
  verified?: boolean;
  subtitle: string;
  avatarUrl?: string | null;
  onPress?: () => void;
};

export default function EmployerCard({ name, verified, subtitle, avatarUrl, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <ImagePlaceholder width={41} height={41} borderRadius={10} icon="user" />
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {verified ? (
            <Feather name="check-circle" size={16} color={colors.mint} style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 13,
  },
  avatar: {
    width: 41,
    height: 41,
    borderRadius: 10,
  },
  info: {
    flex: 1,
    marginLeft: 11,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  subtitle: {
    ...type.caption,
    color: colors.muted,
    marginTop: 1,
  },
});