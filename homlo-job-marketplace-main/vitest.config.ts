import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");
  return {
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: path.resolve(__dirname, "tests/stubs/react-native.ts") },
        { find: "@", replacement: path.resolve(__dirname) },
      ],
    },
    test: {
      env,
      include: ["tests/**/*.test.ts"],
    },
  };
});