const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Part 1 Material Master creates, normalizes, persists and safely validates materials', async ({ page }) => {
  await page.goto('/materials');
  await expect(page.getByRole('heading', { name: 'Materials', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add Material' }).click();
  let modal = page.getByRole('dialog', { name: 'Add Material' });
  await modal.getByLabel('Material Code').fill('test-al');
  await modal.getByLabel('Material Name').fill('Test Alloy');
  await modal.getByLabel('Category').fill('Alloy');
  await modal.getByLabel('Opening Stock').fill('25');
  await modal.getByLabel('Minimum Stock').fill('10');
  await modal.getByLabel('Reorder Level').fill('15');
  await modal.getByLabel('Supplier').fill('Demo Supplier');
  await modal.getByRole('button', { name: 'Add Material' }).click();

  const row = page.getByRole('row').filter({ hasText: 'Test Alloy' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('TEST-AL');
  await expect(row).toContainText('25');

  let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  const created = persisted.materials.find(material => material.code === 'TEST-AL');
  expect(created).toBeTruthy();
  expect(created).toMatchObject({
    name: 'Test Alloy',
    currentStock: 25,
    minimumStock: 10,
    reorderLevel: 15,
  });
  const opening = persisted.inventoryTransactions.find(transaction =>
    transaction.materialId === created.id && transaction.type === 'opening');
  expect(opening).toMatchObject({ quantity: 25, balanceAfter: 25 });

  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Test Alloy' })).toContainText('TEST-AL');

  await page.getByRole('button', { name: 'Edit Test Alloy' }).click();
  modal = page.getByRole('dialog', { name: 'Edit Material' });

  await modal.getByLabel('Material Code').fill('ss304');
  await modal.getByRole('button', { name: 'Save Material' }).click();
  await expect(page.getByText('Material code SS304 already exists.')).toBeVisible();
  await expect(modal).toBeVisible();

  await modal.getByLabel('Material Code').fill('TEST-AL');
  await modal.getByLabel('Minimum Stock').fill('20');
  await modal.getByLabel('Reorder Level').fill('10');
  await modal.getByRole('button', { name: 'Save Material' }).click();
  await expect(page.getByText('Reorder level must be equal to or greater than the minimum stock level.')).toBeVisible();
  await expect(modal).toBeVisible();

  await modal.getByLabel('Reorder Level').fill('30');
  await modal.getByRole('button', { name: 'Save Material' }).click();
  await expect(modal).toBeHidden();

  persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  const updated = persisted.materials.find(material => material.code === 'TEST-AL');
  expect(updated.minimumStock).toBe(20);
  expect(updated.reorderLevel).toBe(30);
  expect(updated.currentStock).toBe(25);
});

test('Part 1 Material Master stays inside phone viewport and direct route refresh works', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/materials');
  await expect(page.getByRole('heading', { name: 'Materials', exact: true })).toBeVisible();
  expect(await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(4);

  await page.reload();
  await expect(page).toHaveURL(/\/materials$/);
  await expect(page.getByRole('button', { name: 'Add Material' })).toBeVisible();

  await page.getByRole('button', { name: 'Add Material' }).click();
  const modal = page.getByRole('dialog', { name: 'Add Material' });
  await expect(modal).toBeVisible();
  const bounds = await modal.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
});
