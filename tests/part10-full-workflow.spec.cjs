const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const state = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

const readPdf = async download => {
  const filePath = await download.path();
  const bytes = fs.readFileSync(filePath);
  const text = bytes.toString('latin1');
  return {
    bytes,
    text,
    pageCount: (text.match(/\/Type\s*\/Page\b/g) || []).length,
  };
};

const assertInventoryInvariants = snapshot => {
  for (const material of snapshot.materials) {
    expect(material.currentStock, material.code + ' physical stock cannot be negative').toBeGreaterThanOrEqual(0);
    const reserved = snapshot.materialRequirements
      .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
      .flatMap(requirement => requirement.lines)
      .filter(line => line.materialId === material.id)
      .reduce((sum, line) => sum + line.reservedQty, 0);
    expect(reserved, material.code + ' reservations cannot exceed physical stock')
      .toBeLessThanOrEqual(material.currentStock + 1e-9);
  }
};

test('Part 10 completes the full customer-to-report manufacturing workflow with synchronized inventory', async ({ page }) => {
  test.setTimeout(150_000);
  const company = 'Part 10 QA Industries';

  // 1. CUSTOMER
  await page.goto('/customers');
  await page.getByRole('button', { name: 'Add Customer', exact: true }).first().click();
  const customerModal = page.getByRole('dialog', { name: 'Add New Customer' });
  await customerModal.getByLabel('Company Name').fill(company);
  await customerModal.getByLabel('Contact Person').fill('Aarav Shah');
  await customerModal.getByLabel('Email Address').fill('qa-part10@example.test');
  await customerModal.getByLabel('Phone').fill('+91 98765 43210');
  await customerModal.getByLabel('Country').fill('India');
  await customerModal.getByLabel('Address', { exact: true }).fill('Industrial Estate, Gujarat');
  await customerModal.getByRole('button', { name: 'Add Customer', exact: true }).click();
  await expect(page.getByText(company, { exact: true }).first()).toBeVisible();

  let snapshot = await state(page);
  const customer = snapshot.customers.find(item => item.companyName === company);
  expect(customer).toBeTruthy();

  // 2. ENQUIRY
  await page.goto('/enquiries');
  await page.getByRole('button', { name: 'New Enquiry', exact: true }).first().click();
  const enquiryModal = page.getByRole('dialog', { name: 'New Enquiry' });
  await enquiryModal.getByRole('button', { name: 'Customer', exact: true }).click();
  await page.getByRole('option', { name: company, exact: true }).click();
  await enquiryModal.getByRole('button', { name: 'Product', exact: true }).click();
  await page.getByRole('option', { name: 'Reactor', exact: true }).click();
  await enquiryModal.getByLabel('Quantity').fill('1');
  await enquiryModal.getByLabel('Expected Delivery Date').fill('2026-12-15');
  await enquiryModal.getByLabel('Requirement / Description').fill('One industrial reactor for the Part 10 end-to-end QA workflow.');
  await enquiryModal.getByRole('button', { name: 'Create Enquiry' }).click();

  snapshot = await state(page);
  const enquiry = snapshot.enquiries.find(item => item.customerId === customer.id && item.product === 'Reactor');
  expect(enquiry).toBeTruthy();
  expect(enquiry.quantity).toBe(1);

  // 3. QUOTATION
  await page.goto('/enquiries?open=' + encodeURIComponent(enquiry.id));
  const enquiryDrawer = page.getByRole('dialog', { name: enquiry.id });
  await enquiryDrawer.getByRole('button', { name: 'Create Quotation' }).click();
  const quoteEditor = page.getByRole('dialog', { name: 'Quotation editor' });
  await expect(quoteEditor.getByRole('button', { name: 'Linked enquiry' })).toContainText(enquiry.id);
  await quoteEditor.getByRole('button', { name: 'Product for line 1' }).click();
  await page.getByRole('option', { name: 'Reactor', exact: true }).click();
  await quoteEditor.locator('input[type="number"]').nth(0).fill('1');
  await quoteEditor.locator('input[type="number"]').nth(1).fill('150000');
  await quoteEditor.getByRole('button', { name: 'Save Draft' }).click();

  snapshot = await state(page);
  const quotation = snapshot.quotations.find(item => item.enquiryId === enquiry.id);
  expect(quotation).toBeTruthy();
  expect(quotation.status).toBe('Draft');

  await page.goto('/quotations?open=' + encodeURIComponent(quotation.id));
  const quoteDrawer = page.getByRole('dialog', { name: quotation.quotationNumber });
  await quoteDrawer.getByRole('button', { name: 'Mark as Sent' }).click();
  await quoteDrawer.getByRole('button', { name: 'Mark Approved' }).click();
  await quoteDrawer.getByRole('button', { name: 'Convert to Order' }).click();
  await page.getByRole('dialog', { name: 'Convert to Order' })
    .getByRole('button', { name: 'Convert to Order' }).click();
  await expect(page).toHaveURL(/\/orders$/);

  snapshot = await state(page);
  const order = snapshot.orders.find(item => item.quotationId === quotation.id);
  expect(order).toBeTruthy();
  expect(order).toMatchObject({
    customerId: customer.id,
    product: 'Reactor',
    quantity: 1,
    status: 'Confirmed',
  });
  const requirementBefore = snapshot.materialRequirements.find(item => item.orderId === order.id);
  expect(requirementBefore).toBeTruthy();
  expect(requirementBefore.status).toBe('Shortage');
  expect(requirementBefore.lines.some(line => line.requiredQty > line.reservedQty)).toBe(true);
  assertInventoryInvariants(snapshot);

  // 4. MATERIAL SHORTAGE -> PURCHASE / RESTOCK
  await page.goto('/orders?open=' + encodeURIComponent(order.id));
  let orderDrawer = page.getByRole('dialog', { name: order.orderNumber });
  const readiness = orderDrawer.getByRole('region', { name: 'Material readiness' });
  await expect(readiness).toContainText('Shortage');
  await expect(orderDrawer.getByRole('button', { name: 'Create Production Job' })).toBeDisabled();

  const restock = readiness.getByRole('button', { name: /Restock .*kg/ }).first();
  await expect(restock).toBeVisible();
  await restock.click();

  snapshot = await state(page);
  const purchase = snapshot.purchaseRequests.find(item =>
    item.orderId === order.id && !['Received', 'Cancelled'].includes(item.status));
  expect(purchase).toBeTruthy();
  expect(purchase.status).toBe('Requested');

  await page.goto('/purchases');
  await page.getByLabel('Search purchase requests').fill(order.orderNumber);
  const purchaseRow = page.getByRole('row').filter({ hasText: purchase.requestNumber });
  await expect(purchaseRow).toContainText(order.orderNumber);
  await purchaseRow.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(purchaseRow.getByText('Ordered', { exact: true })).toBeVisible();
  await purchaseRow.getByRole('button', { name: 'Receive Material' }).click();
  await expect(purchaseRow.getByText('Received', { exact: true })).toBeVisible();

  snapshot = await state(page);
  const purchaseAfter = snapshot.purchaseRequests.find(item => item.id === purchase.id);
  expect(purchaseAfter.status).toBe('Received');
  expect(purchaseAfter.orderedAt).toBeTruthy();
  expect(purchaseAfter.receivedAt).toBeTruthy();
  const purchaseReceipts = snapshot.inventoryTransactions.filter(transaction =>
    transaction.type === 'purchase_received' && transaction.reference === purchase.requestNumber);
  expect(purchaseReceipts).toHaveLength(1);

  const requirementReady = snapshot.materialRequirements.find(item => item.orderId === order.id);
  expect(requirementReady.status).toBe('Ready');
  expect(requirementReady.lines.every(line => line.reservedQty === line.requiredQty)).toBe(true);
  assertInventoryInvariants(snapshot);

  // 5. PRODUCTION START -> ONE-TIME MATERIAL CONSUMPTION
  await page.goto('/orders?open=' + encodeURIComponent(order.id));
  orderDrawer = page.getByRole('dialog', { name: order.orderNumber });
  await expect(orderDrawer.getByText('All BOM materials are reserved')).toBeVisible();
  await expect(orderDrawer.getByRole('button', { name: 'Create Production Job' })).toBeEnabled();
  await orderDrawer.getByRole('button', { name: 'Create Production Job' }).click();
  await page.getByRole('dialog', { name: 'Create Production Job' })
    .getByRole('button', { name: 'Create Job' }).click();
  await expect(page).toHaveURL(/\/production$/);

  snapshot = await state(page);
  const job = snapshot.productionJobs.find(item => item.orderId === order.id);
  expect(job).toBeTruthy();
  expect(snapshot.orders.find(item => item.id === order.id).status).toBe('Production');

  const consumedRequirement = snapshot.materialRequirements.find(item => item.orderId === order.id);
  expect(consumedRequirement.status).toBe('Consumed');
  expect(consumedRequirement.lines.every(line =>
    line.reservedQty === 0 && line.consumedQty === line.requiredQty)).toBe(true);

  const consumption = snapshot.inventoryTransactions.filter(transaction =>
    transaction.type === 'production_consumption' && transaction.reference === order.id);
  expect(consumption).toHaveLength(consumedRequirement.lines.length);
  for (const line of consumedRequirement.lines) {
    const entries = consumption.filter(transaction => transaction.materialId === line.materialId);
    expect(entries, line.materialId + ' must be consumed exactly once').toHaveLength(1);
    expect(entries[0].quantity).toBe(-line.requiredQty);
  }
  assertInventoryInvariants(snapshot);

  // 6. PRODUCTION -> QUALITY CHECK -> READY -> PRODUCTION COMPLETE
  await page.goto('/production?open=' + encodeURIComponent(job.id));
  const jobDrawer = page.getByRole('dialog', { name: job.jobNumber });

  await jobDrawer.getByRole('button', { name: 'Update production status' }).click();
  await page.getByRole('option', { name: 'In Production', exact: true }).click();
  await jobDrawer.getByRole('button', { name: 'Update production status' }).click();
  await page.getByRole('option', { name: 'Quality Check', exact: true }).click();

  snapshot = await state(page);
  expect(snapshot.orders.find(item => item.id === order.id).status).toBe('Quality Check');

  await jobDrawer.getByRole('button', { name: 'Update production status' }).click();
  await page.getByRole('option', { name: 'Ready', exact: true }).click();

  snapshot = await state(page);
  expect(snapshot.orders.find(item => item.id === order.id).status).toBe('Ready');

  await jobDrawer.getByRole('button', { name: 'Mark as Completed' }).click();
  snapshot = await state(page);
  expect(snapshot.productionJobs.find(item => item.id === job.id).status).toBe('Completed');
  expect(snapshot.orders.find(item => item.id === order.id).status).toBe('Ready');

  // 7. DISPATCH -> ORDER COMPLETION
  await page.goto('/orders?open=' + encodeURIComponent(order.id));
  orderDrawer = page.getByRole('dialog', { name: order.orderNumber });
  await orderDrawer.getByRole('button', { name: /Update Status.*Dispatched/ }).click();
  await page.getByRole('dialog', { name: new RegExp('Update ' + order.orderNumber) })
    .getByRole('button', { name: 'Confirm Update' }).click();

  await orderDrawer.getByRole('button', { name: /Update Status.*Completed/ }).click();
  await page.getByRole('dialog', { name: new RegExp('Update ' + order.orderNumber) })
    .getByRole('button', { name: 'Confirm Update' }).click();

  snapshot = await state(page);
  const finalOrder = snapshot.orders.find(item => item.id === order.id);
  expect(finalOrder.status).toBe('Completed');
  expect(finalOrder.statusHistory.some(change => change.to === 'Production')).toBe(true);
  expect(finalOrder.statusHistory.some(change => change.to === 'Quality Check')).toBe(true);
  expect(finalOrder.statusHistory.some(change => change.to === 'Ready')).toBe(true);
  expect(finalOrder.statusHistory.some(change => change.to === 'Dispatched')).toBe(true);
  expect(finalOrder.statusHistory.some(change => change.to === 'Completed')).toBe(true);

  const finalEnquiry = snapshot.enquiries.find(item => item.id === enquiry.id);
  const finalQuotation = snapshot.quotations.find(item => item.id === quotation.id);
  expect(finalEnquiry.status).toBe('Converted');
  expect(finalQuotation.status).toBe('Approved');
  expect(finalQuotation.orderId).toBe(order.id);
  expect(finalOrder.customerId).toBe(customer.id);
  assertInventoryInvariants(snapshot);

  // 8. REPORTS + PDF USE THE SAME COMPLETED LIVE STATE
  await page.goto('/reports');
  await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
  const ledger = page.getByRole('region', { name: 'Recent inventory transactions' });
  await expect(ledger).toContainText(order.orderNumber);
  await expect(ledger).toContainText(purchase.requestNumber);
  await expect(ledger).toContainText('Production Consumption');
  await expect(ledger).toContainText('Purchase Received');

  const pending = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Complete PDF' }).click();
  const pdf = await readPdf(await pending);
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.text).toContain('%%EOF');
  expect(pdf.pageCount).toBeGreaterThanOrEqual(6);
  expect(pdf.bytes.length).toBeGreaterThan(5000);

  // 9. PERSISTENCE + FINAL RELATIONAL INTEGRITY AFTER RELOAD
  await page.reload();
  const persisted = await state(page);
  expect(persisted.customers.find(item => item.id === customer.id)?.companyName).toBe(company);
  expect(persisted.enquiries.find(item => item.id === enquiry.id)?.status).toBe('Converted');
  expect(persisted.quotations.find(item => item.id === quotation.id)?.orderId).toBe(order.id);
  expect(persisted.orders.find(item => item.id === order.id)?.status).toBe('Completed');
  expect(persisted.productionJobs.find(item => item.id === job.id)?.status).toBe('Completed');
  expect(persisted.purchaseRequests.find(item => item.id === purchase.id)?.status).toBe('Received');
  expect(persisted.materialRequirements.find(item => item.orderId === order.id)?.status).toBe('Consumed');
  assertInventoryInvariants(persisted);
});

test('Part 10 critical routes stay crash-free and within the viewport at phone, tablet and desktop sizes', async ({ page }) => {
  test.setTimeout(100_000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));

  const routes = [
    'dashboard', 'customers', 'enquiries', 'quotations', 'orders',
    'bom', 'materials', 'inventory', 'purchases', 'production', 'reports',
  ];

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
    for (const route of routes) {
      await page.goto('/' + route);
      await expect(page.locator('main')).not.toBeEmpty();
      const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
      expect(overflow, route + ' at ' + width + 'px').toBeLessThan(4);
    }
  }

  expect(failures).toEqual([]);
});
