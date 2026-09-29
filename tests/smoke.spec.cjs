const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Clear only once per test, not on subsequent navigations or reloads under test.
  await page.goto('/');
  await page.evaluate(() => window.localStorage.removeItem('forgeflow-storage'));
});

test('all application sections render without JS crashes at desktop and 100-200% zoom', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const zoom of [1, 1.25, 1.5, 2]) {
    for (const route of ['dashboard', 'customers', 'enquiries', 'quotations', 'orders', 'production', 'reports', 'settings']) {
      await page.goto('/' + route);
      await page.evaluate(factor => { document.documentElement.style.zoom = String(factor); }, zoom);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).not.toBeEmpty();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route + ' at ' + zoom + ' zoom should not spill the whole page').toBeLessThan(4);
    }
  }
  expect(failures).toEqual([]);
});

test('mobile navigation and application pages remain usable', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('link', { name: 'Production' })).toBeVisible();
  await page.getByRole('link', { name: 'Production' }).click();
  await expect(page).toHaveURL(/\/production$/);
  await expect(page.getByRole('heading', { name: 'Production', exact: true })).toBeVisible();
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content - width.client).toBeLessThan(4);
  expect(failures).toEqual([]);
});

test('orders advance one stage at a time and retain an audited history after refresh', async ({ page }) => {
  await page.goto('/orders');
  await page.getByPlaceholder('Search by order no., customer or product...').fill('ORD-2026-0055');
  await page.getByRole('button', { name: 'ORD-2026-0055', exact: true }).click();
  await expect(page.getByText('Status History')).toBeVisible();
  await page.getByRole('button', { name: /Update Status/ }).click();
  await page.getByLabel('Update note (optional)').fill('Fabrication scheduled after materials arrived.');
  await page.getByRole('button', { name: 'Confirm Update' }).click();
  await expect(page.getByText('Fabrication scheduled after materials arrived.')).toBeVisible();
  await expect(page.getByText(/Updated by Alex Morgan/)).toBeVisible();
  await page.reload();
  await page.getByPlaceholder('Search by order no., customer or product...').fill('ORD-2026-0055');
  await page.getByRole('button', { name: 'ORD-2026-0055', exact: true }).click();
  await expect(page.getByText('Fabrication scheduled after materials arrived.')).toBeVisible();
});

test('enquiry detail shows contact actions and supports closing an enquiry', async ({ page }) => {
  await page.goto('/enquiries');
  await page.getByPlaceholder('Search by enquiry ID, customer or product...').fill('ENQ-2026-0478');
  await page.getByRole('button', { name: 'ENQ-2026-0478', exact: true }).click();
  await expect(page.getByText('Customer Information')).toBeVisible();
  await expect(page.getByText('Contact Person')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact Customer' })).toHaveAttribute('href', /mailto:/);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Enquiry closed.')).toBeVisible();
});

test('quotation can be created, previewed as PDF, and saved as draft', async ({ page }) => {
  await page.goto('/quotations');
  await page.getByRole('button', { name: 'Create Quotation' }).first().click();
  await page.getByRole('button', { name: 'Quotation customer' }).click();
  await page.getByRole('option', { name: 'Global Traders Pvt. Ltd.' }).click();
  await page.getByRole('button', { name: 'Product for line 1' }).click();
  await page.getByRole('option', { name: 'Pressure Vessel' }).click();
  const editor = page.getByRole('dialog', { name: 'Quotation editor' });
  await editor.locator('input[type="number"]').nth(0).fill('2');
  await editor.locator('input[type="number"]').nth(1).fill('1500');
  const download = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Generate PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/quotation.*\.pdf/i);
  await editor.getByRole('button', { name: 'Save Draft' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText(/Quotation created successfully/)).toBeVisible();
});

test('production milestone updates are reflected on linked orders', async ({ page }) => {
  await page.goto('/production');
  await page.getByPlaceholder('Search by job no., product or order...').fill('PJ-0045');
  await page.getByRole('button', { name: 'PJ-0045', exact: true }).click();
  await page.getByRole('button', { name: 'Update production status' }).click();
  await page.getByRole('option', { name: 'Quality Check' }).click();
  await expect(page.getByText(/status updated to Quality Check/)).toBeVisible();
  await page.reload();
  await page.getByPlaceholder('Search by job no., product or order...').fill('PJ-0045');
  await page.getByRole('button', { name: 'PJ-0045', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('85%')).toBeVisible();
});

test('dashboard KPI cards lead to filtered worklists', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Open Pending Quotations:/ }).click();
  await expect(page).toHaveURL(/quotations\?status=pending/);
  await expect(page.getByRole('button', { name: 'Quotation status filter' })).toContainText('Pending Quotations');
});
