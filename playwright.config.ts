import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.WEB_TEST_URL || "http://127.0.0.1:18080",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: "list",
});
