const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const state = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

async function resolveSeedShortage(page) {
  await page.goto('/purchases');
  const row = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await row.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(row.getByText('Ordered', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Receive Material' }).click();
  await expect(row.getByText('Received', { exact: true })).toBeVisible();
}

async function startSeedHeatExchangerProduction(page) {
  await resolveSeedShortage(page);
  await page.goto('/production');
  await page.getByRole('button', { name: 'New Job', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Create Production Job' });
  await modal.getByRole('button', { name: 'Linked order' }).click();
  await page.getByRole('option', { name: /ORD-2026-0055.*2.*Heat Exchanger/ }).click();
  await expect(modal).toContainText('Heat Exchanger');
  await expect(modal).toContainText('2');
  await modal.getByRole('button', { name: 'Start Production & Consume Materials' }).click();
  await expect(modal).toBeHidden();

  const snapshot = await state(page);
  return snapshot.productionJobs.find(job => job.orderId === 'ORD-2026-0055');
}

test('Part 6 blocks production until a confirmed order has a fully reserved BOM', async ({ page }) => {
  await page.goto('/production');
  await expect(page.getByText('Ready to Start')).toBeVisible();
  await expect(page.getByText('Material Blocked')).toBeVisible();

  await page.getByRole('button', { name: 'New Job', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Create Production Job' });
  const orderSelect = modal.getByRole('button', { name: 'Linked order' });
  await expect(orderSelect).toContainText('No material-ready confirmed orders');
  await expect(modal.getByRole('button', { name: 'Start Production & Consume Materials' })).toBeDisabled();

  await orderSelect.click();
  const list = page.getByRole('listbox', { name: 'Linked order' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('option', { name: /ORD-2026-0055/ })).toHaveCount(0);
  await expect(modal).toContainText(/confirmed order.*currently blocked by material readiness/);
});

test('Part 6 starts production from a Ready reservation and consumes every BOM line exactly once', async ({ page }) => {
  const job = await startSeedHeatExchangerProduction(page);
  expect(job).toBeTruthy();
  expect(job).toMatchObject({
    orderId: 'ORD-2026-0055',
    product: 'Heat Exchanger',
    quantity: 2,
    status: 'Planning',
    progress: 0,
  });

  const snapshot = await state(page);
  const order = snapshot.orders.find(item => item.id === 'ORD-2026-0055');
  expect(order.status).toBe('Production');
  expect(order.productionJobId).toBe(job.id);

  const requirement = snapshot.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(requirement.status).toBe('Consumed');
  expect(requirement.consumedAt).toBeTruthy();
  expect(requirement.lines.every(line =>
    line.reservedQty === 0 && line.consumedQty === line.requiredQty)).toBe(true);

  const consumption = snapshot.inventoryTransactions.filter(transaction =>
    transaction.type === 'production_consumption' &&
    transaction.reference === 'ORD-2026-0055');
  expect(consumption).toHaveLength(requirement.lines.length);
  for (const line of requirement.lines) {
    const entries = consumption.filter(transaction => transaction.materialId === line.materialId);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(-line.requiredQty);
  }

  expect(snapshot.materials.find(item => item.id === 'MAT-002').currentStock).toBe(250);
  expect(snapshot.productionJobs.filter(item => item.orderId === 'ORD-2026-0055')).toHaveLength(1);

  await page.goto('/production?open=' + encodeURIComponent(job.id));
  const drawer = page.getByRole('dialog', { name: job.jobNumber });
  const materials = drawer.getByRole('region', { name: 'Production material consumption' });
  await expect(materials).toBeVisible();
  await expect(materials).toContainText('SS316 Sheet');
  await expect(materials).toContainText('170 kg');
  await expect(materials).toContainText('Ledger entries: 5');
  await expect(drawer.getByText(/retained as audit records/)).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Delete/ })).toHaveCount(0);

  await drawer.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'New Job', exact: true }).click();
  const second = page.getByRole('dialog', { name: 'Create Production Job' });
  await second.getByRole('button', { name: 'Linked order' }).click();
  await expect(page.getByRole('listbox', { name: 'Linked order' }).getByRole('option', { name: /ORD-2026-0055/ })).toHaveCount(0);
});

test('Part 6 production lifecycle is sequential and synchronizes Quality Check and Ready back to the order', async ({ page }) => {
  await page.goto('/production?open=PJ-0045');
  const drawer = page.getByRole('dialog', { name: 'PJ-0045' });
  const status = drawer.getByRole('button', { name: 'Update production status' });

  await status.click();
  let list = page.getByRole('listbox', { name: 'Update production status' });
  await expect(list.getByRole('option', { name: 'In Production', exact: true })).toBeVisible();
  await expect(list.getByRole('option', { name: 'Quality Check', exact: true })).toBeVisible();
  await expect(list.getByRole('option', { name: 'Ready', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Quality Check', exact: true }).click();

  let snapshot = await state(page);
  expect(snapshot.productionJobs.find(job => job.id === 'PJ-0045')).toMatchObject({
    status: 'Quality Check',
    progress: 85,
  });
  expect(snapshot.orders.find(order => order.id === 'ORD-2026-0058').status).toBe('Quality Check');

  await drawer.getByRole('button', { name: 'Update production status' }).click();
  list = page.getByRole('listbox', { name: 'Update production status' });
  await expect(list.getByRole('option', { name: 'In Production', exact: true })).toHaveCount(0);
  await expect(list.getByRole('option', { name: 'Ready', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Ready', exact: true }).click();

  snapshot = await state(page);
  expect(snapshot.productionJobs.find(job => job.id === 'PJ-0045')).toMatchObject({
    status: 'Ready',
    progress: 95,
  });
  expect(snapshot.orders.find(order => order.id === 'ORD-2026-0058').status).toBe('Ready');

  const stockBeforeComplete = snapshot.materials.map(material => [material.id, material.currentStock]);
  await drawer.getByRole('button', { name: 'Mark as Completed' }).click();

  snapshot = await state(page);
  expect(snapshot.productionJobs.find(job => job.id === 'PJ-0045')).toMatchObject({
    status: 'Completed',
    progress: 100,
  });
  // Production completion means manufacturing is done; the sales order remains Ready for dispatch.
  expect(snapshot.orders.find(order => order.id === 'ORD-2026-0058').status).toBe('Ready');
  expect(snapshot.materials.map(material => [material.id, material.currentStock])).toEqual(stockBeforeComplete);
  await expect(drawer.getByRole('button', { name: 'Mark as Completed' })).toHaveCount(0);
});

test('Part 6 Delayed pauses progress and can resume only at the current production stage', async ({ page }) => {
  await page.goto('/production?open=PJ-0045');
  const drawer = page.getByRole('dialog', { name: 'PJ-0045' });

  await drawer.getByRole('button', { name: 'Update production status' }).click();
  await page.getByRole('option', { name: 'Delayed', exact: true }).click();

  let snapshot = await state(page);
  expect(snapshot.productionJobs.find(job => job.id === 'PJ-0045')).toMatchObject({
    status: 'Delayed',
    progress: 35,
  });
  await expect(drawer.getByLabel('Production progress percentage')).toBeDisabled();

  await drawer.getByRole('button', { name: 'Update production status' }).click();
  const list = page.getByRole('listbox', { name: 'Update production status' });
  await expect(list.getByRole('option', { name: 'Planning', exact: true })).toHaveCount(0);
  await expect(list.getByRole('option', { name: 'In Production', exact: true })).toBeVisible();
  await expect(list.getByRole('option', { name: 'Quality Check', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'In Production', exact: true }).click();

  snapshot = await state(page);
  expect(snapshot.productionJobs.find(job => job.id === 'PJ-0045')).toMatchObject({
    status: 'In Production',
    progress: 35,
  });
  await expect(drawer.getByLabel('Production progress percentage')).toBeEnabled();
});

test('Part 6 production start and material-consumption detail stay usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await resolveSeedShortage(page);
  await page.goto('/production');

  await page.getByRole('button', { name: 'New Job', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Create Production Job' });
  await modal.getByRole('button', { name: 'Linked order' }).click();
  await page.getByRole('option', { name: /ORD-2026-0055/ }).click();

  await expect.poll(async () => {
    const bounds = await modal.boundingBox();
    return bounds ? Math.ceil(bounds.width) : 9999;
  }).toBeLessThanOrEqual(321);
  expect(await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(4);

  await modal.getByRole('button', { name: 'Start Production & Consume Materials' }).click();
  const snapshot = await state(page);
  const job = snapshot.productionJobs.find(item => item.orderId === 'ORD-2026-0055');

  await page.goto('/production?open=' + encodeURIComponent(job.id));
  const drawer = page.getByRole('dialog', { name: job.jobNumber });
  await expect(drawer.getByRole('region', { name: 'Production material consumption' })).toBeVisible();
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return bounds ? Math.ceil(bounds.width) : 9999;
  }).toBeLessThanOrEqual(321);
});
