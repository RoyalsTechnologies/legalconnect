import { expect, test } from '@playwright/test';
import { installApiMocks } from './mock-api';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
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
