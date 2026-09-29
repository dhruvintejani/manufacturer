const { test, expect, devices } = require('@playwright/test');

// This suite runs the actual WebKit engine used by iOS Safari in CI.
test.use({ ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 375, height: 667 } });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('iPhone Safari displays nonempty sales charts and accessible status breakdown instead of white cards', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
  const monthly = page.locator('[data-html-chart="Monthly Order Value"]');
  await monthly.scrollIntoViewIfNeeded();
  await expect(monthly).toBeVisible();
  const bars = monthly.locator('[data-chart-value]');
  expect(await bars.count()).toBe(12);
  expect(await bars.evaluateAll(elements => elements.some(element =>
    Number(element.getAttribute('data-chart-value')) > 0 && element.getBoundingClientRect().height >= 6,
  ))).toBe(true);
  const donut = page.locator('[data-html-chart="Quotation Status Breakdown"]');
  await donut.scrollIntoViewIfNeeded();
  await expect(donut.locator('[data-chart-total]')).toBeVisible();
  const chart = donut.locator('[data-chart-total]');
  expect(Number(await chart.getAttribute('data-chart-total'))).toBeGreaterThan(0);
  expect(await chart.evaluate(node => getComputedStyle(node).backgroundImage)).toMatch(/conic-gradient/i);
  await expect(page.locator('[data-svg-chart]')).toHaveCount(0);
  const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThan(4);
  expect(failures).toEqual([]);
});

test('iPhone Safari charts remain populated across every report tab and dashboard', async ({ page }) => {
  await page.goto('/reports');
  const cases = [
    ['Sales', ['Monthly Order Value', 'Quotation Status Breakdown', 'Orders vs Quotations Trend']],
    ['Production', ['Jobs by Status', 'Monthly Production Activity']],
    ['Customers', ['Top Customers by Revenue', 'Customers by Country']],
    ['Enquiries', ['Enquiry Status Distribution', 'Monthly Enquiry Trend', 'Enquiries by Product']],
  ];
  for (const [tab, titles] of cases) {
    await page.getByRole('tab', { name: tab, exact: true }).tap();
    for (const title of titles) {
      const html = page.locator('[data-html-chart="' + title + '"]');
      await html.scrollIntoViewIfNeeded();
      await expect(html).toBeVisible();
      const meaningful = await html.locator('[data-chart-value], [data-chart-total], [data-chart-empty]').count();
      expect(meaningful, title + ' must show values or an explicit empty-state message').toBeGreaterThan(0);
      const right = await html.evaluate(el => el.getBoundingClientRect().right);
      expect(right, title + ' chart is within iPhone screen').toBeLessThanOrEqual(376);
    }
  }
  await page.goto('/dashboard');
  const overview = page.locator('[data-html-chart="Dashboard Activity Overview"]');
  await overview.scrollIntoViewIfNeeded();
  await expect(overview).toBeVisible();
  expect(await overview.locator('[data-chart-value]').count()).toBeGreaterThan(0);
});

test('iPhone Safari reports show an explicit empty state with no records, not blank space', async ({ page }) => {
  await page.goto('/dashboard');
  await page.evaluate(() => {
    // Zustand does not write an untouched seed state to localStorage until
    // a user action occurs. Persist only the two empty slices to test hydration.
    const raw = JSON.parse(localStorage.getItem('forgeflow-storage') || 'null') || { state: {}, version: 0 };
    raw.state.orders = [];
    raw.state.quotations = [];
    localStorage.setItem('forgeflow-storage', JSON.stringify(raw));
  });
  await page.goto('/reports');
  await expect(page.locator('[data-html-chart="Monthly Order Value"] [data-chart-empty]'))
    .toContainText('No recorded activity');
  await expect(page.locator('[data-html-chart="Quotation Status Breakdown"] [data-chart-empty]'))
    .toContainText('No records');
});

test('navbar search works with touch, linked records, keyboard replacement and no-match feedback on Safari', async ({ page }) => {
  await page.goto('/dashboard');
  const search = page.getByRole('searchbox', { name: 'Search manufacturing records' });
  await search.fill('Global Traders');
  const results = page.getByRole('region', { name: 'Search results' });
  await expect(results).toBeVisible();
  await results.getByRole('button', { name: /Customer.*Global Traders/ }).first().tap();
  await expect(page).toHaveURL(/\/customers\?open=C001/);
  await expect(page.getByRole('dialog', { name: /Global Traders/ })).toBeVisible();

  await search.fill('ORD-2026-0055');
  await expect(results.getByRole('button', { name: /ORD-2026-0055/ })).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(/\/orders\?open=ORD-2026-0055/);
  await expect(page.getByRole('dialog', { name: /ORD-2026-0055/ })).toBeVisible();

  await search.fill('unmatched-999999');
  await expect(results.getByRole('status')).toContainText('No matching records');
  await search.press('Escape');
  await expect(results).toBeHidden();
});
