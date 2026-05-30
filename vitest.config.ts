import path from "path";
// @ts-ignore
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      JWT_SECRET: "test-secret-for-vitest",
    },
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist-worker"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/app": path.resolve(__dirname, "./app"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
