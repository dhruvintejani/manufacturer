import { BomItem, Product } from '../types';
import { useAppStore } from '../store/useAppStore';

export interface ProductMasterInput {
  code: string;
  name: string;
  description: string;
  active: boolean;
}

export interface ProductUsage {
  total: number;
  orders: number;
  enquiries: number;
  quotations: number;
  productionJobs: number;
  materialRequirements: number;
}

export type ProductActionResult =
  | { ok: true; product: Product }
  | { ok: false; reason: string };

export type BomActionResult =
  | { ok: true; product: Product; changed: boolean }
  | { ok: false; reason: string };

export const normalizeProductCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

export const getProductUsage = (product: Product): ProductUsage => {
  const state = useAppStore.getState();
  const orders = state.orders.filter(order => order.product === product.name).length;
  const enquiries = state.enquiries.filter(enquiry => enquiry.product === product.name).length;
  const quotations = state.quotations.filter(quotation =>
    quotation.items.some(item => item.product === product.name)).length;
  const productionJobs = state.productionJobs.filter(job => job.product === product.name).length;
  const materialRequirements = state.materialRequirements.filter(requirement =>
    requirement.productId === product.id).length;
  return {
    total: orders + enquiries + quotations + productionJobs + materialRequirements,
    orders,
    enquiries,
    quotations,
    productionJobs,
    materialRequirements,
  };
};

export const createProductMaster = (input: ProductMasterInput): ProductActionResult => {
  const state = useAppStore.getState();
  const code = normalizeProductCode(input.code);
  const name = input.name.trim();
  const description = input.description.trim();
  if (!code || !name) return { ok: false, reason: 'Product code and product name are required.' };
  if (state.products.some(product => product.code.toUpperCase() === code)) {
    return { ok: false, reason: 'Product code ' + code + ' already exists.' };
  }
  if (state.products.some(product => product.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: 'A product named ' + name + ' already exists.' };
  }

  const maxNum = state.products.reduce((max, product) => {
    const match = product.id.match(/PRD-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const product: Product = {
    id: 'PRD-' + String(maxNum + 1).padStart(3, '0'),
    code,
    name,
    description,
    bomVersion: '1.0',
    bom: [],
    active: input.active,
  };
  useAppStore.setState(current => ({ products: [...current.products, product] }));
  useAppStore.getState().addActivity({
    type: 'product',
    title: 'Product created',
    description: product.name + ' added to Product Master',
    relatedId: product.id,
  });
  return { ok: true, product };
};

export const updateProductMaster = (
  productId: string,
  input: ProductMasterInput,
): ProductActionResult => {
  const state = useAppStore.getState();
  const existing = state.products.find(product => product.id === productId);
  if (!existing) return { ok: false, reason: 'Product record no longer exists.' };

  const code = normalizeProductCode(input.code);
  const name = input.name.trim();
  const description = input.description.trim();
  if (!code || !name) return { ok: false, reason: 'Product code and product name are required.' };
  if (state.products.some(product => product.id !== productId && product.code.toUpperCase() === code)) {
    return { ok: false, reason: 'Product code ' + code + ' already exists.' };
  }
  if (state.products.some(product =>
    product.id !== productId && product.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: 'A product named ' + name + ' already exists.' };
  }

  if (name !== existing.name && getProductUsage(existing).total > 0) {
    return {
      ok: false,
      reason: 'Product name cannot be changed after the product is used in enquiries, orders, production or material requirements.',
    };
  }

  const updated: Product = { ...existing, code, name, description, active: input.active };
  useAppStore.setState(current => ({
    products: current.products.map(product => product.id === productId ? updated : product),
  }));
  useAppStore.getState().addActivity({
    type: 'product',
    title: 'Product updated',
    description: updated.name + ' Product Master details updated',
    relatedId: updated.id,
  });
  return { ok: true, product: updated };
};

export const deleteProductMaster = (productId: string): ProductActionResult => {
  const state = useAppStore.getState();
  const product = state.products.find(item => item.id === productId);
  if (!product) return { ok: false, reason: 'Product record no longer exists.' };
  if (getProductUsage(product).total > 0) {
    return { ok: false, reason: 'This product is linked to business records and cannot be deleted.' };
  }
  useAppStore.setState(current => ({
    products: current.products.filter(item => item.id !== productId),
  }));
  useAppStore.getState().addActivity({
    type: 'product',
    title: 'Product deleted',
    description: product.name + ' removed from Product Master',
    relatedId: product.id,
  });
  return { ok: true, product };
};

export const saveProductBom = (productId: string, items: BomItem[]): BomActionResult => {
  const state = useAppStore.getState();
  const product = state.products.find(item => item.id === productId);
  if (!product) return { ok: false, reason: 'Product record no longer exists.' };
  if (items.length === 0) return { ok: false, reason: 'A manufactured product needs at least one BOM material.' };

  const normalized = items.map(item => ({
    materialId: item.materialId,
    quantity: Number(item.quantity),
  }));
  if (normalized.some(item => !item.materialId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    return { ok: false, reason: 'Every BOM line needs a material and quantity greater than zero.' };
  }
  if (new Set(normalized.map(item => item.materialId)).size !== normalized.length) {
    return { ok: false, reason: 'The same material cannot appear twice in one BOM.' };
  }
  const inactive = normalized.find(item =>
    !state.materials.some(material => material.id === item.materialId && material.status === 'active'));
  if (inactive) return { ok: false, reason: 'BOM materials must exist and be active in Material Master.' };

  const changed = product.bom.length !== normalized.length ||
    product.bom.some((item, index) =>
      item.materialId !== normalized[index].materialId || item.quantity !== normalized[index].quantity);
  if (!changed) return { ok: true, product, changed: false };

  state.updateProductBom(productId, normalized);
  const updated = useAppStore.getState().products.find(item => item.id === productId);
  if (!updated) return { ok: false, reason: 'BOM could not be saved.' };
  return { ok: true, product: updated, changed: true };
};
