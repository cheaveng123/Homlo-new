// Static asset module declarations.
//
// Neither `expo/types` nor React Native's own types ship a `*.png` module
// declaration, so `import icon from "@/assets/images/foo.png"` is a hard
// TS2307 without this. Metro resolves it to a numeric asset handle at
// runtime; the tests resolve it to a URL string. The declared value has to
// sit in the intersection of the two, which is why it is `ImageSourcePropType`
// rather than a bare `number` — that is exactly what `require()` hands back
// too, so this module is a drop-in for both import styles.
//
// Static imports only: Metro cannot bundle a computed asset path, so every
// `require`/`import` of an image has to be a literal.

declare module "*.png" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}

declare module "*.jpg" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}

declare module "*.jpeg" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}

declare module "*.webp" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}

declare module "*.gif" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}

// Unlike the image types above, a bundled video is only ever consumed as a
// source handle for `expo-video`'s `VideoSource` (which takes the numeric
// Metro asset id), so `number` is the honest declared type here rather than
// `ImageSourcePropType`.
declare module "*.mov" {
  const source: number;
  export default source;
}

declare module "*.mp4" {
  const source: number;
  export default source;
}
