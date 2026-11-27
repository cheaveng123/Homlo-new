/**
 * react-native-linear-gradient, typed to accept `as const` colour tuples (the
 * library's own props want a mutable array) like expo-linear-gradient did.
 */
import RNLinearGradient, { type LinearGradientProps } from "react-native-linear-gradient";

type Props = Omit<LinearGradientProps, "colors" | "locations"> & {
  colors: readonly (string | number)[];
  locations?: readonly number[] | null;
};

export default function LinearGradient({ colors, locations, ...rest }: Props) {
  return <RNLinearGradient colors={colors as (string | number)[]} locations={(locations ?? undefined) as number[] | undefined} {...rest} />;
}
