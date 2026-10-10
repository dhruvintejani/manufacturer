const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.LIVE_BASE_URL || 'https://manufacturer-five.vercel.app';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-live-report', open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'live-desktop-chrome',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'live-mobile-safari',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
  ],
});
