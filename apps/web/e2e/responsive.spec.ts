import { expect, test } from '@playwright/test';

test('on a phone, offers are readable without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
