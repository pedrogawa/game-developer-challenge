import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './performance',
  testMatch: 'profile.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'performance/playwright-report', open: 'never' }],
  ],
  outputDir: 'performance/test-results',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    headless: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--enable-precise-memory-info',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [{ name: 'chromium-performance', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
