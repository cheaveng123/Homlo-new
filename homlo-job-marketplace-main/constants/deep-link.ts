// The app's URL scheme. Deliberately kept at the original value so existing
// OAuth redirect URIs and deep links keep working after the HireNow rename.
// Must match CFBundleURLSchemes (ios/HireNow/Info.plist) and the intent filter
// in android/app/src/main/AndroidManifest.xml.
export const DEEP_LINK_SCHEME = "manushomlojobmarketplace";
