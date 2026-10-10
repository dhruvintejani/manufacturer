const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Reset Demo Data warning clearly names every destructive demo-data category', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();

  const dialog = page.getByRole('dialog', { name: 'Reset Demo Data' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Customers & sales');
  await expect(dialog).toContainText('Product Master and Product BOM');
  await expect(dialog).toContainText('Inventory');
  await expect(dialog).toContainText('physical stock');
  await expect(dialog).toContainText('inventory transaction history');
  await expect(dialog).toContainText('Purchasing');
  await expect(dialog).toContainText('purchase/restock requests');
  await expect(dialog).toContainText('demo profile data');
  await expect(dialog.getByRole('button', { name: 'Reset Everything' })).toBeDisabled();
  await expect(dialog.getByLabel(/Type RESET/)).toBeVisible();
});

test('Reset Demo Data restores inventory, purchases, products and profile to seed state', async ({ page }) => {
  await page.goto('/settings');

  // Force a persisted demo snapshot, then alter the exact categories covered by the warning.
  await page.getByLabel('Full Name').fill('Changed Demo Operator');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('forgeflow-storage'));
    const state = stored.state;
    state.materials = state.materials.map(material =>
      material.id === 'MAT-002' ? { ...material, currentStock: 999 } : material);
    state.products.push({
      id: 'PRD-TEST-RESET',
      code: 'RESET-TEST',
      name: 'Reset Test Product',
      description: 'Temporary product for reset regression',
      bomVersion: '1.0',
      active: true,
      bom: [],
    });
    state.purchaseRequests.push({
      id: 'PUR-TEST-RESET',
      requestNumber: 'PUR-2026-999',
      materialId: 'MAT-002',
      supplier: 'Reset Test Supplier',
      quantity: 25,
      status: 'Requested',
      requestedAt: new Date().toISOString(),
    });
    localStorage.setItem('forgeflow-storage', JSON.stringify(stored));
  });

  await page.reload();
  await expect(page.getByLabel('Full Name')).toHaveValue('Changed Demo Operator');

  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset Demo Data' });
  await dialog.getByLabel(/Type RESET/).fill('RESET');
  await dialog.getByRole('button', { name: 'Reset Everything' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('ForgeFlow demo restored to the original sample state.')).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(state.materials.find(material => material.id === 'MAT-002').currentStock).toBe(120);
  expect(state.products.some(product => product.id === 'PRD-TEST-RESET')).toBe(false);
  expect(state.purchaseRequests.some(request => request.id === 'PUR-TEST-RESET')).toBe(false);
  expect(state.profile).toEqual({
    name: 'Alex Morgan',
    email: 'alex.morgan@forgeflow.com',
    role: 'Operations Manager',
    phone: '+1 555 000 0001',
  });
});
