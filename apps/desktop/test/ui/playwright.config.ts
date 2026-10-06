import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://localhost:4181",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command:
      "npx vite apps/desktop/test/ui --config apps/desktop/test/ui/vite.config.ts",
    cwd: "../../../..",
    port: 4181,
    reuseExistingServer: false,
  },
});
