import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

config(); // .envを読み込む

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./lib"),
      "@generated": path.resolve(__dirname, "./generated"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
