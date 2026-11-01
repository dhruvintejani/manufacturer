const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('premium dashboard uses the new command center, design surfaces and working navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  const hero = page.getByRole('region', { name: 'Manufacturing command center' });
  await expect(hero).toBeVisible();
  await expect(hero.getByRole('heading', { name: /Hello,/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operational pulse' })).toBeVisible();
  expect(await page.locator('.forge-stat').count()).toBe(7);
  await expect(page.locator('.forge-sidebar').first()).toBeVisible();
  await expect(page.locator('.forge-topbar')).toBeVisible();
  const radius = await hero.evaluate(element => getComputedStyle(element).borderRadius);
  expect(parseFloat(radius)).toBeGreaterThan(17);
  await hero.getByRole('button', { name: 'Review orders' }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('redesigned navigation, tables and forms remain usable at narrow mobile widths', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 700 });
    for (const route of ['dashboard', 'orders', 'production', 'reports', 'inventory', 'settings']) {
      await page.goto('/' + route);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).not.toBeEmpty();
      const overflow = await page.evaluate(() => ({
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        main: document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth
      }));
      expect(overflow.body, route + ' page at ' + width + 'px').toBeLessThan(4);
      expect(overflow.main, route + ' main at ' + width + 'px').toBeLessThan(4);
    }
  }
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('link', { name: 'Production', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Production', exact: true }).click();
  await expect(page).toHaveURL(/\/production$/);
  expect(errors).toEqual([]);
});

test('visual system respects reduced motion and maintains accessible controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  const hero = page.getByRole('region', { name: 'Manufacturing command center' });
  await expect(hero).toBeVisible();
  const reduced = await hero.evaluate(element => getComputedStyle(element).animationDuration);
  expect(reduced).toBeTruthy();
  await page.getByRole('searchbox', { name: 'Search manufacturing records' }).fill('Global Traders');
  await expect(page.getByRole('region', { name: 'Search results' })).toBeVisible();
});
