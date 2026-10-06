const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const persistedState = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

test('material shortage -> restock -> ready -> production consumes stock once', async ({ page }) => {
  test.setTimeout(70_000);

  // Trigger one harmless persisted UI state change before inspecting localStorage.
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.goto('/orders?open=ORD-2026-0055');

  let drawer = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(drawer.getByRole('heading', { name: 'Material Readiness' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Create Production Job' })).toBeDisabled();

  let state = await persistedState(page);
  let requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Shortage');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002')).toMatchObject({
    requiredQty: 170,
    reservedQty: 120,
    consumedQty: 0,
  });

  await page.goto('/purchases');
  const requestRow = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await expect(requestRow).toBeVisible();
  await requestRow.getByRole('button', { name: 'Receive Material' }).click();
  await expect(requestRow.getByText('Received', { exact: true })).toBeVisible();

  state = await persistedState(page);
  expect(state.materials.find(item => item.id === 'MAT-002').currentStock).toBe(420);
  requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Ready');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(170);

  await page.goto('/orders?open=ORD-2026-0055');
  drawer = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(drawer.getByText('All materials are reserved')).toBeVisible();
  await drawer.getByRole('button', { name: 'Create Production Job' }).click();
  await page.getByRole('dialog', { name: 'Create Production Job' }).getByRole('button', { name: 'Create Job' }).click();
  await expect(page).toHaveURL(/\/production$/);

  state = await persistedState(page);
  const job = state.productionJobs.find(item => item.orderId === 'ORD-2026-0055');
  expect(job).toBeTruthy();
  requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Consumed');
  expect(requirement.lines.every(line => line.reservedQty === 0 && line.consumedQty === line.requiredQty)).toBe(true);
  expect(state.materials.find(item => item.id === 'MAT-002').currentStock).toBe(250);

  const ss316Consumption = state.inventoryTransactions.filter(tx =>
    tx.materialId === 'MAT-002' &&
    tx.type === 'production_consumption' &&
    tx.reference === 'ORD-2026-0055'
  );
  expect(ss316Consumption).toHaveLength(1);
  expect(ss316Consumption[0].quantity).toBe(-170);

  await page.goto('/inventory?open=MAT-002');
  const inventory = page.getByRole('dialog', { name: /SS316 Sheet/ });
  await expect(inventory).toBeVisible();
  await expect(inventory.getByText('production consumption').first()).toBeVisible();
});

test('editing a BOM recalculates requirements for an open confirmed order', async ({ page }) => {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).first().click();
  const orderModal = page.getByRole('dialog', { name: 'New Order' });

  await orderModal.getByRole('button', { name: 'Customer', exact: true }).click();
  await page.getByRole('option', { name: 'Global Traders Pvt. Ltd.' }).click();
  await orderModal.getByRole('button', { name: 'Product', exact: true }).click();
  await page.getByRole('option', { name: 'Reactor', exact: true }).click();
  await orderModal.locator('input[type="number"]').first().fill('2');
  await orderModal.getByRole('button', { name: 'Create Order' }).click();

  let state = await persistedState(page);
  const created = state.orders.at(-1);
  expect(created.product).toBe('Reactor');
  let requirement = state.materialRequirements.find(item => item.orderId === created.id);
  expect(requirement.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(200);

  await page.goto('/bom');
  await page.getByRole('button', { name: 'Edit BOM' }).click();
  const editor = page.getByRole('dialog', { name: /Edit BOM — Reactor/ });
  const firstQty = editor.getByLabel('Qty / Product').first();
  await expect(firstQty).toHaveValue('100');
  await firstQty.fill('110');
  await editor.getByRole('button', { name: 'Save BOM & Recalculate' }).click();

  state = await persistedState(page);
  const product = state.products.find(item => item.name === 'Reactor');
  expect(product.bom.find(line => line.materialId === 'MAT-001').quantity).toBe(110);
  requirement = state.materialRequirements.find(item => item.orderId === created.id);
  expect(requirement.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(220);
});

test('material master and inventory ledger stay synchronized', async ({ page }) => {
  await page.goto('/materials');
  await page.getByRole('button', { name: 'Add Material' }).click();
  const modal = page.getByRole('dialog', { name: 'Add Material' });

  await modal.getByLabel('Material Code').fill('TEST-AL');
  await modal.getByLabel('Material Name').fill('Test Alloy');
  await modal.getByLabel('Category').fill('Alloy');
  await modal.getByLabel('Opening Stock').fill('25');
  await modal.getByLabel('Minimum Stock').fill('10');
  await modal.getByLabel('Reorder Level').fill('15');
  await modal.getByLabel('Supplier').fill('Demo Supplier');
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

  const state = await persistedState(page);
  const material = state.materials.find(item => item.code === 'TEST-AL');
  expect(material.currentStock).toBe(13);
  const adjustment = state.inventoryTransactions.find(tx => tx.materialId === material.id && tx.type === 'adjustment');
  expect(adjustment).toMatchObject({ quantity: -12, balanceAfter: 13 });
});

test('new material modules fit phone, tablet and desktop without whole-page horizontal overflow', async ({ page }) => {
  const routes = ['materials', 'bom', 'inventory', 'purchases'];
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    for (const route of routes) {
      await page.goto('/' + route);
      await expect(page.locator('main')).not.toBeEmpty();
      const overflow = await page.locator('main').evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow, route + ' at ' + width + 'px').toBeLessThan(4);
    }
  }
});
