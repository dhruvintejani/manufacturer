const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Part 2 Reset Demo Data clearly lists all destructive demo areas and requires RESET confirmation', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();

  const dialog = page.getByRole('dialog', { name: 'Reset Demo Data' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('This action is destructive for this browser.');
  await expect(dialog).toContainText('It cannot be undone.');
  await expect(dialog).toContainText('Products & BOMs');
  await expect(dialog).toContainText('Inventory');
  await expect(dialog).toContainText('Purchases');
  await expect(dialog).toContainText('Profile & app state');

  const reset = dialog.getByRole('button', { name: 'Reset Everything' });
  await expect(reset).toBeDisabled();
  await dialog.getByLabel(/Type RESET to permanently restore the original demo/).fill('reset');
  await expect(reset).toBeEnabled();
});

test('Part 2 reset restores inventory, purchases, products and profile data to original demo state', async ({ page }) => {
  await page.goto('/settings');

  await page.getByLabel('Full Name').fill('Changed Demo Operator');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Demo profile saved in this browser.')).toBeVisible();

  await page.evaluate(() => {
    const key = 'forgeflow-storage';
    const saved = JSON.parse(localStorage.getItem(key));
    saved.state.profile.name = 'Changed Demo Operator';
    saved.state.products[0].name = 'Changed Product Name';
    saved.state.materials[0].currentStock = 9999;
    saved.state.purchaseRequests.unshift({
      id: 'PUR-TEST-RESET',
      requestNumber: 'PUR-TEST-RESET',
      materialId: saved.state.materials[0].id,
      supplier: 'Changed Supplier',
      quantity: 123,
      status: 'Requested',
      requestedAt: new Date().toISOString(),
      note: 'Should disappear after reset',
    });
    localStorage.setItem(key, JSON.stringify(saved));
  });

  await page.reload();
  await expect(page.getByLabel('Full Name')).toHaveValue('Changed Demo Operator');

  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset Demo Data' });
  await dialog.getByLabel(/Type RESET to permanently restore the original demo/).fill('RESET');
  await dialog.getByRole('button', { name: 'Reset Everything' }).click();

  await expect(page.getByText('ForgeFlow demo restored to the original sample state.')).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(state.profile.name).toBe('Alex Morgan');
  expect(state.products[0].name).not.toBe('Changed Product Name');
  expect(state.materials[0].currentStock).not.toBe(9999);
  expect(state.purchaseRequests.some(request => request.id === 'PUR-TEST-RESET')).toBe(false);
});
