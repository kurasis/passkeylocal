import { defineConfig } from '@playwright/test';

// E2E_BASE_URL runs the same tests against a deployed site (for example
// https://passkeylocal.top) instead of the local dist/ server.
const remote = process.env.E2E_BASE_URL;
const baseURL = remote ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // Honour an outbound HTTPS proxy when testing a deployed site.
    proxy: remote && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    // Chromium treats 127.0.0.1 as a secure context, so WebCrypto and service workers work.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    acceptDownloads: true
  },
  webServer: remote
    ? undefined
    : {
        command: 'node scripts/serve.mjs 4173',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: false
      }
});
