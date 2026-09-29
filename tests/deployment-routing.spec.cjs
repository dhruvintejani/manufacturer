const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

test('Vercel rewrites all React BrowserRouter routes to the SPA entrypoint', async ({ page }) => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  expect(config.rewrites).toBeDefined();
  const routeList = [
    '/dashboard', '/customers', '/enquiries', '/quotations',
    '/orders', '/production', '/reports', '/settings', '/help',
  ];
  for (const route of routeList) {
    const matches = config.rewrites.find(rule => new RegExp('^' + rule.source + '$').test(route));
    expect(matches?.destination, 'Vercel rewrite missing for ' + route).toBe('/index.html');
    await page.goto(route);
    await expect(page.locator('main')).not.toBeEmpty();
    await expect(page.locator('header')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(route + '$'));
    await expect(page.locator('main')).not.toBeEmpty();
  }
});

test('production bundle handles direct links with query parameters after reload', async ({ page }) => {
  await page.goto('/customers?open=C001');
  await expect(page.getByRole('dialog', { name: /Global Traders/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: /Global Traders/ })).toBeVisible();

  await page.goto('/orders?open=ORD-2026-0055');
  await expect(page.getByRole('dialog', { name: /ORD-2026-0055/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: /ORD-2026-0055/ })).toBeVisible();

  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sales', exact: true })).toBeVisible();
});

test('320-1023px Chrome screens get visible CSS report charts, not hidden SVG charts', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  for (const width of [320, 375, 768, 820, 1023]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/reports');
    const monthly = page.locator('[data-html-chart="Monthly Order Value"]');
    await expect(monthly).toBeVisible();
    expect(await monthly.locator('[data-chart-value]').count(), 'monthly bars at width ' + width).toBe(12);
    const visibleBars = await monthly.locator('[data-chart-value]').evaluateAll(nodes =>
      nodes.filter(el => Number(el.getAttribute('data-chart-value')) > 0 &&
        el.getBoundingClientRect().height > 4 && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
    );
    expect(visibleBars, 'real, visibly colored bars at width ' + width).toBeGreaterThan(0);
    const donut = page.locator('[data-html-chart="Quotation Status Breakdown"] [data-chart-total]');
    await expect(donut).toBeVisible();
    expect(Number(await donut.getAttribute('data-chart-total'))).toBeGreaterThan(0);
    expect(await donut.evaluate(node => getComputedStyle(node).backgroundImage)).toContain('conic-gradient');
    await expect(page.locator('[data-svg-chart="Monthly Order Value"]')).toBeHidden();
    const overallScroll = await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overallScroll, 'no sideways whole-screen scroll at width ' + width).toBeLessThan(4);
  }
  expect(pageErrors).toEqual([]);
});
