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
      "@server": path.resolve(__dirname, "./src/server"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@subdomains": path.resolve(__dirname, "./src/server/subdomains"),
      "@generated": path.resolve(__dirname, "./generated"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
