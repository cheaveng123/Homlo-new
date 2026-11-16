import type { StyleProp, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";

type Props = {
  xml: string | null | undefined;
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Renders a job-field illustration from its inline SVG source. */
export function JobFieldArtwork({ xml, size = 56, width, height, style }: Props) {
  if (!xml) return null;
  return <SvgXml xml={xml} width={width ?? size} height={height ?? size} style={style} />;
}
