const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Help explains the complete BOM -> inventory -> restock -> production workflow', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'ForgeFlow end-to-end demo' })).toBeVisible();

  const workflow = page.getByRole('region', { name: 'End-to-end workflow' });
  await expect(workflow).toContainText('Product BOM');
  await expect(workflow).toContainText('Material Requirement');
  await expect(workflow).toContainText('Inventory Check');
  await expect(workflow).toContainText('Purchase / Restock');
  await expect(workflow).toContainText('Production');
  await expect(workflow).toContainText('Reports');

  for (const section of [
    'Orders & Material Check',
    'Product BOM',
    'Inventory / Stock',
    'Purchase / Restock',
    'Production',
    'Reports',
  ]) {
    await expect(page.getByRole('button', { name: section, exact: true })).toBeVisible();
  }

  await expect(page.getByText(/production start consumes reserved material exactly once/i)).toBeVisible();
  await expect(page.getByText(/restores the original customers, enquiries, quotations, orders, production jobs, materials, product BOMs/i)).toBeVisible();
});

test('Reset Demo Data copy names the full reset scope and reset restores product, inventory, purchase and profile data', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByText(/materials, product BOMs, inventory transactions, purchase\/restock requests/i)).toBeVisible();

  // Ensure a persisted snapshot exists using a control available on both desktop and mobile,
  // then deliberately alter multiple reset domains.
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Demo profile saved in this browser.')).toBeVisible();
  await page.evaluate(() => {
    const raw = localStorage.getItem('forgeflow-storage');
    const parsed = JSON.parse(raw);
    parsed.state.profile = {
      ...parsed.state.profile,
      name: 'Changed Demo User',
      email: 'changed@example.test',
    };
    parsed.state.materials = [
      ...parsed.state.materials,
      {
        id: 'MAT-RESET-QA',
        code: 'RESET-QA',
        name: 'Reset QA Material',
        category: 'QA',
        unit: 'kg',
        currentStock: 77,
        minimumStock: 10,
        reorderLevel: 20,
        supplier: 'QA Supplier',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    parsed.state.products = parsed.state.products.map((product, index) =>
      index === 0 ? { ...product, name: 'Changed Product Name', bomVersion: '99.9' } : product);
    parsed.state.purchaseRequests = [
      {
        id: 'PUR-RESET-QA',
        requestNumber: 'PUR-RESET-QA',
        materialId: 'MAT-001',
        supplier: 'QA Supplier',
        quantity: 123,
        status: 'Requested',
        requestedAt: new Date().toISOString(),
      },
      ...parsed.state.purchaseRequests,
    ];
    localStorage.setItem('forgeflow-storage', JSON.stringify(parsed));
  });

  await page.reload();
  const changedState = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(changedState.profile.name).toBe('Changed Demo User');
  expect(changedState.materials.some(material => material.id === 'MAT-RESET-QA')).toBe(true);
  expect(changedState.purchaseRequests.some(request => request.id === 'PUR-RESET-QA')).toBe(true);

  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset Demo Data' });
  await expect(dialog).toContainText('materials');
  await expect(dialog).toContainText('products/BOMs');
  await expect(dialog).toContainText('inventory');
  await expect(dialog).toContainText('purchases');
  await expect(dialog).toContainText('profile data');
  await dialog.getByRole('button', { name: 'Reset Data' }).click();

  await expect(page.getByText('Demo data reset successfully!')).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  expect(state.profile.name).not.toBe('Changed Demo User');
  expect(state.materials.some(material => material.id === 'MAT-RESET-QA')).toBe(false);
  expect(state.products[0].name).not.toBe('Changed Product Name');
  expect(state.products[0].bomVersion).not.toBe('99.9');
  expect(state.purchaseRequests.some(request => request.id === 'PUR-RESET-QA')).toBe(false);
  expect(state.inventoryTransactions.length).toBeGreaterThan(0);
});

test('Help and Settings remain mobile-safe after documentation/reset updates', async ({ page }) => {
  for (const route of ['help', 'settings']) {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/' + route);
    await expect(page.locator('main')).not.toBeEmpty();
    const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, route + ' should not horizontally overflow').toBeLessThan(4);
  }
});
