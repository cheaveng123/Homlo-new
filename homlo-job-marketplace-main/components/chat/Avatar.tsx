import React, { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { getProfilePhotoUrl } from "../../lib/profile-photo";

type Props = {
  photo: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function Avatar({ photo, style, children }: Props) {
  const [failed, setFailed] = useState(false);
  const uri = getProfilePhotoUrl(photo);
  const showImage = !!uri && !failed;
  return (
    <View style={[style, { overflow: "hidden" }]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        children
      )}
    </View>
  );
}
