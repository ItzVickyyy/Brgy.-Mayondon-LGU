import { defineConfig } from "@playwright/test";
import config from "./frontend/playwright.config";

export default defineConfig({
  ...config,
  testDir: "./frontend/tests",
  use: {
    ...config.use,
    launchOptions: {
      channel: "chrome",
    },
  },
});
