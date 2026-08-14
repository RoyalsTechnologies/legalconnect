import { expect, test } from '@playwright/test';
import { installApiMocks } from './mock-api';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test('FT-002: a citizen signs in, describes an issue, and sees the organised request (FR-001, FR-006)', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ama.mensah@example.com');
  await page.getByLabel('Password').fill('demo-password-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible();

  await page.getByRole('button', { name: 'Tell us what happened' }).click();
  await expect(page.getByRole('heading', { name: 'Tell us what happened' })).toBeVisible();

  await page
    .getByLabel('What happened?')
    .fill('My employer dismissed me last week without notice and still owes two months of salary.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/app\/intakes\/intake_e2e/);
  await expect(page.getByRole('heading', { name: 'Your organised request' })).toBeVisible();
  await expect(page.getByText('Employment & Labour')).toBeVisible();
  await expect(
    page.getByText('My employer dismissed me last week without notice', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'See suggested lawyers' })).toBeVisible();
});

test('FT-005: an expired session signs the citizen out and returns them to sign-in (FR-002)', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ama.mensah@example.com');
  await page.getByLabel('Password').fill('demo-password-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible();

  await page.route('**/api/v1/intakes', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
      });
    }
    await route.fallback();
  });

  await page.getByRole('button', { name: 'Tell us what happened' }).click();
  await expect(page.getByRole('heading', { name: 'Tell us what happened' })).toBeVisible();
  await page
    .getByLabel('What happened?')
    .fill('My employer dismissed me last week without notice and still owes two months of salary.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
