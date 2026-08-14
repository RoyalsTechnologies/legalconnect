import { expect, test } from '@playwright/test';
import { installApiMocks } from './mock-api';

test('FT-003: a lawyer pays for a plan and the UI shows the MoMo prompt then the active plan (FR-018)', async ({
  page,
}) => {
  await installApiMocks(page, { subscribeMode: 'pending' });
  await page.goto('/login');
  await page.getByLabel('Email').fill('akua.owusu@example.com');
  await page.getByLabel('Password').fill('demo-password-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Nothing is waiting on you' })).toBeVisible();
  await expect(page.getByText('Subscribe to appear in matching')).toBeVisible();

  await page.getByRole('button', { name: 'Choose a plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your professional profile' })).toBeVisible();
  await expect(page.getByText('Citizens cannot find you until you subscribe')).toBeVisible();

  const subscribe = page.waitForRequest((request) => {
    const path = new URL(request.url()).pathname;
    return request.method() === 'POST' && path.endsWith('/lawyers/me/subscription');
  });
  await page.getByRole('radio', { name: /Starter/ }).check();
  await page.getByLabel('Mobile money number').fill('0244123456');
  await page.getByRole('button', { name: 'Pay for this month' }).click();
  const started = await subscribe;
  expect(started.postDataJSON()).toMatchObject({
    packageId: 'pkg_starter',
    interval: 'month',
    phone: '0244123456',
  });

  await expect(page.getByText('Starter plan is active')).toBeVisible();
});

test('FT-004: a rejected collection shows the gateway message on the plan form (FR-018)', async ({
  page,
}) => {
  await installApiMocks(page, { subscribeMode: 'invalid' });
  await page.goto('/login');
  await page.getByLabel('Email').fill('akua.owusu@example.com');
  await page.getByLabel('Password').fill('demo-password-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'My profile' }).click();

  await page.getByRole('radio', { name: /Starter/ }).check();
  await page.getByLabel('Mobile money number').fill('0244123456');
  await page.getByRole('button', { name: 'Pay for this month' }).click();

  await expect(page.getByText('Invalid reference')).toBeVisible();
  await expect(page.getByText('Starter plan is active')).toHaveCount(0);
});
