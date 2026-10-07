const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Part 3 shows physical, reserved and available stock from the same live inventory state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/inventory');

  const ss316 = page.getByRole('row').filter({ hasText: 'SS316 Sheet' });
  await expect(ss316).toBeVisible();
  await expect(ss316).toContainText('120');
  await expect(ss316).toContainText('0');
  await expect(ss316).toContainText('Low Stock');

  const ss304 = page.getByRole('row').filter({ hasText: 'SS304 Sheet' });
  await expect(ss304).toContainText('850');
  await expect(ss304).toContainText('50');
  await expect(ss304).toContainText('800');

  await page.getByRole('button', { name: 'View ledger SS316 Sheet' }).click();
  const modal = page.getByRole('dialog', { name: /SS316 Sheet/ });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('region', { name: 'Open stock reservations' })).toContainText('ORD-2026-0055');
  await expect(modal.getByRole('region', { name: 'Open stock reservations' })).toContainText('Reserved 120 kg');
  await expect(modal.getByRole('region', { name: 'Inventory transaction ledger' })).toContainText('Production Consumption');
});

test('Part 3 blocks manual stock-out below reserved quantity and requires an audit reason', async ({ page }) => {
  await page.goto('/inventory?open=MAT-002');
  const modal = page.getByRole('dialog', { name: /SS316 Sheet/ });
  await expect(modal).toBeVisible();

  const quantity = modal.getByLabel('Stock adjustment quantity');
  const note = modal.getByLabel('Stock adjustment note');

  await quantity.fill('-1');
  await note.fill('Physical count correction');
  await modal.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Cannot reduce physical stock below 120 kg already reserved/)).toBeVisible();
  await expect(modal.getByText('120', { exact: true }).first()).toBeVisible();

  await quantity.fill('20');
  await note.fill('');
  await modal.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Add a reason so the stock adjustment is auditable.')).toBeVisible();

  await note.fill('Verified warehouse receipt');
  await modal.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Stock adjusted by +20 kg.')).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  const material = state.materials.find(item => item.id === 'MAT-002');
  expect(material.currentStock).toBe(140);
  const adjustment = state.inventoryTransactions.find(transaction =>
    transaction.materialId === 'MAT-002' && transaction.type === 'adjustment');
  expect(adjustment).toMatchObject({
    quantity: 20,
    balanceAfter: 140,
    reference: 'Stock Adjustment',
    note: 'Verified warehouse receipt',
  });
  const requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(140);
});

test('Part 3 allows stock-out only from available quantity and records the resulting balance', async ({ page }) => {
  await page.goto('/inventory?open=MAT-001');
  const modal = page.getByRole('dialog', { name: /SS304 Sheet/ });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('850', { exact: true }).first()).toBeVisible();

  await modal.getByLabel('Stock adjustment quantity').fill('-100');
  await modal.getByLabel('Stock adjustment note').fill('Warehouse count correction');
  await modal.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Stock adjusted by -100 kg.')).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(state.materials.find(item => item.id === 'MAT-001').currentStock).toBe(750);
  const requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.lines.find(line => line.materialId === 'MAT-001').reservedQty).toBe(50);
  const adjustment = state.inventoryTransactions.find(transaction =>
    transaction.materialId === 'MAT-001' && transaction.type === 'adjustment');
  expect(adjustment).toMatchObject({ quantity: -100, balanceAfter: 750, note: 'Warehouse count correction' });
});

test('Part 3 status filters and search work without mixing inventory units in KPI totals', async ({ page }) => {
  await page.goto('/inventory');

  await expect(page.getByText('Materials Reserved')).toBeVisible();
  await expect(page.getByText('Reserved Qty')).toHaveCount(0);

  await page.getByRole('button', { name: 'Low Stock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Low Stock', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const table = page.locator('table').first();
  await expect(table).toContainText('SS316 Sheet');
  await expect(table).toContainText('Welding Rod');
  await expect(table).not.toContainText('SS304 Sheet');

  const search = page.getByPlaceholder('Search material, code, category or supplier...');
  await search.fill('WELD-ROD');
  await expect(table).toContainText('Welding Rod');
  await expect(table).not.toContainText('SS316 Sheet');

  await search.fill('');
  await page.getByRole('button', { name: 'Healthy', exact: true }).click();
  await expect(table).toContainText('SS304 Sheet');
  await expect(table).not.toContainText('SS316 Sheet');
});

test('Part 3 inventory is mobile-safe and deep-linkable to a material ledger', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory / Stock' })).toBeVisible();
    expect(await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth), 'overflow at ' + width).toBeLessThan(4);
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/inventory?open=MAT-002');
  const modal = page.getByRole('dialog', { name: /SS316 Sheet/ });
  await expect(modal).toBeVisible();
  const bounds = await modal.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  await expect(modal.getByRole('region', { name: 'Inventory transaction ledger' })).toBeVisible();
});
