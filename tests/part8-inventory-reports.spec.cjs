const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const openInventoryReport = async page => {
  await page.goto('/reports');
  const tab = page.getByRole('tab', { name: 'Inventory', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
};

test('Part 8 shows stock, shortage, consumption and procurement analytics from one live state', async ({ page }) => {
  await openInventoryReport(page);

  const belowMinimum = page.getByText('Low Stock', { exact: true }).first().locator('..');
  await expect(belowMinimum).toContainText('2');

  const shortageOrders = page.getByText('Shortage Orders', { exact: true }).locator('..');
  await expect(shortageOrders).toContainText('1');

  const consumptionEvents = page.getByText('Consumption Events', { exact: true }).locator('..');
  await expect(consumptionEvents).toContainText('2');

  const receiptEvents = page.getByText('Receipt Events', { exact: true }).locator('..');
  await expect(receiptEvents).toContainText('0');

  await expect(page.getByText('Stock Health', { exact: true })).toBeVisible();
  await expect(page.getByText('Purchase Lifecycle', { exact: true })).toBeVisible();
  await expect(page.getByText(/Inventory Movement Events/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventory Position' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Material Shortages' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Material Consumption' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Material Receipts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Inventory Transactions' })).toBeVisible();

  const shortageTable = page.getByRole('region', { name: 'Material shortage report' });
  await expect(shortageTable).toContainText('ORD-2026-0055');
  await expect(shortageTable).toContainText('SS316 Sheet');
  await expect(shortageTable).toContainText('50');

  const consumption = page.getByRole('region', { name: 'Material consumption report' });
  const ss304 = consumption.getByRole('row').filter({ hasText: 'SS304 Sheet' });
  await expect(ss304).toContainText('100');
  await expect(ss304).toContainText('kg');
  const ss316 = consumption.getByRole('row').filter({ hasText: 'SS316 Sheet' });
  await expect(ss316).toContainText('20');

  const ledger = page.getByRole('region', { name: 'Recent inventory transactions' });
  await expect(ledger).toContainText('Production Consumption');
  await expect(ledger).toContainText('ORD-2026-0058');
});

test('Part 8 reports update immediately after purchase receipt resolves an order shortage', async ({ page }) => {
  await page.goto('/purchases');
  const request = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await request.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(request.getByText('Ordered', { exact: true })).toBeVisible();
  await request.getByRole('button', { name: 'Receive Material' }).click();
  await expect(request.getByText('Received', { exact: true })).toBeVisible();

  await openInventoryReport(page);

  const shortageOrders = page.getByText('Shortage Orders', { exact: true }).locator('..');
  await expect(shortageOrders).toContainText('0');

  const receiptEvents = page.getByText('Receipt Events', { exact: true }).locator('..');
  await expect(receiptEvents).toContainText('1');

  const receiptReport = page.getByRole('region', { name: 'Purchase receipt report' });
  const ss316Receipt = receiptReport.getByRole('row').filter({ hasText: 'SS316 Sheet' });
  await expect(ss316Receipt).toContainText('300');
  await expect(ss316Receipt).toContainText('kg');

  await expect(page.getByRole('region', { name: 'Material shortage report' }))
    .toContainText('No unresolved material shortages.');

  const restock = page.getByRole('heading', { name: 'Purchase / Restock Summary' }).locator('../..');
  await expect(restock).toContainText('PUR-2026-001');
  await expect(restock).toContainText('Received');

  const ledger = page.getByRole('region', { name: 'Recent inventory transactions' });
  await expect(ledger).toContainText('Purchase Received');
  await expect(ledger).toContainText('PUR-2026-001');
});

test('Part 8 consumption analytics update after a material-ready order starts production', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/purchases');
  const request = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await request.getByRole('button', { name: 'Mark Ordered' }).click();
  await request.getByRole('button', { name: 'Receive Material' }).click();
  await expect(request.getByText('Received', { exact: true })).toBeVisible();

  await page.goto('/orders?open=ORD-2026-0055');
  const order = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(order.getByText('All BOM materials are reserved')).toBeVisible();
  await order.getByRole('button', { name: 'Create Production Job' }).click();
  await page.getByRole('dialog', { name: 'Create Production Job' })
    .getByRole('button', { name: 'Create Job' }).click();
  await expect(page).toHaveURL(/\/production$/);

  await openInventoryReport(page);

  const consumptionEvents = page.getByText('Consumption Events', { exact: true }).locator('..');
  await expect(consumptionEvents).toContainText('7');

  const consumption = page.getByRole('region', { name: 'Material consumption report' });
  const ss304 = consumption.getByRole('row').filter({ hasText: 'SS304 Sheet' });
  await expect(ss304).toContainText('150');
  const ss316 = consumption.getByRole('row').filter({ hasText: 'SS316 Sheet' });
  await expect(ss316).toContainText('190');

  const ledger = page.getByRole('region', { name: 'Recent inventory transactions' });
  await expect(ledger).toContainText('ORD-2026-0055');
  await expect(ledger).toContainText('Production Consumption');
});

test('Part 8 inventory reports remain usable without whole-page overflow on phones and tablets', async ({ page }) => {
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    await openInventoryReport(page);

    await expect(page.getByText('Stock Health', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Material Consumption' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Inventory Transactions' })).toBeVisible();

    const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, 'reports overflow at ' + width + 'px').toBeLessThan(4);
  }
});
