import React, { useMemo, useState } from 'react';
import { Boxes, Plus, AlertTriangle, CheckCircle2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Material, MaterialUnit } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { materialStockStatus } from '../utils/inventory';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const units: MaterialUnit[] = ['kg', 'meter', 'piece', 'litre'];

const emptyForm = {
  code: '', name: '', category: '', unit: 'kg' as MaterialUnit, currentStock: 0,
  minimumStock: 0, reorderLevel: 0, supplier: '', status: 'active' as 'active' | 'inactive',
};

export const Materials: React.FC = () => {
  const { materials, addMaterial, updateMaterial } = useAppStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Material | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => materials.filter(material => {
    const term = search.trim().toLowerCase();
    return !term || [material.name, material.code, material.category, material.supplier]
      .some(value => value.toLowerCase().includes(term));
  }), [materials, search]);

  const lowStock = materials.filter(material => material.currentStock < material.minimumStock).length;
  const healthy = materials.filter(material => materialStockStatus(material) === 'Healthy').length;

  const openEdit = (material: Material) => {
    setEditing(material);
    setForm({
      code: material.code, name: material.name, category: material.category, unit: material.unit,
      currentStock: material.currentStock, minimumStock: material.minimumStock,
      reorderLevel: material.reorderLevel, supplier: material.supplier, status: material.status,
    });
  };

  const close = () => { setAdding(false); setEditing(null); setForm(emptyForm); };
  const save = () => {
    const normalizedCode = form.code.trim().toUpperCase();
    if (!normalizedCode || !form.name.trim() || !form.category.trim() || !form.supplier.trim()) {
      toast.error('Complete the material code, name, category and supplier.');
      return;
    }
    if (form.minimumStock < 0 || form.reorderLevel < 0 || form.currentStock < 0) {
      toast.error('Stock values cannot be negative.');
      return;
    }
    if (form.reorderLevel < form.minimumStock) {
      toast.error('Reorder level must be equal to or greater than the minimum stock level.');
      return;
    }
    const duplicate = materials.some(material =>
      material.id !== editing?.id && material.code.trim().toUpperCase() === normalizedCode);
    if (duplicate) {
      toast.error(`Material code ${normalizedCode} already exists.`);
      return;
    }
    if (editing) {
      const updated = updateMaterial(editing.id, {
        code: normalizedCode, name: form.name.trim(), category: form.category.trim(), unit: form.unit,
        minimumStock: form.minimumStock, reorderLevel: form.reorderLevel,
        supplier: form.supplier.trim(), status: form.status,
      });
      if (!updated) {
        toast.error('Material could not be updated. Check the code and stock thresholds.');
        return;
      }
      toast.success('Material master updated. Use Inventory for stock adjustments.');
    } else {
      const created = addMaterial({ ...form, code: normalizedCode, name: form.name.trim(), category: form.category.trim(), supplier: form.supplier.trim() });
      if (!created) {
        toast.error('Material could not be created. Check the code and stock thresholds.');
        return;
      }
      toast.success('Material added to inventory.');
    }
    close();
  };

  return (
    <div className="page-shell">
      <PageHeader title="Materials" subtitle="Maintain raw materials, stock thresholds and preferred suppliers."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Materials' }]}
        actions={<button type="button" onClick={() => { setAdding(true); setForm(emptyForm); }}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Material
        </button>} />

      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
        {[
          ['Total Materials', materials.length, <Boxes className="h-5 w-5 text-blue-600" />],
          ['Low Stock', lowStock, <AlertTriangle className="h-5 w-5 text-rose-600" />],
          ['Healthy', healthy, <CheckCircle2 className="h-5 w-5 text-emerald-600" />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-500">{label}</span>{icon}</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search materials, code, category or supplier..." className="w-full max-w-md" />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[920px] w-full">
            <thead className="bg-slate-50"><tr>
              {['Code', 'Material', 'Category', 'Unit', 'Stock', 'Minimum', 'Reorder', 'Supplier', 'Status', ''].map(label =>
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(material => {
                const stockStatus = materialStockStatus(material);
                return <tr key={material.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{material.code}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{material.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{material.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{material.unit}</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-slate-900">{material.currentStock}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.minimumStock}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.reorderLevel}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{material.supplier}</td>
                  <td className="px-4 py-3"><StatusBadge status={stockStatus} /></td>
                  <td className="px-4 py-3"><button type="button" onClick={() => openEdit(material)} aria-label={'Edit ' + material.name}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700"><Edit2 className="h-4 w-4" /></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No materials match your search.</p>}
      </section>

      <Modal open={adding || !!editing} onClose={close} title={editing ? 'Edit Material' : 'Add Material'}
        subtitle={editing ? 'Stock quantity is adjusted from Inventory so every change is recorded.' : 'Create a material master record with opening stock.'}
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{editing ? 'Save Material' : 'Add Material'}</button>
        </div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Material Code<input value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value.toUpperCase() }))} autoCapitalize="characters" spellCheck={false} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700">Material Name<input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700">Category<input value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} className={inputClass} /></label>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Unit</label>
            <PremiumSelect label="Material unit" value={form.unit} onChange={value => setForm(v => ({ ...v, unit: value as MaterialUnit }))}
              options={units.map(unit => ({ value: unit, label: unit }))} /></div>
          {!editing && <label className="text-sm font-medium text-slate-700">Opening Stock<input type="number" min={0} value={form.currentStock} onChange={e => setForm(v => ({ ...v, currentStock: Number(e.target.value) }))} className={inputClass} /></label>}
          <label className="text-sm font-medium text-slate-700">Minimum Stock<input type="number" min={0} value={form.minimumStock} onChange={e => setForm(v => ({ ...v, minimumStock: Number(e.target.value) }))} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700">Reorder Level<input type="number" min={form.minimumStock} value={form.reorderLevel} onChange={e => setForm(v => ({ ...v, reorderLevel: Number(e.target.value) }))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Must be at least the minimum stock level.</span></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Supplier<input value={form.supplier} onChange={e => setForm(v => ({ ...v, supplier: e.target.value }))} className={inputClass} /></label>
          {editing && <div className="sm:col-span-2"><PremiumSelect label="Material status" value={form.status}
            onChange={value => setForm(v => ({ ...v, status: value as 'active' | 'inactive' }))}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div>}
        </div>
      </Modal>
    </div>
  );
};
