const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    actionTimeout: 12_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // CI exercises the same minified, single-file bundle Vercel deploys,
    // not only Vite's development server (which can mask Safari chart issues).
    command: process.env.PLAYWRIGHT_PRODUCTION === '1'
      ? 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
