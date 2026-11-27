const path = require("node:path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const PROJECT_ROOT = __dirname;
const base = getDefaultConfig(PROJECT_ROOT);

// The whole app imports via the "@/*" -> project root alias declared in
// tsconfig.json. Rewrite those to absolute paths before Metro resolves them.
// PUBLIC_* values are inlined by babel/public-env.js; key the transform cache
// on them so changing .env re-bundles instead of serving stale values.
const { loadPublicEnv } = require("./babel/public-env");
const publicEnvHash = require("node:crypto")
  .createHash("sha1")
  .update(JSON.stringify(loadPublicEnv(PROJECT_ROOT)))
  .digest("hex");

const config = mergeConfig(base, {
  cacheVersion: publicEnvHash,
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith("@/")) {
        const absolutePath = path.resolve(PROJECT_ROOT, moduleName.slice(2));
        return context.resolveRequest(context, absolutePath, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
});

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
