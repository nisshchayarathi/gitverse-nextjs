import path from "path";
// @ts-ignore
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/app": path.resolve(__dirname, "./app"),
      "@/types": path.resolve(__dirname, "./types"),
      "@/services/security": path.resolve(__dirname, "./services/security"),
      "@/middleware": path.resolve(__dirname, "./middleware"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
