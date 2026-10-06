const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);

test('seed shortage -> restock -> reservation ready -> production consumes exactly once -> low-stock alert', async ({ page }) => {
  test.setTimeout(60_000);
  // Persist the hydrated seed snapshot with a harmless UI preference change
  // before opening the drawer; the drawer overlay correctly blocks sidebar clicks.
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.goto('/orders?open=ORD-2026-0055');
  let drawer = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Material Readiness' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Create Production Job' })).toBeDisabled();

  let snapshot = await state(page);
  let requirement = snapshot.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Shortage');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002')).toMatchObject({
    requiredQty: 170, reservedQty: 120, consumedQty: 0,
  });
  expect(snapshot.materials.find(item => item.id === 'MAT-002').currentStock).toBe(120);

  await page.goto('/purchases');
  const requestRow = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await expect(requestRow).toBeVisible();
  await requestRow.getByRole('button', { name: 'Receive Material' }).click();
  await expect(requestRow.getByText('Received', { exact: true })).toBeVisible();

  snapshot = await state(page);
  expect(snapshot.materials.find(item => item.id === 'MAT-002').currentStock).toBe(420);
  requirement = snapshot.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Ready');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(170);
  expect(snapshot.purchaseRequests.find(item => item.requestNumber === 'PUR-2026-001').status).toBe('Received');

  await page.goto('/orders?open=ORD-2026-0055');
  drawer = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(drawer.getByText('All materials are reserved')).toBeVisible();
  const start = drawer.getByRole('button', { name: 'Create Production Job' });
  await expect(start).toBeEnabled();
  await start.click();
  const confirm = page.getByRole('dialog', { name: 'Create Production Job' });
  await confirm.getByRole('button', { name: 'Create Job' }).click();
  await expect(page).toHaveURL(/\/production$/);

  snapshot = await state(page);
  const job = snapshot.productionJobs.find(item => item.orderId === 'ORD-2026-0055');
  expect(job).toBeTruthy();
  expect(snapshot.orders.find(item => item.id === 'ORD-2026-0055').status).toBe('Production');
  requirement = snapshot.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Consumed');
  expect(requirement.lines.every(line => line.reservedQty === 0 && line.consumedQty === line.requiredQty)).toBe(true);
  expect(snapshot.materials.find(item => item.id === 'MAT-002').currentStock).toBe(250);

  const ss316Consumption = snapshot.inventoryTransactions.filter(tx =>
    tx.materialId === 'MAT-002' && tx.type === 'production_consumption' && tx.reference === 'ORD-2026-0055');
  expect(ss316Consumption).toHaveLength(1);
  expect(ss316Consumption[0].quantity).toBe(-170);
  expect(snapshot.notifications.some(note =>
    !note.read && note.title === 'Low Stock Alert' && note.relatedId === 'MAT-002' && /250/.test(note.message))).toBe(true);

  await page.goto('/inventory?open=MAT-002');
  const inventory = page.getByRole('dialog', { name: /SS316 Sheet/ });
  await expect(inventory).toBeVisible();
  await expect(inventory.getByText('250', { exact: true }).first()).toBeVisible();
  await expect(inventory.getByText('production consumption')).toBeVisible();
});

test('editing a product BOM recalculates material requirement for confirmed orders', async ({ page }) => {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).first().click();
  const newOrder = page.getByRole('dialog', { name: 'New Order' });
  await newOrder.getByRole('button', { name: 'Customer', exact: true }).click();
  await page.getByRole('option', { name: 'Global Traders Pvt. Ltd.' }).click();
  await newOrder.getByRole('button', { name: 'Product', exact: true }).click();
  await page.getByRole('option', { name: 'Reactor', exact: true }).click();
  await newOrder.locator('input[type="number"]').first().fill('2');
  await newOrder.getByRole('button', { name: 'Create Order' }).click();

  let snapshot = await state(page);
  const created = snapshot.orders.at(-1);
  expect(created.product).toBe('Reactor');
  let requirement = snapshot.materialRequirements.find(item => item.orderId === created.id);
  expect(requirement.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(200);

  await page.goto('/bom');
  await expect(page.getByRole('heading', { name: 'Reactor', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit BOM' }).click();
  const editor = page.getByRole('dialog', { name: /Edit BOM — Reactor/ });
  const quantities = editor.locator('input[type="number"]');
  await expect(quantities.first()).toHaveValue('100');
  await quantities.first().fill('110');
  await editor.getByRole('button', { name: 'Save BOM & Recalculate' }).click();

  snapshot = await state(page);
  const product = snapshot.products.find(item => item.name === 'Reactor');
  expect(product.bom.find(line => line.materialId === 'MAT-001').quantity).toBe(110);
  requirement = snapshot.materialRequirements.find(item => item.orderId === created.id);
  expect(requirement.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(220);
  expect(requirement.updatedAt).toBeTruthy();
});

test('materials and inventory changes share one synchronized stock ledger', async ({ page }) => {
  await page.goto('/materials');
  await page.getByRole('button', { name: 'Add Material' }).click();
  const modal = page.getByRole('dialog', { name: 'Add Material' });
  const inputs = modal.locator('input');
  await inputs.nth(0).fill('TEST-AL');
  await inputs.nth(1).fill('Test Alloy');
  await inputs.nth(2).fill('Alloy');
  await inputs.nth(3).fill('25');
  await inputs.nth(4).fill('10');
  await inputs.nth(5).fill('15');
  await inputs.nth(6).fill('Demo Supplier');
  await modal.getByRole('button', { name: 'Add Material' }).click();
  await expect(page.getByText('Test Alloy', { exact: true })).toBeVisible();

  await page.goto('/inventory');
  const row = page.getByRole('row').filter({ hasText: 'Test Alloy' });
  await expect(row).toContainText('25');
  await row.getByRole('button', { name: 'View / Adjust' }).click();
  const ledger = page.getByRole('dialog', { name: /Test Alloy/ });
  await ledger.getByLabel('Stock adjustment quantity').fill('-12');
  await ledger.getByLabel('Stock adjustment note').fill('Demo issue to workshop');
  await ledger.getByRole('button', { name: 'Apply' }).click();

  const snapshot = await state(page);
  const material = snapshot.materials.find(item => item.code === 'TEST-AL');
  expect(material.currentStock).toBe(13);
  const adjustment = snapshot.inventoryTransactions.find(tx => tx.materialId === material.id && tx.type === 'adjustment');
  expect(adjustment.quantity).toBe(-12);
  expect(adjustment.balanceAfter).toBe(13);
});

test('reports download both current Inventory PDF and complete operations PDF from live state', async ({ page }) => {
  await page.goto('/reports');
  await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory Position' })).toBeVisible();

  let downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Current Report PDF' }).click();
  let download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^forgeflow-inventory-report-.*\.pdf$/);
  let downloadPath = await download.path();
  expect(fs.statSync(downloadPath).size).toBeGreaterThan(1500);

  downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Complete PDF' }).click();
  download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^forgeflow-complete-report-.*\.pdf$/);
  downloadPath = await download.path();
  expect(fs.statSync(downloadPath).size).toBeGreaterThan(2500);
});

test('new inventory modules render on mobile without page-level horizontal overflow', async ({ page }) => {
  const routes = ['materials', 'bom', 'inventory', 'purchases'];
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 700 });
    for (const route of routes) {
      await page.goto('/' + route);
      await expect(page.locator('main')).not.toBeEmpty();
      const overflow = await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow, route + ' at ' + width).toBeLessThan(4);
    }
  }
});
