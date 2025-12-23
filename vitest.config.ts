import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import path from "path";
import { defineConfig } from "vitest/config";

config(); // .envを読み込む

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: { label: "FrontEnd", color: "white" },
          root: "./src/app",
          environment: "jsdom",
          setupFiles: [path.resolve(__dirname, "./vitest-cleanup-after-each.ts")],
          clearMocks: true,
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
      },
      {
        test: {
          name: { label: "BackEnd", color: "black" },
          root: "./src/server",
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
      },
    ],
  },
});

// export default defineConfig({
//   test: {
//     projects: [
//       // you can use a list of glob patterns to define your projects
//       // Vitest expects a list of config files
//       // or directories where there is a config file
//       'packages/*',
//       'tests/*/vitest.config.{e2e,unit}.ts',
//       // you can even run the same tests,
//       // but with different configs in the same "vitest" process
//       {
//         test: {
//           name: 'happy-dom',
//           root: './shared_tests',
//           environment: 'happy-dom',
//           setupFiles: ['./setup.happy-dom.ts'],
//         },
//       },
//       {
//         test: {
//           name: 'node',
//           root: './shared_tests',
//           environment: 'node',
//           setupFiles: ['./setup.node.ts'],
//         },
//       },
//     ],
//   },
// })
