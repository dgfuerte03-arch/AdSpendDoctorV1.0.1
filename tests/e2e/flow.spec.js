import { test, expect } from '@playwright/test';

test('user can complete the flow and receive a verdict', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AdSpend Doctor' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Unlock the Verdict' })).toBeVisible();
  await page.getByRole('button', { name: 'Pay & Start' }).click();

  await expect(page.getByRole('heading', { name: 'Your Inputs' })).toBeVisible();
  await page.getByLabel('Business type').selectOption('E-commerce');
  await page.getByLabel('Primary objective').selectOption('Sales');
  await page.getByLabel('Monthly ad spend').fill('5000');
  await page.getByLabel('Timeframe (days)').fill('14');
  await page.getByLabel('CTR (All) %').fill('1.2');
  await page.getByLabel('Cost per result (CPA / CPL)').fill('35');
  await page.getByLabel('Destination').selectOption('Landing Page');
  await page.getByLabel('Results in timeframe (optional: purchases/leads)').fill('12');

  await page.getByRole('button', { name: 'Get My Verdict' }).click();

  await expect(page.getByRole('heading', { name: 'Your Verdict' })).toBeVisible();
  await expect(page.getByText('SECTION 1: VERDICT')).toBeVisible();
});
