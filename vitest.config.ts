import { fileURLToPath } from "url";
import path from "path";
// @ts-ignore
import { defineConfig } from "vitest/config";

// Emulate __dirname cleanly for ES modules to resolve TypeScript errors
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", ".next/**", "dist/**", "**/*.d.ts"],
    },
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
