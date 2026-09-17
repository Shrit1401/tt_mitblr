import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const baseURL = process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:3000';
await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1150 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const requests = [];
await context.route('**/api/**', (route) => {
  requests.push(route.request().url());
  return route.abort();
});
const page = await context.newPage();
async function capture(name, route) {
  await page.goto(`${baseURL}/#${route}`);
  await page.locator('h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/images/${name}.png`, fullPage: true });
}
await capture('overview', 'overview');
await capture('borrowers', 'borrowers');
await capture('borrower', 'borrower/farmer');
await capture('comparison', 'comparison/farmer');
await page.getByRole('button', { name: 'Create decision draft' }).click();
await page
  .getByLabel('Why does this plan fit?')
  .fill(
    'The saved seasonal schedule follows stronger harvest receipts while preserving essentials and the protected cash buffer. Review adverse scenarios and confirm consent before any operational approval.',
  );
await page.getByLabel('Consent reference').fill('DEMO-REVIEW-001');
await page.getByRole('button', { name: 'Save decision draft' }).click();
await page.getByRole('button', { name: 'Mark reviewed' }).click();
await page.getByRole('button', { name: 'Dismiss notification' }).click();
await capture('decisions', 'decisions');
await page.goto(`${baseURL}/#scenarios`);
await page.getByRole('button', { name: /A later harvest/ }).click();
await page.getByRole('button', { name: 'Save scenario draft' }).click();
await page.getByRole('button', { name: 'Dismiss notification' }).click();
await page.screenshot({ path: 'docs/images/scenarios.png', fullPage: true });
await capture('evidence', 'evidence');
await page.getByRole('button', { name: /India Financial Diaries/ }).click();
await page.screenshot({ path: 'docs/images/evidence.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseURL}/#overview`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'docs/images/mobile.png' });
await browser.close();
if (requests.length) throw new Error(`Unexpected API requests: ${requests.join(', ')}`);
console.log('Captured eight real frontend screenshots. No API requests.');
