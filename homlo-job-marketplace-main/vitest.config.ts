import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");
  return {
    resolve: {
      alias: { "@": path.resolve(__dirname) },
    },
    test: {
      env,
      include: ["tests/**/*.test.ts"],
    },
  };
});