import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList, Edit2, Plus, Trash2, Layers3, PackageCheck,
  PackagePlus, Save, Search, ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { BomItem, Product } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  createProductMaster, deleteProductMaster, getProductUsage,
  normalizeProductCode, saveProductBom, updateProductMaster,
} from '../utils/productMaster';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

type ProductForm = {
  code: string;
  name: string;
  description: string;
  active: boolean;
};

const emptyProductForm: ProductForm = {
  code: '',
  name: '',
  description: '',
  active: true,
};

export const ProductBom: React.FC = () => {
  const location = useLocation();
  const {
    products, materials, materialRequirements,
    orders, enquiries, quotations, productionJobs,
  } = useAppStore();

  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [search, setSearch] = useState('');
  const [editingBom, setEditingBom] = useState(false);
  const [draft, setDraft] = useState<BomItem[]>(products[0]?.bom || []);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('open');
    if (!openId) return;
    if (products.some(product => product.id === openId)) setSelectedId(openId);
  }, [location.search, products]);

  const selected = products.find(product => product.id === selectedId) || products[0];

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(product =>
      [product.name, product.code, product.description]
        .some(value => value.toLowerCase().includes(term)));
  }, [products, search]);

  const usage = selected ? getProductUsage(selected) : {
    total: 0, orders: 0, enquiries: 0, quotations: 0, productionJobs: 0, materialRequirements: 0,
  };

  const requirementsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    materialRequirements
      .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
      .forEach(requirement => map.set(requirement.productId, (map.get(requirement.productId) || 0) + 1));
    return map;
  }, [materialRequirements]);

  const activeMaterialOptions = materials
    .filter(material => material.status === 'active')
    .map(material => ({
      value: material.id,
      label: material.code + ' — ' + material.name + ' (' + material.unit + ')',
    }));

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductModalOpen(true);
  };

  const openEditProduct = () => {
    if (!selected) return;
    setEditingProduct(selected);
    setProductForm({
      code: selected.code,
      name: selected.name,
      description: selected.description,
      active: selected.active,
    });
    setProductModalOpen(true);
  };

  const saveProduct = () => {
    const code = normalizeProductCode(productForm.code);
    if (!code || !productForm.name.trim()) {
      toast.error('Product code and product name are required.');
      return;
    }
    const result = editingProduct
      ? updateProductMaster(editingProduct.id, { ...productForm, code })
      : createProductMaster({ ...productForm, code });

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    setSelectedId(result.product.id);
    setProductModalOpen(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    toast.success(editingProduct
      ? 'Product Master updated.'
      : 'Product created. Configure its BOM before using it for new manufacturing orders.');
  };

  const confirmDelete = () => {
    if (!editingProduct) return;
    const result = deleteProductMaster(editingProduct.id);
    if (!result.ok) {
      toast.error(result.reason);
      setDeleteOpen(false);
      return;
    }
    const next = products.find(product => product.id !== editingProduct.id);
    setSelectedId(next?.id || '');
    setDeleteOpen(false);
    setProductModalOpen(false);
    setEditingProduct(null);
    toast.success('Product deleted.');
  };

  const openEditBom = () => {
    if (!selected) return;
    setDraft(selected.bom.map(item => ({ ...item })));
    setEditingBom(true);
  };

  const saveBom = () => {
    if (!selected) return;
    const result = saveProductBom(selected.id, draft);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setEditingBom(false);
    toast.success(result.changed
      ? selected.name + ' BOM saved as v' + result.product.bomVersion + '. Open order requirements were recalculated.'
      : 'BOM already matches the saved version. No new version was created.');
  };

  const linkedBusinessRecords = selected
    ? orders.filter(order => order.product === selected.name).length +
      enquiries.filter(enquiry => enquiry.product === selected.name).length +
      quotations.filter(quotation => quotation.items.some(item => item.product === selected.name)).length +
      productionJobs.filter(job => job.product === selected.name).length
    : 0;

  if (!selected) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Product BOM"
          subtitle="Create manufactured products and define the materials required for each one."
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Product BOM' }]}
          actions={<button type="button" onClick={openAddProduct}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <PackagePlus className="h-4 w-4" /> Add Product
          </button>}
        />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-900">No products configured</h2>
          <p className="mt-1 text-sm text-slate-500">Add the first manufactured product, then configure its BOM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Product BOM"
        subtitle="Manage manufactured products and versioned bills of materials used for automatic material requirement calculations."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Product BOM' }]}
        actions={<>
          <button type="button" onClick={openAddProduct}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            <PackagePlus className="h-4 w-4" /> Add Product
          </button>
          <button type="button" onClick={openEditProduct}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Edit2 className="h-4 w-4" /> Edit Product
          </button>
          <button type="button" onClick={openEditBom}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <ClipboardList className="h-4 w-4" /> Edit BOM
          </button>
        </>}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-3">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Product Master</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search products"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                type="button"
                aria-label={'Open product ' + product.name}
                onClick={() => setSelectedId(product.id)}
                className={'mb-1 flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ' +
                  (selected.id === product.id ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50')}
              >
                <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
                  (selected.id === product.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>
                  <Layers3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{product.name}</div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>{product.code}</span>
                    <span>·</span>
                    <span>BOM v{product.bomVersion}</span>
                    {!product.active && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">Inactive</span>}
                  </div>
                </div>
              </button>
            ))}
            {!filteredProducts.length && <p className="p-5 text-center text-sm text-slate-500">No products match your search.</p>}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{selected.code}</p>
              <h2 className="mt-1 break-words text-xl font-bold text-slate-900">{selected.name}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{selected.description || 'No product description yet.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.active ? 'active' : 'inactive'} />
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {selected.bom.length} BOM material{selected.bom.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4 sm:p-5">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">BOM Version</div>
              <div className="mt-1 text-lg font-bold text-slate-900">v{selected.bomVersion}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Material Lines</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{selected.bom.length}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Open BOM Orders</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{requirementsByProduct.get(selected.id) || 0}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Business Records</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{usage.total}</div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ClipboardList className="h-4 w-4 text-blue-600" /> Bill of Materials per Product
              </h3>
              <button type="button" onClick={openEditBom}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <Edit2 className="h-3.5 w-3.5" /> {selected.bom.length ? 'Manage BOM' : 'Configure BOM'}
              </button>
            </div>

            {selected.bom.length ? (
              <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[700px] w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Material', 'Code', 'Qty / Product', 'Unit', 'Current Stock', 'Minimum', 'Material Status'].map(label =>
                        <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.bom.map(item => {
                      const material = materials.find(candidate => candidate.id === item.materialId);
                      return (
                        <tr key={item.materialId}>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{material?.name || item.materialId}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{material?.code || '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold tabular-nums text-blue-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{material?.unit || '—'}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{material?.currentStock ?? '—'}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material?.minimumStock ?? '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={material?.status || 'inactive'} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-6 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
                <h4 className="mt-2 text-sm font-bold text-amber-900">BOM not configured</h4>
                <p className="mt-1 text-sm text-amber-800">This product should not be used for manufacturing until its material quantities are defined.</p>
                <button type="button" onClick={openEditBom}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                  <Plus className="h-4 w-4" /> Configure BOM
                </button>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
              <PackageCheck className="mr-2 inline h-4 w-4" />
              Saving a changed BOM creates the next BOM version and recalculates material requirements for open orders using <strong>{selected.name}</strong>.
            </div>

            {linkedBusinessRecords > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Product name is locked because {linkedBusinessRecords} business record{linkedBusinessRecords === 1 ? '' : 's'} already use this product. Code, description and active status can still be edited safely.
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setEditingProduct(null); }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        subtitle={editingProduct ? 'Update Product Master details without breaking linked business records.' : 'Create a manufactured product. Configure its BOM after saving.'}
        size="lg"
        footer={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div>
            {editingProduct && (
              <button
                type="button"
                disabled={getProductUsage(editingProduct).total > 0}
                title={getProductUsage(editingProduct).total > 0 ? 'Linked products cannot be deleted' : 'Delete unused product'}
                onClick={() => setDeleteOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" /> Delete Product
              </button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setProductModalOpen(false); setEditingProduct(null); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={saveProduct}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Save className="h-4 w-4" /> {editingProduct ? 'Save Product' : 'Add Product'}
            </button>
          </div>
        </div>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Product Code
            <input
              value={productForm.code}
              onChange={event => setProductForm(form => ({ ...form, code: event.target.value.toUpperCase() }))}
              autoCapitalize="characters"
              spellCheck={false}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Product Name
            <input
              value={productForm.name}
              disabled={!!editingProduct && getProductUsage(editingProduct).total > 0}
              onChange={event => setProductForm(form => ({ ...form, name: event.target.value }))}
              className={inputClass + ' disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Description
            <textarea
              rows={3}
              value={productForm.description}
              onChange={event => setProductForm(form => ({ ...form, description: event.target.value }))}
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Product Status</label>
            <PremiumSelect
              label="Product status"
              value={productForm.active ? 'active' : 'inactive'}
              onChange={value => setProductForm(form => ({ ...form, active: value === 'active' }))}
              options={[
                { value: 'active', label: 'Active — available for new orders' },
                { value: 'inactive', label: 'Inactive — hidden from new order selection' },
              ]}
            />
          </div>
          {editingProduct && getProductUsage(editingProduct).total > 0 && (
            <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              This product is already linked to operational records, so its name and deletion are locked to protect historical data.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={editingBom}
        onClose={() => setEditingBom(false)}
        title={'Edit BOM — ' + selected.name}
        subtitle="Quantities are required for one manufactured product. Only active Material Master records can be saved."
        size="2xl"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditingBom(false)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={saveBom}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save BOM & Recalculate</button>
        </div>}
      >
        <div className="space-y-3">
          {draft.map((item, index) => {
            const currentMaterial = materials.find(material => material.id === item.materialId);
            const options = currentMaterial && currentMaterial.status !== 'active'
              ? [{ value: currentMaterial.id, label: currentMaterial.code + ' — ' + currentMaterial.name + ' (inactive)' }, ...activeMaterialOptions]
              : activeMaterialOptions;
            return (
              <div key={index} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Material</label>
                  <PremiumSelect
                    label={'BOM material ' + (index + 1)}
                    value={item.materialId}
                    onChange={value => setDraft(rows => rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, materialId: value } : row))}
                    options={options}
                  />
                </div>
                <label className="text-xs font-semibold text-slate-600">
                  Qty / Product
                  <input
                    aria-label="Qty / Product"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={item.quantity}
                    onChange={event => setDraft(rows => rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))}
                    className={inputClass}
                  />
                </label>
                <button type="button"
                  onClick={() => setDraft(rows => rows.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label={'Remove BOM line ' + (index + 1)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 px-3 text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button type="button" onClick={() => {
            const unused = materials.find(material =>
              material.status === 'active' && !draft.some(item => item.materialId === material.id));
            if (!unused) {
              toast.error('All active materials are already in this BOM.');
              return;
            }
            setDraft(rows => [...rows, { materialId: unused.id, quantity: 1 }]);
          }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            <Plus className="h-4 w-4" /> Add Material Line
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Product"
        description={'Delete ' + (editingProduct?.name || 'this product') + ' from Product Master? This is allowed only when no business records reference it.'}
        confirmLabel="Delete Product"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};
