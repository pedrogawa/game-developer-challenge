import { defineConfig, devices } from '@playwright/test';

const deployedBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localBaseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: deployedBaseUrl ?? localBaseUrl,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      grep: /@mobile|@visual/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: deployedBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
