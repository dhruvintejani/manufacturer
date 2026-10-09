const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Part 7 dashboard shows live cross-module alerts with exact actions', async ({ page }) => {
  await page.goto('/dashboard');

  const center = page.getByRole('region', { name: 'Operations attention center' });
  await expect(center).toBeVisible();
  await expect(center.getByText('ORD-2026-0055 material shortage')).toBeVisible();
  await expect(center.getByText('SS316 Sheet is below minimum')).toBeVisible();
  await expect(center.getByText('Welding Rod is below minimum')).toBeVisible();
  await expect(center.getByText('PUR-2026-001 needs ordering')).toBeVisible();

  await center.getByRole('button', { name: 'Open alert: ORD-2026-0055 material shortage' }).click();
  await expect(page).toHaveURL(/\/orders\?open=ORD-2026-0055$/);
  await expect(page.getByRole('dialog', { name: /ORD-2026-0055/ })).toBeVisible();

  await page.goto('/dashboard');
  const nextCenter = page.getByRole('region', { name: 'Operations attention center' });
  await nextCenter.getByRole('button', { name: 'Open alert: SS316 Sheet is below minimum' }).click();
  await expect(page).toHaveURL(/\/inventory\?open=MAT-002$/);
  await expect(page.getByRole('dialog', { name: /SS316 Sheet/ })).toBeVisible();
});

test('Part 7 notification center separates unresolved operational alerts from read event history', async ({ page }) => {
  await page.goto('/dashboard');

  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await bell.click();

  const active = page.getByRole('region', { name: 'Active operational alerts' });
  await expect(active).toBeVisible();
  await expect(active.getByText('SS316 Sheet is below minimum')).toBeVisible();
  await expect(active.getByText('ORD-2026-0055 material shortage')).toBeVisible();

  const markRead = page.getByRole('button', { name: 'Mark events read' });
  if (await markRead.count()) await markRead.click();

  // Event notifications can be marked read, but unresolved live conditions stay visible.
  await expect(active.getByText('SS316 Sheet is below minimum')).toBeVisible();
  await active.getByRole('button', { name: 'Open alert: SS316 Sheet is below minimum' }).click();
  await expect(page).toHaveURL(/\/inventory\?open=MAT-002$/);
  await expect(page.getByRole('dialog', { name: /SS316 Sheet/ })).toBeVisible();
});

test('Part 7 global search deep-links materials, purchases and BOM products to exact records', async ({ page }) => {
  await page.goto('/dashboard');
  const search = page.getByLabel('Search manufacturing records');

  await search.fill('SS316');
  let results = page.getByRole('region', { name: 'Search results' });
  const materialResult = results.getByRole('button').filter({ hasText: 'Material' }).filter({ hasText: 'SS316 Sheet' }).first();
  await expect(materialResult).toBeVisible();
  await materialResult.click();
  await expect(page).toHaveURL(/\/inventory\?open=MAT-002$/);
  await expect(page.getByRole('dialog', { name: /SS316 Sheet/ })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByLabel('Search manufacturing records').fill('PUR-2026-001');
  results = page.getByRole('region', { name: 'Search results' });
  const purchaseResult = results.getByRole('button').filter({ hasText: 'Purchase' }).filter({ hasText: 'PUR-2026-001' }).first();
  await expect(purchaseResult).toBeVisible();
  await purchaseResult.click();
  await expect(page).toHaveURL(/\/purchases\?open=PUR-001$/);
  await expect(page.getByRole('dialog', { name: 'PUR-2026-001' })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByLabel('Search manufacturing records').fill('REACTOR');
  results = page.getByRole('region', { name: 'Search results' });
  const bomResult = results.getByRole('button').filter({ hasText: 'BOM' }).filter({ hasText: 'Reactor' }).first();
  await expect(bomResult).toBeVisible();
  await bomResult.click();
  await expect(page).toHaveURL(/\/bom\?open=PRD-001$/);
  await expect(page.getByRole('heading', { name: 'Reactor', exact: true })).toBeVisible();
});

test('Part 7 live alerts clear automatically after restock resolves the underlying shortage', async ({ page }) => {
  await page.goto('/purchases');

  const row = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(row.getByText('Ordered', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Receive Material' }).click();
  await expect(row.getByText('Received', { exact: true })).toBeVisible();

  await page.goto('/dashboard');
  const center = page.getByRole('region', { name: 'Operations attention center' });
  await expect(center).not.toContainText('ORD-2026-0055 material shortage');
  await expect(center).not.toContainText('SS316 Sheet is below minimum');
  await expect(center).not.toContainText('PUR-2026-001 needs ordering');
  await expect(center).toContainText('Welding Rod is below minimum');

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055').status).toBe('Ready');
  expect(state.materials.find(item => item.id === 'MAT-002').currentStock).toBe(420);
  expect(state.purchaseRequests.find(item => item.id === 'PUR-001').status).toBe('Received');
});

test('Part 7 dashboard and notification center stay usable on small phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/dashboard');

  const center = page.getByRole('region', { name: 'Operations attention center' });
  await expect(center).toBeVisible();
  expect(await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(4);

  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const active = page.getByRole('region', { name: 'Active operational alerts' });
  await expect(active).toBeVisible();

  const notificationPanel = page.getByRole('heading', { name: 'Notifications' }).locator('..').locator('..');
  const bounds = await notificationPanel.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + Math.min(bounds.height, 568)).toBeLessThanOrEqual(569);
});
