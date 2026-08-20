import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/app",
  testMatch: "**/*.e2e.ts",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* 常に直列実行する。CI の並列化は shard 分割（ジョブごとに DB・サーバーを分離）が担い、
     shard 内の並列化は行わない。引き上げると同一 DB を複数ブラウザが同時操作し、
     toHaveCount による件数前提（100 箇所 / 22 ファイル）が崩れる。
     → docs/adr/20260727-55f-e2e-ci-parallelization-by-shard.md */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  /* CI は shard ごとに blob を出力し、merge-reports ジョブで 1 つの HTML に統合する */
  reporter: process.env.CI ? [["blob"], ["github"]] : [["list"], ["html", { open: "on-failure" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    /* Setup project for authentication */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
      dependencies: ["setup"],
      testIgnore: /\(auth\)/,
    },

    /* Auth tests run without storageState (they manage their own login) */
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /\(auth\)\/.*\.e2e\.ts/,
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    //   dependencies: ["setup"],
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    //   dependencies: ["setup"],
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
