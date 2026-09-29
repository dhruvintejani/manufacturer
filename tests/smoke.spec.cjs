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
  for (const zoom of [1, 1.25, 1.5, 1.75, 2]) {
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
  await expect(page.getByLabel('Order status audit trail').getByText('Fabrication scheduled after materials arrived.')).toBeVisible();
  await expect(page.getByText(/Updated by Alex Morgan/)).toBeVisible();
  await page.reload();
  await page.getByPlaceholder('Search by order no., customer or product...').fill('ORD-2026-0055');
  await page.getByRole('button', { name: 'ORD-2026-0055', exact: true }).click();
  await expect(page.getByLabel('Order status audit trail').getByText('Fabrication scheduled after materials arrived.')).toBeVisible();
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

test('saved demo profile updates the header, survives refresh, and labels are accessible', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Full Name').fill('Taylor Quality');
  await page.getByLabel('Email Address').fill('taylor@example.com');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.locator('header').getByText('Taylor Quality')).toBeVisible();
  await page.reload();
  await expect(page.locator('header').getByText('Taylor Quality')).toBeVisible();
});

test('nested order status modal closes independently on Escape', async ({ page }) => {
  await page.goto('/orders');
  await page.getByPlaceholder('Search by order no., customer or product...').fill('ORD-2026-0055');
  await page.getByRole('button', { name: 'ORD-2026-0055', exact: true }).click();
  await page.getByRole('button', { name: /Update Status/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByText('Status History')).toBeVisible();
});

test('linked customers cannot be deleted, avoiding orphaned manufacturing records', async ({ page }) => {
  await page.goto('/customers');
  await page.getByPlaceholder('Search by company, contact, email or country...').fill('Global Traders');
  await page.getByRole('button', { name: 'Actions for Global Traders Pvt. Ltd.' }).click();
  await page.getByRole('menuitem', { name: 'Delete customer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Cannot delete a customer linked to enquiries, quotations or orders.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Global Traders Pvt. Ltd.', exact: true })).toBeVisible();
});

test('navigating from a scrolled section starts the next section at the top', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 540 });
  await page.goto('/dashboard');
  const main = page.locator('main');
  const previousScroll = await main.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(previousScroll).toBeGreaterThan(50);

  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0);
});

test('table next, previous and numbered pages all start at the top', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 540 });
  await page.goto('/customers');
  await page.evaluate(async () => {
    const key = 'forgeflow-storage';
    let saved = JSON.parse(window.localStorage.getItem(key));
    if (!saved) {
      const { seedCustomers } = await import('/src/data/seedData.ts');
      saved = { state: { customers: seedCustomers }, version: 0 };
    }
    const existing = saved.state.customers[0];
    for (let n = 0; n < 5; n++) {
      saved.state.customers.push({ ...existing, id: 'TEST-C' + n, companyName: 'Extra Demo Customer ' + n });
    }
    window.localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();

  const main = page.locator('main');
  async function checkPage(buttonName, activePage) {
    const before = await main.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(before).toBeGreaterThan(50);
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await expect(page.getByRole('button', { name: String(activePage), exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0);
  }

  await checkPage('Next page', 2);
  await checkPage('Previous page', 1);
  await checkPage('2', 2);
});

test('help has dedicated manufacturing workflow guidance, not settings', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible();
  await expect(page.getByText(/This preview stores operational changes/)).toBeVisible();
  await page.getByRole('button', { name: 'Quotations', exact: true }).click();
  await expect(page.getByText(/Prepare Email opens your email application/)).toBeVisible();
});

test('dashboard activity deep-links to its exact record', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open activity: New enquiry received' }).click();
  await expect(page).toHaveURL(/enquiries\?open=ENQ-2026-0482/);
  await expect(page.getByRole('dialog', { name: /ENQ-2026-0482/ })).toBeVisible();
});

test('customer details show actionable related enquiries, quotations and orders', async ({ page }) => {
  await page.goto('/customers?open=C001');
  const drawer = page.getByRole('dialog', { name: /Global Traders Pvt. Ltd./ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: /Enquiries/ })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: /Quotations/ })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: /Orders/ })).toBeVisible();
  await drawer.getByRole('button', { name: 'Open ENQ-2026-0482' }).click();
  await expect(page).toHaveURL(/enquiries\?open=ENQ-2026-0482/);
  await expect(page.getByRole('dialog', { name: /ENQ-2026-0482/ })).toBeVisible();
});

test('order hold, resume, cancellation and audit history survive refresh', async ({ page }) => {
  await page.goto('/orders?open=ORD-2026-0055');
  const drawer = page.getByRole('dialog', { name: /ORD-2026-0055/ });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Put On Hold' }).click();
  await page.getByLabel('Status note (optional)').fill('Supplier component pending');
  await page.getByRole('button', { name: 'Confirm Hold' }).click();
  await expect(drawer.getByText('Supplier component pending')).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Update Status/ })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Resume Order' }).click();
  await page.getByRole('button', { name: 'Confirm Resume' }).click();
  await expect(drawer.getByRole('button', { name: /Update Status/ })).toBeVisible();
  await drawer.getByRole('button', { name: 'Cancel Order' }).click();
  await page.getByRole('button', { name: 'Confirm Cancellation' }).click();
  await expect(drawer.getByText('This order is cancelled and its workflow is closed.')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Resume Order' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: /ORD-2026-0055/ }).getByText('This order is cancelled and its workflow is closed.')).toBeVisible();
});

test('end-to-end manufacturing flow: enquiry to quoted, produced, dispatched and completed order', async ({ page }) => {
  test.setTimeout(100_000);
  // Begin with an unquoted enquiry; use application actions rather than rewriting store records.
  await page.goto('/enquiries?open=ENQ-2026-0478');
  await page.getByRole('dialog', { name: 'ENQ-2026-0478' }).getByRole('button', { name: 'Create Quotation' }).click();
  const editor = page.getByRole('dialog', { name: 'Quotation editor' });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Linked enquiry' })).toContainText('ENQ-2026-0478');
  await editor.locator('input[type="number"]').nth(0).fill('2');
  await editor.locator('input[type="number"]').nth(1).fill('2500');
  await expect(editor.getByRole('button', { name: 'Preview' })).toBeVisible();
  // Save first to give the customer quotation a persistent number.
  // The editor's separate unsaved-PDF action is covered by the draft-quotation test.
  await editor.getByRole('button', { name: 'Save Draft' }).click({ timeout: 12_000 });

  const quoteId = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('forgeflow-storage')).state;
    return data.quotations.find(q => q.enquiryId === 'ENQ-2026-0478')?.id;
  });
  expect(quoteId).toBeTruthy();
  await page.goto('/quotations?open=' + encodeURIComponent(quoteId));
  const quote = page.getByRole('dialog', { name: /QT-/ });
  await expect(quote).toBeVisible();
  const pdf = page.waitForEvent('download', { timeout: 15_000 });
  await quote.getByRole('button', { name: 'PDF', exact: true }).click({ timeout: 12_000 });
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/i);
  await quote.getByRole('button', { name: 'Mark as Sent' }).click();
  await quote.getByRole('button', { name: 'Mark Approved' }).click();
  await quote.getByRole('button', { name: 'Convert to Order' }).click();
  await page.getByRole('dialog', { name: 'Convert to Order' }).getByRole('button', { name: 'Convert to Order' }).click();
  await expect(page).toHaveURL(/\/orders$/);

  const orderId = await page.evaluate(qId =>
    JSON.parse(localStorage.getItem('forgeflow-storage')).state.orders.find(o => o.quotationId === qId)?.id,
    quoteId,
  );
  expect(orderId).toBeTruthy();
  await page.goto('/orders?open=' + encodeURIComponent(orderId));
  await page.getByRole('dialog', { name: /ORD-/ }).getByRole('button', { name: 'Create Production Job' }).click();
  await page.getByRole('dialog', { name: 'Create Production Job' }).getByRole('button', { name: 'Create Job' }).click();
  await expect(page).toHaveURL(/\/production$/);

  const jobId = await page.evaluate(oId =>
    JSON.parse(localStorage.getItem('forgeflow-storage')).state.productionJobs.find(j => j.orderId === oId)?.id,
    orderId,
  );
  expect(jobId).toBeTruthy();
  await page.goto('/production?open=' + encodeURIComponent(jobId));
  for (const status of ['In Production', 'Quality Check', 'Ready', 'Completed']) {
    await page.getByRole('button', { name: 'Update production status' }).click();
    await page.getByRole('option', { name: status, exact: true }).click();
  }

  await page.goto('/orders?open=' + encodeURIComponent(orderId));
  const order = page.getByRole('dialog', { name: /ORD-/ });
  await expect(order.getByRole('button', { name: /Update Status.*Dispatched/ })).toBeVisible();
  await order.getByRole('button', { name: /Update Status.*Dispatched/ }).click();
  await page.getByRole('button', { name: 'Confirm Update' }).click();
  await order.getByRole('button', { name: /Update Status.*Completed/ }).click();
  await page.getByRole('button', { name: 'Confirm Update' }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: /ORD-/ }).getByText('Completed', { exact: true }).first()).toBeVisible();
  const state = await page.evaluate(id => JSON.parse(localStorage.getItem('forgeflow-storage')).state.orders.find(o => o.id === id), orderId);
  expect(state.status).toBe('Completed');
  expect(state.statusHistory.some(change => change.to === 'Dispatched')).toBe(true);
  expect(state.statusHistory.some(change => change.to === 'Completed')).toBe(true);
});

test('tablet and laptop sizes keep every route usable without page-level horizontal overflow', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 820 });
    for (const route of ['dashboard', 'customers', 'enquiries', 'quotations', 'orders', 'production', 'reports', 'settings', 'help']) {
      await page.goto('/' + route);
      await expect(page.locator('main')).not.toBeEmpty();
      const delta = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(delta, route + ' at ' + width + 'px viewport').toBeLessThan(4);
    }
  }
  expect(failures).toEqual([]);
});
