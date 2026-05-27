import path from "path";
// @ts-ignore
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/app": path.resolve(__dirname, "./app"),
    },
  },
});
