import { type ComponentProps } from "react";
import { Linking, Text } from "react-native";

type Props = Omit<ComponentProps<typeof Text>, "onPress"> & { href: string };

/** Text that opens `href` in the device browser. */
export function ExternalLink({ href, ...rest }: Props) {
  return <Text accessibilityRole="link" {...rest} onPress={() => void Linking.openURL(href)} />;
}
