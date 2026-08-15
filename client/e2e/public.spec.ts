import { expect, test } from '@playwright/test';
import { installApiMocks } from './mock-api';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test('FT-006: a confirmation link is spent once and reports success (FR-001, DEF-011)', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/api/v1/auth/verify-email', async (route) => {
    posts += 1;
    // The real token is single-use, so anything past the first attempt must fail.
    return posts === 1
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Email confirmed. You can sign in now.' }),
        })
      : route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'BAD_REQUEST',
              message: 'This confirmation link is invalid or has expired',
            },
          }),
        });
  });

  await page.goto('/verify-email?token=e2e-verify-token');

  await expect(page.getByText('Email confirmed. You can sign in now.')).toBeVisible();
  await expect(page.getByText(/invalid or has expired/i)).toBeHidden();
  expect(posts).toBe(1);
});

test('FT-001: a visitor can open the landing page and browse the directory (FR-012)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Describe what happened in your own words.')).toBeVisible();
  await expect(page.getByText(/not a substitute for professional legal advice/i)).toBeVisible();

  await page.getByRole('button', { name: 'Browse lawyers' }).click();
  await expect(page).toHaveURL(/\/lawyers/);
  await expect(page.getByRole('heading', { name: 'Find a legal professional' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Akua Owusu' })).toBeVisible();
  await expect(page.getByText('Employment & Labour')).toBeVisible();
});
