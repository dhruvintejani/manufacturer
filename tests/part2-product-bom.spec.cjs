const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('forgeflow-storage'));
});

const savedState = page => page.evaluate(() => {
  const raw = localStorage.getItem('forgeflow-storage');
  return raw ? JSON.parse(raw).state : null;
});

test('Part 2 creates a Product Master record, configures BOM and versions only real changes', async ({ page }) => {
  await page.goto('/bom');
  await page.getByRole('button', { name: 'Add Product' }).click();
  const productModal = page.getByRole('dialog', { name: 'Add Product' });
  await productModal.getByLabel('Product Code').fill('filter skid');
  await productModal.getByLabel('Product Name').fill('Filter Skid');
  await productModal.getByLabel('Description').fill('Skid-mounted industrial filtration package');
  await productModal.getByRole('button', { name: 'Add Product' }).click();

  await expect(page.getByRole('heading', { name: 'Filter Skid', exact: true })).toBeVisible();
  await expect(page.getByText('FILTER-SKID', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('BOM not configured')).toBeVisible();

  await page.getByRole('button', { name: 'Edit BOM', exact: true }).first().click();
  let bom = page.getByRole('dialog', { name: 'Edit BOM — Filter Skid' });
  await bom.getByRole('button', { name: 'Add Material Line' }).click();
  await bom.getByLabel('Qty / Product', { exact: true }).first().fill('12.5');
  await bom.getByRole('button', { name: 'Add Material Line' }).click();
  await bom.getByLabel('Qty / Product', { exact: true }).nth(1).fill('2');
  await bom.getByRole('button', { name: 'Save BOM & Recalculate' }).click();

  await expect(page.getByText('v1.1', { exact: true }).first()).toBeVisible();
  let state = await savedState(page);
  let product = state.products.find(item => item.name === 'Filter Skid');
  expect(product).toBeTruthy();
  expect(product.code).toBe('FILTER-SKID');
  expect(product.bomVersion).toBe('1.1');
  expect(product.bom).toEqual([
    { materialId: 'MAT-001', quantity: 12.5 },
    { materialId: 'MAT-002', quantity: 2 },
  ]);

  await page.getByRole('button', { name: 'Edit BOM', exact: true }).first().click();
  bom = page.getByRole('dialog', { name: 'Edit BOM — Filter Skid' });
  await bom.getByRole('button', { name: 'Save BOM & Recalculate' }).click();
  await expect(page.getByText('BOM already matches the saved version')).toBeVisible();
  state = await savedState(page);
  product = state.products.find(item => item.name === 'Filter Skid');
  expect(product.bomVersion).toBe('1.1');

  await page.reload();
  await page.getByLabel('Search products').fill('Filter Skid');
  await page.getByRole('button', { name: 'Open product Filter Skid' }).click();
  await expect(page.getByText('v1.1', { exact: true }).first()).toBeVisible();
});

test('Part 2 prevents duplicate products, supports safe edits, inactivity and deletion of unused products', async ({ page }) => {
  await page.goto('/bom');
  await page.getByRole('button', { name: 'Add Product' }).click();
  let modal = page.getByRole('dialog', { name: 'Add Product' });
  await modal.getByLabel('Product Code').fill('mix-01');
  await modal.getByLabel('Product Name').fill('Mixer Skid');
  await modal.getByLabel('Description').fill('Custom mixing skid');
  await modal.getByRole('button', { name: 'Add Product' }).click();
  await expect(modal).toBeHidden();

  await page.getByRole('button', { name: 'Add Product' }).click();
  modal = page.getByRole('dialog', { name: 'Add Product' });
  await modal.getByLabel('Product Code').fill('MIX-01');
  await modal.getByLabel('Product Name').fill('Another Mixer');
  await modal.getByRole('button', { name: 'Add Product' }).click();
  await expect(page.getByText('Product code MIX-01 already exists.')).toBeVisible();
  await modal.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Edit Product' }).click();
  modal = page.getByRole('dialog', { name: 'Edit Product' });
  await modal.getByLabel('Description').fill('Updated mixer skid description');
  await modal.getByRole('button', { name: 'Product status' }).click();
  await page.getByRole('option', { name: 'Inactive — hidden from new order selection' }).click();
  await modal.getByRole('button', { name: 'Save Product' }).click();
  await expect(page.getByText('inactive', { exact: true }).first()).toBeVisible();

  let state = await savedState(page);
  let product = state.products.find(item => item.name === 'Mixer Skid');
  expect(product.active).toBe(false);
  expect(product.description).toBe('Updated mixer skid description');

  await page.goto('/orders');
  await page.getByRole('button', { name: 'New Order', exact: true }).first().click();
  const orderModal = page.getByRole('dialog', { name: 'New Order' });
  await orderModal.getByRole('button', { name: 'Product', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Mixer Skid', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await orderModal.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/bom');
  await page.getByLabel('Search products').fill('Mixer Skid');
  await page.getByRole('button', { name: 'Open product Mixer Skid' }).click();
  await page.getByRole('button', { name: 'Edit Product' }).click();
  modal = page.getByRole('dialog', { name: 'Edit Product' });
  await modal.getByRole('button', { name: 'Delete Product' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete Product' });
  await confirm.getByRole('button', { name: 'Delete Product' }).click();
  await expect(page.getByRole('heading', { name: 'Mixer Skid', exact: true })).toHaveCount(0);

  state = await savedState(page);
  expect(state.products.some(item => item.name === 'Mixer Skid')).toBe(false);
});

test('Part 2 locks identity of linked products but still allows safe Product Master edits', async ({ page }) => {
  await page.goto('/bom');
  await page.getByRole('button', { name: 'Edit Product' }).click();
  const modal = page.getByRole('dialog', { name: 'Edit Product' });
  await expect(modal.getByLabel('Product Name')).toBeDisabled();
  await expect(modal.getByRole('button', { name: 'Delete Product' })).toBeDisabled();
  await expect(modal.getByText(/already linked to operational records/)).toBeVisible();

  await modal.getByLabel('Description').fill('Updated reactor master description');
  await modal.getByRole('button', { name: 'Save Product' }).click();

  const state = await savedState(page);
  const reactor = state.products.find(item => item.name === 'Reactor');
  expect(reactor.description).toBe('Updated reactor master description');
});

test('Part 2 BOM updates recalculate linked open-order material requirements and no-op saves do not bump version', async ({ page }) => {
  await page.goto('/bom');
  await page.getByRole('button', { name: 'Open product Heat Exchanger' }).click();

  await page.getByRole('button', { name: 'Edit BOM', exact: true }).click();
  let bom = page.getByRole('dialog', { name: 'Edit BOM — Heat Exchanger' });
  await expect(bom.getByLabel('Qty / Product', { exact: true }).first()).toHaveValue('85');
  await bom.getByLabel('Qty / Product', { exact: true }).first().fill('90');
  await bom.getByRole('button', { name: 'Save BOM & Recalculate' }).click();

  let state = await savedState(page);
  let product = state.products.find(item => item.name === 'Heat Exchanger');
  let requirement = state.materialRequirements.find(item => item.orderId === 'ORD-2026-0055');
  expect(product.bomVersion).toBe('1.1');
  expect(requirement.lines.find(line => line.materialId === 'MAT-002').requiredQty).toBe(180);

  await page.getByRole('button', { name: 'Edit BOM', exact: true }).first().click();
  bom = page.getByRole('dialog', { name: 'Edit BOM — Heat Exchanger' });
  await bom.getByRole('button', { name: 'Save BOM & Recalculate' }).click();
  state = await savedState(page);
  product = state.products.find(item => item.name === 'Heat Exchanger');
  expect(product.bomVersion).toBe('1.1');
});

test('Part 2 Product Master and BOM remain usable at phone and tablet widths', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/bom');
    await expect(page.getByRole('heading', { name: 'Product BOM' })).toBeVisible();
    expect(await page.locator('main').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(4);

    await page.getByRole('button', { name: 'Add Product' }).click();
    const modal = page.getByRole('dialog', { name: 'Add Product' });
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await modal.getByRole('button', { name: 'Cancel' }).click();
  }
});
