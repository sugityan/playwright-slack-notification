import { defineConfig, devices } from '@playwright/test';

const reporters: any[] = process.env.CI
  ? [['github'], ['html', { open: 'never' }]]
  : [['list'], ['html', { open: 'never' }]];

if (process.env.SLACK_WEBHOOK_URL && process.env.SLACK_WEBHOOK_URL.trim().length > 0) {
  reporters.push(['./e2e/slack-reporter.ts']);
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: reporters,
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
