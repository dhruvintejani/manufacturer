const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('record cells open details without sacrificing three-dot actions', async ({ page }) => {
  await page.goto('/customers');
  const row = page.getByRole('row').filter({ hasText: 'Global Traders Pvt. Ltd.' }).first();
  await row.getByRole('cell').nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Global Traders Pvt. Ltd.' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Global Traders Pvt. Ltd.' }).getByRole('button', { name: 'Close drawer' }).click();
  await row.getByRole('button', { name: 'Actions for Global Traders Pvt. Ltd.' }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit customer' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Global Traders Pvt. Ltd.' })).toBeVisible();
});

test('dashboard recent enquiry and order rows deep-link to exact details', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Recent Enquiries' })).toBeVisible();
  await expect(page.getByLabel('Enquiry pipeline summary')).toContainText('Open enquiries');
  await expect(page.getByRole('row').filter({ hasText: 'ENQ-2026-0476' })).toHaveCount(1);
  await page.getByRole('row').filter({ hasText: 'ENQ-2026-0482' }).click();
  await expect(page).toHaveURL(/\/enquiries\?open=ENQ-2026-0482/);
  await expect(page.getByRole('dialog', { name: 'ENQ-2026-0482' })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('row').filter({ hasText: 'ORD-2026-0055' }).click();
  await expect(page).toHaveURL(/\/orders\?open=ORD-2026-0055/);
  await expect(page.getByRole('dialog', { name: 'ORD-2026-0055' })).toBeVisible();
});

test('material row opens read-only details and Edit remains separate', async ({ page }) => {
  await page.goto('/materials');
  const row = page.getByRole('row').filter({ hasText: 'MAT-001' }).first();
  await row.getByRole('cell').nth(1).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('MAT-001');
  await expect(details).toContainText('Preferred supplier');
  await details.getByRole('button', { name: 'Edit Material' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Material' })).toBeVisible();
});

test('shared modals and quotation editor have rounded clipped corners on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).first().click();
  let modal = page.getByRole('dialog', { name: 'New Order' });
  await expect(modal).toBeVisible();
  let geometry = await modal.evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), overflow: getComputedStyle(el).overflow }));
  expect(geometry.radius).toBeGreaterThanOrEqual(16);
  expect(geometry.overflow).toBe('hidden');
  await modal.getByRole('button', { name: 'Close modal' }).click();

  await page.goto('/quotations');
  await page.getByRole('button', { name: 'Create Quotation' }).first().click();
  modal = page.getByRole('dialog', { name: 'Quotation editor' });
  await expect(modal).toBeVisible();
  geometry = await modal.evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), overflow: getComputedStyle(el).overflow }));
  expect(geometry.radius).toBeGreaterThanOrEqual(16);
  expect(geometry.overflow).toBe('hidden');
});

test('workspace copy avoids demo labels but accurately discloses local data', async ({ page }) => {
  for (const route of ['/dashboard', '/settings', '/help', '/reports', '/production']) {
    await page.goto(route);
    await expect(page.locator('main')).not.toBeEmpty();
    const visible = await page.locator('main').innerText();
    expect(visible, route + ' contains old demo label').not.toMatch(/\bdemo\b/i);
  }
  await page.goto('/settings');
  await expect(page.getByText(/browser-local workspace/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Workspace Data' })).toBeVisible();
});
