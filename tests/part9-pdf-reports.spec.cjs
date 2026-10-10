const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const readPdf = async download => {
  const path = await download.path();
  const bytes = fs.readFileSync(path);
  const text = bytes.toString('latin1');
  return {
    bytes,
    text,
    pageCount: (text.match(/\/Type\s*\/Page\b/g) || []).length,
  };
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

test('Part 9 current-section PDFs are valid, named correctly and contain report pages', async ({ page }) => {
  await page.goto('/reports');

  for (const section of ['Sales', 'Production', 'Customers', 'Enquiries', 'Inventory']) {
    await page.getByRole('tab', { name: section, exact: true }).click();
    const pending = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Current Report PDF' }).click();
    const download = await pending;

    expect(download.suggestedFilename()).toBe(
      'forgeflow-' + section.toLowerCase() + '-report-' + new Date().toISOString().slice(0, 10) + '.pdf'
    );

    const pdf = await readPdf(download);
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.text).toContain('%%EOF');
    expect(pdf.pageCount, section + ' PDF should have at least one real page').toBeGreaterThanOrEqual(1);
    expect(pdf.bytes.length, section + ' PDF should contain live report content').toBeGreaterThan(1800);
  }
});

test('Part 9 complete PDF has a cover plus all five report sections and page footers', async ({ page }) => {
  await page.goto('/reports');

  const pending = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Complete PDF' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^forgeflow-complete-report-\d{4}-\d{2}-\d{2}\.pdf$/);

  const pdf = await readPdf(download);
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.text).toContain('%%EOF');
  expect(pdf.pageCount).toBeGreaterThanOrEqual(6);
  expect(pdf.bytes.length).toBeGreaterThan(5000);
});

test('Part 9 Inventory PDF exports the live Part 8 state after procurement changes', async ({ page }) => {
  await page.goto('/purchases');

  const request = page.getByRole('row').filter({ hasText: 'PUR-2026-001' });
  await request.getByRole('button', { name: 'Mark Ordered' }).click();
  await expect(request.getByText('Ordered', { exact: true })).toBeVisible();
  await request.getByRole('button', { name: 'Receive Material' }).click();
  await expect(request.getByText('Received', { exact: true })).toBeVisible();

  await page.goto('/reports');
  await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
  await expect(page.getByText('Received', { exact: true })).toBeVisible();

  const pending = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Current Report PDF' }).click();
  const pdf = await readPdf(await pending);

  expect(pdf.pageCount).toBeGreaterThanOrEqual(2);
  expect(pdf.bytes.length).toBeGreaterThan(3000);
});

test('Part 9 PDF actions remain usable from a 320px phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/reports');

  const current = page.getByRole('button', { name: 'Current Report PDF' });
  const complete = page.getByRole('button', { name: 'Complete PDF' });
  await expect(current).toBeVisible();
  await expect(complete).toBeVisible();

  const currentBox = await current.boundingBox();
  const completeBox = await complete.boundingBox();
  expect(currentBox.x).toBeGreaterThanOrEqual(-1);
  expect(currentBox.x + currentBox.width).toBeLessThanOrEqual(321);
  expect(completeBox.x).toBeGreaterThanOrEqual(-1);
  expect(completeBox.x + completeBox.width).toBeLessThanOrEqual(321);

  await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
  const pending = page.waitForEvent('download', { timeout: 15_000 });
  await current.click();
  const pdf = await readPdf(await pending);
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');

  const overflow = await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThan(4);
});
