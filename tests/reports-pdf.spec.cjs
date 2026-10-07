const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Reports includes live Inventory analytics with low stock, shortage and restock summaries', async ({ page }) => {
  await page.goto('/reports');
  const inventoryTab = page.getByRole('tab', { name: 'Inventory', exact: true });
  await expect(inventoryTab).toBeVisible();
  await inventoryTab.click();
  await expect(inventoryTab).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByText('Low Stock', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Shortage Orders', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventory Position' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order Material Readiness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Purchase / Restock Summary' })).toBeVisible();
  await expect(page.getByText('SS316 Sheet', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('PUR-2026-001', { exact: true })).toBeVisible();
});

test('current report PDF downloads for every report category', async ({ page }) => {
  await page.goto('/reports');
  for (const section of ['Sales', 'Production', 'Customers', 'Enquiries', 'Inventory']) {
    await page.getByRole('tab', { name: section, exact: true }).click();
    const event = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Current Report PDF' }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe(
      'forgeflow-' + section.toLowerCase() + '-report-' + new Date().toISOString().slice(0, 10) + '.pdf'
    );
    const filePath = await download.path();
    expect(fs.statSync(filePath).size, section + ' PDF should contain real report data').toBeGreaterThan(1400);
  }
});

test('complete operations PDF downloads from the same live state', async ({ page }) => {
  await page.goto('/purchases');
  const request = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await request.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(request.getByText('Ordered', { exact: true })).toBeVisible();
  await request.getByRole('button', { name: 'Receive Material' }).click();

  await page.goto('/reports');
  await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
  await expect(page.getByText('Received', { exact: true })).toBeVisible();

  const event = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Complete PDF' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/^forgeflow-complete-report-\d{4}-\d{2}-\d{2}\.pdf$/);
  const filePath = await download.path();
  expect(fs.statSync(filePath).size).toBeGreaterThan(3000);
});

test('all five report tabs and PDF actions remain visible and usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/reports');
  const tablist = page.getByRole('tablist', { name: 'Report categories' });

  for (const section of ['Sales', 'Production', 'Customers', 'Enquiries', 'Inventory']) {
    const tab = tablist.getByRole('tab', { name: section, exact: true });
    await expect(tab).toBeVisible();
    const box = await tab.boundingBox();
    expect(box.x, section + ' left edge').toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, section + ' right edge').toBeLessThanOrEqual(321);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  await expect(page.getByRole('button', { name: 'Current Report PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete PDF' })).toBeVisible();
  const overflow = await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThan(4);
});
