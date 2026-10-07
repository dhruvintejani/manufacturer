const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const persistedState = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

test('Part 4 enforces Requested -> Ordered -> Received and updates inventory/reservations exactly once', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/purchases');

  const row = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Requested', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Receive Material' })).toHaveCount(0);

  await row.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(row.getByText('Ordered', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Receive Material' })).toBeVisible();

  let state = await persistedState(page);
  let request = state.purchaseRequests.find(item => item.requestNumber === 'PUR-2026-001');
  expect(request.status).toBe('Ordered');
  expect(request.orderedAt).toBeTruthy();
  expect(state.materials.find(item => item.id === 'MAT-002').currentStock).toBe(120);

  await row.getByRole('button', { name: 'Receive Material' }).click();
  await expect(row.getByText('Received', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Receive Material' })).toHaveCount(0);

  state = await persistedState(page);
  request = state.purchaseRequests.find(item => item.requestNumber === 'PUR-2026-001');
  expect(request.status).toBe('Received');
  expect(request.receivedAt).toBeTruthy();
  expect(state.materials.find(item => item.id === 'MAT-002').currentStock).toBe(420);

  const receipts = state.inventoryTransactions.filter(transaction =>
    transaction.type === 'purchase_received' && transaction.reference === 'PUR-2026-001');
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({ materialId: 'MAT-002', quantity: 300, balanceAfter: 420 });

  const requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Ready');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(170);
  expect(state.notifications.some(notification =>
    !notification.read &&
    notification.title === 'Materials Ready' &&
    notification.relatedId === 'ORD-2026-0055')).toBe(true);
});

test('Part 4 prevents duplicate open requests for the same order shortage', async ({ page }) => {
  await page.goto('/purchases');

  const shortage = page.getByRole('region', { name: 'Unresolved order shortages' });
  await expect(shortage).toBeVisible();
  await expect(shortage.getByRole('button', { name: /PUR-2026-001 · Requested/ })).toBeVisible();

  const before = await persistedState(page);
  const beforeOpen = before.purchaseRequests.filter(request =>
    request.orderId === 'ORD-2026-0055' &&
    request.materialId === 'MAT-002' &&
    !['Received', 'Cancelled'].includes(request.status));
  expect(beforeOpen).toHaveLength(1);

  await shortage.getByRole('button', { name: /PUR-2026-001 · Requested/ }).click();
  const details = page.getByRole('dialog', { name: 'PUR-2026-001' });
  await expect(details).toBeVisible();
  await expect(details.getByRole('region', { name: 'Purchase workflow' })).toContainText('Requested');
  await details.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(details.getByText('Ordered', { exact: true }).first()).toBeVisible();

  const after = await persistedState(page);
  const afterOpen = after.purchaseRequests.filter(request =>
    request.orderId === 'ORD-2026-0055' &&
    request.materialId === 'MAT-002' &&
    !['Received', 'Cancelled'].includes(request.status));
  expect(afterOpen).toHaveLength(1);
});

test('Part 4 cancellation reopens the shortage for a replacement restock request', async ({ page }) => {
  await page.goto('/purchases');
  let row = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await row.getByRole('button', { name: 'Cancel PUR-2026-001' }).click();
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();

  const shortage = page.getByRole('region', { name: 'Unresolved order shortages' });
  const ss316Card = shortage.locator('div').filter({ hasText: 'SS316 Sheet' }).filter({ hasText: 'ORD-2026-0055' }).last();
  await expect(shortage.getByRole('button', { name: 'Create Restock' }).first()).toBeVisible();
  await shortage.getByRole('button', { name: 'Create Restock' }).first().click();

  const modal = page.getByRole('dialog', { name: 'New Restock Request' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Linked purchase order' })).toContainText('ORD-2026-0055');
  await expect(modal.getByRole('button', { name: 'Purchase material' })).toContainText('SS316');
  await expect(modal.getByLabel('Purchase supplier')).toHaveValue('SteelSource Metals');
  await modal.getByRole('button', { name: 'Create Request' }).click();

  const state = await persistedState(page);
  const open = state.purchaseRequests.filter(request =>
    request.orderId === 'ORD-2026-0055' &&
    request.materialId === 'MAT-002' &&
    !['Received', 'Cancelled'].includes(request.status));
  expect(open).toHaveLength(1);
  expect(open[0].requestNumber).not.toBe('PUR-2026-001');
  expect(open[0].status).toBe('Requested');
});

test('Part 4 supports general restock and records supplier receipt in the inventory ledger', async ({ page }) => {
  await page.goto('/purchases');
  await page.getByRole('button', { name: 'New Restock Request' }).click();

  const modal = page.getByRole('dialog', { name: 'New Restock Request' });
  await modal.getByRole('button', { name: 'Purchase material' }).click();
  await page.getByRole('option', { name: /WELD-ROD — Welding Rod/ }).click();
  await modal.getByLabel('Purchase quantity').fill('20');
  await modal.getByLabel('Purchase supplier').fill('ArcWeld Supplies');
  await modal.getByLabel('Purchase note').fill('Restore welding consumable safety stock');
  await modal.getByRole('button', { name: 'Create Request' }).click();

  let state = await persistedState(page);
  const created = state.purchaseRequests.find(request =>
    request.materialId === 'MAT-003' &&
    request.orderId === undefined &&
    request.quantity === 20 &&
    request.status === 'Requested');
  expect(created).toBeTruthy();

  let row = page.getByRole('row').filter({ hasText: created.requestNumber });
  await row.getByRole('button', { name: 'Mark Ordered' }).click();
  await row.getByRole('button', { name: 'Receive Material' }).click();
  await expect(row.getByText('Received', { exact: true })).toBeVisible();

  state = await persistedState(page);
  expect(state.materials.find(material => material.id === 'MAT-003').currentStock).toBe(60);
  const receipt = state.inventoryTransactions.find(transaction =>
    transaction.type === 'purchase_received' && transaction.reference === created.requestNumber);
  expect(receipt).toMatchObject({
    materialId: 'MAT-003',
    quantity: 20,
    balanceAfter: 60,
    note: 'Restore welding consumable safety stock',
  });

  await page.getByRole('button', { name: created.requestNumber }).click();
  const details = page.getByRole('dialog', { name: created.requestNumber });
  await expect(details.getByRole('region', { name: 'Purchase inventory impact' })).toContainText('+20 kg');
  await expect(details.getByRole('region', { name: 'Purchase inventory impact' })).toContainText('60 kg');
});

test('Part 4 purchase page filters and mobile layout remain usable', async ({ page }) => {
  await page.goto('/purchases');
  await page.getByRole('button', { name: 'Requested', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Requested', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('row').filter({ hasText: 'PUR-2026-001' })).toBeVisible();

  const search = page.getByLabel('Search purchase requests');
  await search.fill('SteelSource');
  await expect(page.getByRole('row').filter({ hasText: 'PUR-2026-001' })).toBeVisible();
  await search.fill('does-not-exist');
  await expect(page.getByText('No purchase requests match this view.')).toBeVisible();

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/purchases');
    await expect(page.getByRole('heading', { name: 'Purchase / Restock' })).toBeVisible();
    const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, 'purchase overflow at ' + width + 'px').toBeLessThan(4);
  }
});
