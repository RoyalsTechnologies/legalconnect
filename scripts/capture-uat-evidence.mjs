/**
 * Captures browser evidence for the UAT walkthrough against a running deployment.
 *
 * The walkthrough itself is manual (docs/04-testing.md); this script only drives the
 * browser through the same steps so the screenshots are reproducible and so the file that
 * ends up in the submission package matches the state described in the write-up. It
 * captures nothing it did not observe: every screenshot below is the page as served.
 *
 *   node scripts/capture-uat-evidence.mjs [baseUrl] [citizenEmail] [citizenPassword] [intakeId]
 *
 * Passing an existing intake id captures that enquiry's screens instead of submitting a
 * new one, which keeps a re-run from spending another provider call on the deployment.
 *
 * Writes PNGs into docs/uat-evidence/ and prints the text it read off each page so the
 * observed values can be recorded in the testing report.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = (process.argv[2] ?? 'https://legalconnect-beryl.vercel.app').replace(/\/$/, '');
const email = process.argv[3] ?? 'ama.mensah@example.com';
const password = process.argv[4] ?? process.env.SEED_DEMO_PASSWORD ?? 'password';
const existingIntakeId = process.argv[5];

const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'uat-evidence');

const DESCRIPTION =
  'My landlord locked my room in Accra while I was at work and is keeping my belongings ' +
  'inside. I have paid rent up to the end of the year and have the receipts.';

async function shot(page, name, options = {}) {
  const path = join(outputDir, name);
  await page.screenshot({ path, ...options });
  console.log(`  saved ${name}`);
}

async function textOf(page, selector) {
  const element = page.locator(selector).first();
  return (await element.count()) ? ((await element.textContent()) ?? '').trim() : '(absent)';
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(180_000);

try {
  console.log(`UAT-006 — public home page: ${baseUrl}/`);
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  console.log(`  heading: ${await textOf(page, 'h1, h2')}`);
  await shot(page, 'uat-006-home-not-legal-advice.png', { fullPage: true });

  console.log(`UAT-002 — public lawyer directory: ${baseUrl}/lawyers`);
  await page.goto(`${baseUrl}/lawyers`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Find a legal professional' }).waitFor();
  console.log(
    `  lawyer cards: ${await page.getByRole('button', { name: 'View profile' }).count()}`,
  );
  await shot(page, 'uat-002-public-directory.png');

  console.log('UAT-001 — citizen signs in and describes a concern');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app$/);

  await page.goto(`${baseUrl}/app/intake`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Tell us what happened' }).waitFor();
  console.log(`  disclaimer on the intake screen: ${await textOf(page, '.ant-alert-message')}`);
  await shot(page, 'uat-006-intake-disclaimer.png');

  if (existingIntakeId) {
    await page.goto(`${baseUrl}/app/intakes/${existingIntakeId}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Your organised request' }).waitFor();
  } else {
    await page.getByLabel('What happened?').fill(DESCRIPTION);
    const submitted = Date.now();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/app\/intakes\/[^/]+$/);
    await page.getByRole('heading', { name: 'Your organised request' }).waitFor();
    console.log(`  intake stored in ${Math.round((Date.now() - submitted) / 1000)}s`);
  }
  console.log(`  url: ${page.url()}`);
  await shot(page, 'uat-001-organised-request.png', { fullPage: true });

  await page.getByRole('button', { name: 'See suggested lawyers' }).click();
  await page.waitForURL(/\/recommendations$/);
  await page.getByText('Suggested legal professionals').first().waitFor();
  await page.waitForLoadState('networkidle');
  // The page fades in, and a screenshot taken mid-transition catches two headers.
  await page.waitForTimeout(1500);
  // A taller viewport rather than fullPage: the header is sticky, so a full-page capture
  // parks it over the middle of the image and hides the match reason.
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, 'uat-001-recommendations.png');
} finally {
  await browser.close();
}
