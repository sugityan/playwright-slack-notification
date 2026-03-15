import { test, expect } from '@playwright/test';

test('Should make failure', async ({ page }) => {
  await page.goto('data:text/html,<title>Playwright E2E</title><h1>Hello</h1>');
  await expect(page).toHaveTitle('Playwright');
  await expect(page.getByRole('heading', { name: 'Hello' })).toBeVisible();
});

test('Should make failure 2', async ({ page }) => {
 throw new Error('Intentional failure for testing Slack notifications');
});