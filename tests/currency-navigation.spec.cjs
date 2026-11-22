const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
  await page.goto('/dashboard');
});

test('header closes the visible desktop sidebar and never opens a second sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const close = page.getByRole('button', { name: 'Close navigation', exact: true });
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  await close.click();
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toHaveCount(1);
  await expect(page.locator('#mobile-navigation')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 740 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.locator('#mobile-navigation')).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
  await expect(page.locator('#mobile-navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.locator('#mobile-navigation')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toHaveCount(1);
});

test('INR defaults, mixed currencies and cancelled orders remain correct across screens', async ({ page }) => {
  await page.goto('/customers');
  await expect(page.getByRole('row').filter({ hasText: 'PetroBuild Ltd.' })).toContainText('0orders');
  await page.getByRole('button', { name: 'Atlas Industrial Systems', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('₹36,720');
  await page.goto('/quotations');
  await page.getByRole('button', { name: 'Create Quotation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Currency', exact: true })).toContainText('INR');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Default currency', exact: true }).click();
  await page.getByRole('option', { name: 'EUR', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Default currency', exact: true })).toContainText('EUR');
  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Order currency', exact: true })).toContainText('EUR');
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: /^Monthly EUR Order Value/ })).toBeVisible();
  await page.getByRole('button', { name: 'Report currency', exact: true }).click();
  await page.getByRole('option', { name: 'INR', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Monthly INR Order Value/ })).toBeVisible();
  await page.goto('/customers');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('forgeflow-storage'));
    const base = saved.state.orders.find(o => o.id === 'ORD-2026-0057');
    base.currency = 'GBP';
    saved.state.orders.push({ ...base, id: 'USD-test', orderNumber: 'USD-test', currency: 'USD', totalAmount: 100 });
    saved.state.orders.push({ ...base, id: 'cancelled-test', orderNumber: 'cancelled-test', currency: 'GBP', totalAmount: 500, status: 'Cancelled' });
    localStorage.setItem('forgeflow-storage', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Atlas Industrial Systems', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('£36,720 · $100');
});

test('legacy currency migration preserves existing amounts and saved preferences', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Full Name', { exact: true }).fill('Legacy Owner');
  await page.getByRole('button', { name: 'Save Profile', exact: true }).click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('forgeflow-storage'));
    saved.version = 0;
    delete saved.state.defaultCurrency;
    saved.state.quotations.find(q => q.id === 'QT-2026-0145').currency = 'GBP';
    saved.state.orders.forEach(o => delete o.currency);
    localStorage.setItem('forgeflow-storage', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue('Legacy Owner');
  await expect(page.getByRole('button', { name: 'Default currency', exact: true })).toContainText('INR');
  await page.goto('/orders?open=ORD-2026-0057');
  await expect(page.getByRole('dialog')).toContainText('£36,720');
});

test('new enquiries use current product master and helpful validation', async ({ page }) => {
  await page.goto('/enquiries');
  await page.getByRole('button', { name: 'New Enquiry', exact: true }).click();
  await page.getByRole('button', { name: 'Create Enquiry', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Select a customer' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Select a product' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText('received undefined');
  await page.goto('/bom');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('forgeflow-storage'));
    saved.state.products.push({ ...saved.state.products[0], id: 'CUSTOM-PRODUCT', name: 'Custom Mixer', code: 'MIXER' });
    localStorage.setItem('forgeflow-storage', JSON.stringify(saved));
  });
  await page.goto('/enquiries');
  await page.getByRole('button', { name: 'New Enquiry', exact: true }).click();
  await page.getByRole('button', { name: 'Product', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Custom Mixer', exact: true })).toBeVisible();
});

test('sample inventory ledger and production relationships reconcile', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save Profile', exact: true }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('forgeflow-storage')).state);
  for (const job of state.productionJobs) {
    const order = state.orders.find(o => o.id === job.orderId);
    expect(order, job.id + ' linked order').toBeTruthy();
    expect(order.productionJobId).toBe(job.id);
    const requirement = state.materialRequirements.find(r => r.orderId === job.orderId);
    expect(requirement.status).toBe('Consumed');
    for (const line of requirement.lines) {
      const consumed = state.inventoryTransactions.filter(t => t.type === 'production_consumption' && t.reference === order.id && t.materialId === line.materialId)
        .reduce((sum, t) => sum - t.quantity, 0);
      expect(consumed).toBe(line.consumedQty);
    }
  }
  for (const material of state.materials) {
    const transactions = state.inventoryTransactions.filter(t => t.materialId === material.id).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
    let balance = 0;
    for (const transaction of transactions) {
      balance += transaction.quantity;
      expect(transaction.balanceAfter).toBe(balance);
    }
    expect(balance).toBe(material.currentStock);
  }
});
