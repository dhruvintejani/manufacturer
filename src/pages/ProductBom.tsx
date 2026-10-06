import React, { useMemo, useState } from 'react';
import { ClipboardList, Edit2, Plus, Trash2, Layers3, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { BomItem } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { StatusBadge } from '../components/ui/StatusBadge';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const ProductBom: React.FC = () => {
  const { products, materials, materialRequirements, updateProductBom } = useAppStore();
  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [editing, setEditing] = useState(false);
  const selected = products.find(product => product.id === selectedId) || products[0];
  const [draft, setDraft] = useState<BomItem[]>(selected?.bom || []);

  const openEdit = () => {
    if (!selected) return;
    setDraft(selected.bom.map(item => ({ ...item })));
    setEditing(true);
  };

  const materialOptions = materials.filter(material => material.status === 'active')
    .map(material => ({ value: material.id, label: `${material.code} — ${material.name} (${material.unit})` }));

  const save = () => {
    if (!selected) return;
    if (!draft.length) {
      toast.error('A product BOM needs at least one material.');
      return;
    }
    if (draft.some(item => !item.materialId || item.quantity <= 0)) {
      toast.error('Every BOM line needs a material and quantity greater than zero.');
      return;
    }
    const ids = draft.map(item => item.materialId);
    if (new Set(ids).size !== ids.length) {
      toast.error('The same material cannot appear twice in one BOM.');
      return;
    }
    updateProductBom(selected.id, draft);
    setEditing(false);
    toast.success(`${selected.name} BOM saved and open order material requirements recalculated.`);
  };

  const requirementsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    materialRequirements.filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
      .forEach(requirement => map.set(requirement.productId, (map.get(requirement.productId) || 0) + 1));
    return map;
  }, [materialRequirements]);

  if (!selected) return <div className="page-shell"><PageHeader title="Product BOM" /><p className="text-sm text-slate-500">No products configured.</p></div>;

  return (
    <div className="page-shell">
      <PageHeader title="Product BOM" subtitle="Define the bill of materials used to calculate stock requirements for every sales order."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Product BOM' }]}
        actions={<button type="button" onClick={openEdit}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Edit2 className="h-4 w-4" /> Edit BOM
        </button>} />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Products</h2></div>
          <div className="max-h-[560px] overflow-y-auto p-2">
            {products.map(product => (
              <button key={product.id} type="button" onClick={() => setSelectedId(product.id)}
                className={`mb-1 flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${selected.id === product.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected.id === product.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Layers3 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{product.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{product.code} · BOM v{product.bomVersion}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{selected.code}</p>
              <h2 className="mt-1 break-words text-xl font-bold text-slate-900">{selected.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{selected.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.active ? 'active' : 'inactive'} />
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{selected.bom.length} materials</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">BOM Version</div><div className="mt-1 text-lg font-bold text-slate-900">v{selected.bomVersion}</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Material Lines</div><div className="mt-1 text-lg font-bold text-slate-900">{selected.bom.length}</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Open Orders Using BOM</div><div className="mt-1 text-lg font-bold text-slate-900">{requirementsByProduct.get(selected.id) || 0}</div></div>
          </div>

          <div className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardList className="h-4 w-4 text-blue-600" /> Bill of Materials per Product</h3>
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[640px] w-full">
                <thead className="bg-slate-50"><tr>{['Material', 'Code', 'Qty / Product', 'Unit', 'Current Stock', 'Minimum'].map(label => <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.bom.map(item => {
                    const material = materials.find(candidate => candidate.id === item.materialId);
                    return <tr key={item.materialId}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{material?.name || item.materialId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{material?.code || '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold tabular-nums text-blue-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{material?.unit || '—'}</td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{material?.currentStock ?? '—'}</td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material?.minimumStock ?? '—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
              <PackageCheck className="mr-2 inline h-4 w-4" />
              When this BOM changes, confirmed orders for <strong>{selected.name}</strong> that have not started production are recalculated automatically.
            </div>
          </div>
        </section>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit BOM — ${selected.name}`} subtitle="Quantities are required per one manufactured product." size="2xl"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save BOM & Recalculate</button>
        </div>}>
        <div className="space-y-3">
          {draft.map((item, index) => (
            <div key={index} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
              <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Material</label>
                <PremiumSelect label={`BOM material ${index + 1}`} value={item.materialId}
                  onChange={value => setDraft(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, materialId: value } : row))}
                  options={materialOptions} /></div>
              <label className="text-xs font-semibold text-slate-600">Qty / Product
                <input type="number" min={0.01} step={0.01} value={item.quantity}
                  onChange={event => setDraft(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))}
                  className={inputClass} /></label>
              <button type="button" onClick={() => setDraft(rows => rows.filter((_, rowIndex) => rowIndex !== index))}
                aria-label={`Remove BOM line ${index + 1}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 px-3 text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => {
            const unused = materials.find(material => material.status === 'active' && !draft.some(item => item.materialId === material.id));
            if (!unused) { toast.error('All active materials are already in this BOM.'); return; }
            setDraft(rows => [...rows, { materialId: unused.id, quantity: 1 }]);
          }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            <Plus className="h-4 w-4" /> Add Material Line
          </button>
        </div>
      </Modal>
    </div>
  );
};
