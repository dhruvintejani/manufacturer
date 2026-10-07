const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const persistedState = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

async function createReactorOrder(page, quantity = 1) {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).first().click();
  const modal = page.getByRole('dialog', { name: 'New Order' });

  await modal.getByRole('button', { name: 'Customer', exact: true }).click();
  await page.getByRole('option', { name: 'Global Traders Pvt. Ltd.' }).click();

  await modal.getByRole('button', { name: 'Product', exact: true }).click();
  await page.getByRole('option', { name: 'Reactor', exact: true }).click();

  await modal.locator('input[type="number"]').first().fill(String(quantity));
  await modal.getByRole('button', { name: 'Create Order' }).click();

  const state = await persistedState(page);
  return state.orders.at(-1);
}

test('Part 5 creates an order BOM requirement and reserves available material automatically', async ({ page }) => {
  const order = await createReactorOrder(page, 2);
  const state = await persistedState(page);
  const requirement = state.materialRequirements.find(item => item.orderId === order.id);

  expect(requirement).toBeTruthy();
  expect(requirement).toMatchObject({
    productId: 'PRD-001',
    productName: 'Reactor',
    quantity: 2,
    bomVersion: '1.0',
    status: 'Shortage',
  });
  expect(requirement.lines.find(line => line.materialId === 'MAT-001')).toMatchObject({
    requiredQty: 200,
    reservedQty: 200,
    consumedQty: 0,
  });
  expect(requirement.lines.find(line => line.materialId === 'MAT-002')).toMatchObject({
    requiredQty: 40,
    reservedQty: 0,
    consumedQty: 0,
  });

  // Core invariant: open-order reservations can never exceed physical stock,
  // even when several orders compete for the same BOM material.
  for (const material of state.materials) {
    const totalReserved = state.materialRequirements
      .filter(item => ['Ready', 'Shortage'].includes(item.status))
      .flatMap(item => item.lines)
      .filter(line => line.materialId === material.id)
      .reduce((sum, line) => sum + line.reservedQty, 0);
    expect(totalReserved, material.code + ' reservation cap').toBeLessThanOrEqual(material.currentStock + 1e-9);
  }

  const row = page.getByRole('row').filter({ hasText: order.orderNumber });
  await expect(row).toContainText('Shortage');

  await row.locator('td').first().getByRole('button', { name: order.orderNumber, exact: true }).click();
  const drawer = page.getByRole('dialog', { name: order.orderNumber });
  const readiness = drawer.getByRole('region', { name: 'Material readiness' });
  await expect(readiness).toContainText('BOM v1.0');
  await expect(readiness).toContainText('4/5 material lines covered');
  await expect(readiness).toContainText('SS316 Sheet');
  await expect(readiness).toContainText('Restock 40 kg');
});

test('Part 5 recalculates BOM quantities and reservations when an open order quantity changes', async ({ page }) => {
  const order = await createReactorOrder(page, 1);
  let state = await persistedState(page);
  const before = state.materialRequirements.find(item => item.orderId === order.id);
  expect(before.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(100);

  const orderRow = page.getByRole('row').filter({ hasText: order.orderNumber });
  await orderRow.locator('td').first().getByRole('button', { name: order.orderNumber, exact: true }).click();
  const drawer = page.getByRole('dialog', { name: order.orderNumber });
  await drawer.getByRole('button', { name: 'Edit Order' }).click();

  const edit = page.getByRole('dialog', { name: 'Edit ' + order.orderNumber });
  await edit.getByLabel('Quantity').fill('3');
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Order updated. Material requirements and reservations recalculated.')).toBeVisible();

  state = await persistedState(page);
  const after = state.materialRequirements.find(item => item.orderId === order.id);
  expect(after.id).toBe(before.id);
  expect(after.createdAt).toBe(before.createdAt);
  expect(after.quantity).toBe(3);
  expect(after.bomVersion).toBe('1.0');
  expect(after.lines.find(line => line.materialId === 'MAT-001').requiredQty).toBe(300);
  expect(after.lines.find(line => line.materialId === 'MAT-002').requiredQty).toBe(60);
});

test('Part 5 releases cancelled-order reservations and immediately reallocates them to later orders', async ({ page }) => {
  const laterOrder = await createReactorOrder(page, 1);
  let state = await persistedState(page);
  let laterRequirement = state.materialRequirements.find(item => item.orderId === laterOrder.id);
  expect(laterRequirement.status).toBe('Shortage');
  expect(laterRequirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(0);

  await page.goto('/orders?open=ORD-2026-0055');
  const drawer = page.getByRole('dialog', { name: 'ORD-2026-0055' });
  await drawer.getByRole('button', { name: 'Cancel Order' }).click();

  const cancel = page.getByRole('dialog', { name: 'Cancel Order' });
  await cancel.getByRole('button', { name: 'Confirm Cancellation' }).click();

  state = await persistedState(page);
  const released = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(released.status).toBe('Released');
  expect(released.lines.every(line => line.reservedQty === 0)).toBe(true);

  laterRequirement = state.materialRequirements.find(item => item.orderId === laterOrder.id);
  expect(laterRequirement.status).toBe('Ready');
  expect(laterRequirement.lines.find(line => line.materialId === 'MAT-002').reservedQty).toBe(20);

  const linkedPurchase = state.purchaseRequests.find(request => request.requestNumber === 'PUR-2026-001');
  expect(linkedPurchase.status).toBe('Cancelled');
  expect(state.notifications.some(notification =>
    !notification.read &&
    notification.title === 'Materials Ready' &&
    notification.relatedId === laterOrder.id
  )).toBe(true);

  await page.goto('/orders');
  await expect(page.getByRole('row').filter({ hasText: laterOrder.orderNumber })).toContainText('Ready');
});

test('Part 5 locks product and quantity after production/material consumption has started', async ({ page }) => {
  await page.goto('/orders?open=ORD-2026-0058');
  const drawer = page.getByRole('dialog', { name: 'ORD-2026-0058' });
  await drawer.getByRole('button', { name: 'Edit Order' }).click();

  const edit = page.getByRole('dialog', { name: 'Edit ORD-2026-0058' });
  await expect(edit.getByText(/Product and quantity are locked/)).toBeVisible();
  await expect(edit.getByRole('button', { name: 'Edit order product' })).toHaveCount(0);
  await expect(edit.getByLabel('Quantity')).toHaveCount(0);
});

test('Part 5 order material readiness stays usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/orders?open=ORD-2026-0055');

  const drawer = page.getByRole('dialog', { name: 'ORD-2026-0055' });
  const readiness = drawer.getByRole('region', { name: 'Material readiness' });
  await expect(readiness).toBeVisible();
  await expect(readiness).toContainText('SS316 Sheet');
  // The drawer slides in with a spring animation. Verify the settled position,
  // not an intermediate frame while it is still translated off-screen.
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    if (!bounds) return 9999;
    return Math.ceil(bounds.width);
  }).toBeLessThanOrEqual(321);
  const bounds = await drawer.boundingBox();
  expect(bounds.width).toBeLessThanOrEqual(321);
  expect(bounds.x).toBeGreaterThanOrEqual(-20);
});
