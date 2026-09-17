import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    screenshot: "only-on-failure", trace: "retain-on-failure",
  },
  webServer: { command: "node tests/serve.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: false },
});
