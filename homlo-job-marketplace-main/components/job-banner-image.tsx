import { Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type JobBannerImageProps = {
  uri: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  /** When false, renders the image without a blurred background layer (default: true). */
  blur?: boolean;
};

/**
 * Single source of truth for rendering a job banner image across the Home
 * cards, the job detail hero, and the Post-a-Job previews.
 *
 * Default mode (`blur=true`): the entire image is always shown sharp and
 * un-cropped (`contain`), with a soft blurred copy filling leftover areas.
 *
 * Clean mode (`blur=false`): renders the image without the blurred
 * background layer. The caller controls the container dimensions (typically
 * via `aspectRatio`), so the image fills the area cleanly with `contain`.
 */
export function JobBannerImage({ uri, accessibilityLabel, style, blur = true }: JobBannerImageProps) {
  if (!uri) return null;

  if (Platform.OS === "web") {
    const background = { backgroundImage: `url("${uri}")`, backgroundPosition: "center" } as unknown as ViewStyle;
    if (!blur) {
      return (
        <View accessibilityLabel={accessibilityLabel} style={[styles.holder, style]}>
          <View
            style={[StyleSheet.absoluteFill, background, { backgroundRepeat: "no-repeat", backgroundSize: "contain" } as unknown as ViewStyle]}
          />
        </View>
      );
    }
    return (
      <View accessibilityLabel={accessibilityLabel} style={[styles.holder, style]}>
        <View
          style={[StyleSheet.absoluteFill, background, { backgroundRepeat: "no-repeat", backgroundSize: "cover", filter: "blur(18px)", transform: [{ scale: 1.25 }] } as unknown as ViewStyle]}
        />
        <View
          style={[StyleSheet.absoluteFill, background, { backgroundRepeat: "no-repeat", backgroundSize: "contain" } as unknown as ViewStyle]}
        />
      </View>
    );
  }

  if (!blur) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={[styles.holder, style]}>
        <Image resizeMode="contain" source={{ uri }} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.holder, style]}>
      <Image blurRadius={16} resizeMode="cover" source={{ uri }} style={StyleSheet.absoluteFill} />
      <Image resizeMode="contain" source={{ uri }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  holder: { overflow: "hidden", position: "relative" },
});
