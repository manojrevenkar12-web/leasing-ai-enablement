import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const rows = (page: Page) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) });
const factors = async (page: Page) =>
  (await page.getByRole('img', { name: /^Leasingfaktor/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).map((l) => Number(l.match(/Leasingfaktor ([\d,]+)/)?.[1]?.replace(',', '.')));

test('lists offers from the API, cheapest leasing factor first', async ({ page }) => {
  await page.goto('/');
  await expect(rows(page).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /^\d+ Angebote$/ })).toBeVisible();
  const f = await factors(page);
  expect(f.length).toBeGreaterThan(5);
  expect(f).toEqual([...f].sort((a, b) => a - b));
  await expect(page.getByText('Alle Preise inklusive 19 % MwSt.')).toBeVisible();
});

test('filters by make and keeps the filter in the URL', async ({ page }) => {
  await page.goto('/');
  await expect(rows(page).first()).toBeVisible();
  await page.getByLabel('Marke').selectOption('BMW');
  await expect(page).toHaveURL(/make=BMW/);
  await expect(rows(page).first()).toContainText('BMW');
  for (const t of await page.getByRole('heading', { level: 3 }).allTextContents()) expect(t).toMatch(/^BMW /);
  await page.reload();
  await expect(page.getByLabel('Marke')).toHaveValue('BMW');
});

test('switches to business leasing, net prices', async ({ page }) => {
  await page.goto('/');
  await page.getByText('gewerblich (netto)').click();
  await expect(page).toHaveURL(/customer_type=business/);
  await expect(page.getByText('Alle Preise netto, Faktoren netto zu netto.')).toBeVisible();
  await expect(rows(page).first()).toContainText('pro Monat netto');
});

test('an empty result offers a way back', async ({ page }) => {
  await page.goto('/?max_rate_eur=1');
  await expect(page.getByRole('heading', { name: 'Keine Angebote für diese Auswahl' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(rows(page).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('a failing API shows an error with a working retry', async ({ page }) => {
  let failures = 1;
  await page.route('**/api/offers?*', async (route) => {
    if (failures-- > 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Wartung.' }) });
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Die Angebote konnten nicht geladen werden' })).toBeVisible();
  await expect(page.getByText(/Wartung\. Ihre Filter bleiben erhalten\./)).toBeVisible();
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(rows(page).first()).toBeVisible();
});

test('shows skeleton rows while the API is slow', async ({ page }) => {
  await page.route('**/api/offers?*', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Angebote werden geladen' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
});

test('the quote calculator reprices as terms change', async ({ page }) => {
  await page.goto('/');
  await rows(page).first().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Ihre Rate berechnen' })).toBeVisible();
  const rate = page.locator('[aria-live="polite"] p').first();
  await expect(rate).toHaveText(/€/);
  const before = await rate.textContent();
  await page.getByText('60 Monate').click();
  await expect(rate).not.toHaveText(before ?? '');
  const sixty = await rate.textContent();
  await page.getByText('30.000 km').click();
  await expect(rate).not.toHaveText(sixty ?? '');
  // more kilometres lower the residual value and raise the rate
  const parse = (t: string | null) => Number((t ?? '').replace(/[^\d,]/g, '').replace(',', '.'));
  expect(parse(await rate.textContent())).toBeGreaterThan(parse(sixty));
});

test('an offer that no longer exists says so', async ({ page }) => {
  await page.goto('/offers/999999');
  await expect(page.getByRole('heading', { name: 'Dieses Angebot gibt es nicht mehr' })).toBeVisible();
});

test('the enablement desk shows the measured results', async ({ page }) => {
  await page.goto('/enablement');
  await expect(page.getByRole('heading', { name: 'AI refactor of the legacy calculator' })).toBeVisible();
  await expect(page.getByText('Unapproved differences')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI pull-request reviewer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Measuring the rollout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not measured yet' })).toHaveCount(0);
});

for (const path of ['/', '/enablement']) {
  test(`has no accessibility violations: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test('has no accessibility violations: offer page', async ({ page }) => {
  await page.goto('/');
  await rows(page).first().getByRole('link').click();
  await expect(page.locator('[aria-live="polite"] p').first()).toHaveText(/€/);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('works with the keyboard alone', async ({ page }) => {
  await page.goto('/');
  await expect(rows(page).first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  const firstOffer = rows(page).first().getByRole('link');
  await firstOffer.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ihre Rate berechnen' })).toBeVisible();
});
