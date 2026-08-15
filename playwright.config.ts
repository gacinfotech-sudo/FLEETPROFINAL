import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Include both e2e tests and regression test suite
  testMatch: ['**/tests/e2e/**/*.spec.ts', '**/test/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-results/html' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5050',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.SKIP_SERVER ? undefined : 'npm run dev',
    port: 5050,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
