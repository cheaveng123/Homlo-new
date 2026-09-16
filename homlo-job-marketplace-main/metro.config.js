const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Expo SDK 57's Metro config has no built-in tsconfig `paths` handling, but the
// whole app imports via the "@/*" -> project root alias declared in tsconfig.json.
// Teach the resolver to rewrite those to absolute paths before the default
// resolver runs (default Metro resolution then handles extension lookup etc.).
const DEFAULT_RESOLVE_REQUEST = config.resolver.resolveRequest;
// The static-render (SSR) resolver context doesn't include `projectRoot`, so
// fall back to this config file's directory (project root) when it's absent.
const PROJECT_ROOT = __dirname;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    const root = context.projectRoot || PROJECT_ROOT;
    const absolutePath = require("node:path").resolve(root, moduleName.slice(2));
    return context.resolveRequest(context, absolutePath, platform);
  }
  return DEFAULT_RESOLVE_REQUEST
    ? DEFAULT_RESOLVE_REQUEST(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});