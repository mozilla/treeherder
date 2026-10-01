const { defineConfig, devices } = require('@playwright/test');
const port = Number(process.env.PLAYWRIGHT_PORT || 5000);

module.exports = defineConfig({
  testDir: './tests/ui/integration',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI containers report the host's CPU count rather than the executor's
  // cgroup limit, so Playwright's default (cores / 2) massively oversubscribes
  // the 4-vCPU CircleCI executor and the run hangs. Pin workers to match it.
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : 'list',

  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-firefox',
      testMatch: '**/job-view/**/*.spec.js',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: `PORT=${port} BROWSER=none pnpm start`,
    port,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
