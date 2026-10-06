import React, { useMemo, useState } from 'react';
import { ShoppingBag, Plus, Truck, PackageCheck, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { requirementShortages } from '../utils/inventory';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const Purchases: React.FC = () => {
  const {
    purchaseRequests, materials, orders, materialRequirements,
    createPurchaseRequest, setPurchaseRequestStatus, receivePurchaseRequest,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ materialId: materials[0]?.id || '', orderId: '', supplier: materials[0]?.supplier || '', quantity: 1, note: '' });

  const stats = {
    requested: purchaseRequests.filter(request => request.status === 'Requested').length,
    ordered: purchaseRequests.filter(request => request.status === 'Ordered').length,
    received: purchaseRequests.filter(request => request.status === 'Received').length,
    open: purchaseRequests.filter(request => !['Received', 'Cancelled'].includes(request.status)).length,
  };

  const shortageRows = useMemo(() => materialRequirements
    .filter(requirement => requirement.status === 'Shortage')
    .flatMap(requirement => requirementShortages(requirement).map(line => ({
      requirement, line,
      material: materials.find(material => material.id === line.materialId),
      order: orders.find(order => order.id === requirement.orderId),
    }))), [materialRequirements, materials, orders]);

  const create = () => {
    const material = materials.find(item => item.id === form.materialId);
    if (!material || form.quantity <= 0) { toast.error('Select a material and quantity greater than zero.'); return; }
    const request = createPurchaseRequest({
      materialId: material.id,
      orderId: form.orderId || undefined,
      supplier: form.supplier.trim() || material.supplier,
      quantity: form.quantity,
      note: form.note.trim() || undefined,
    });
    toast.success(`${request.requestNumber} created.`);
    setOpen(false);
    setForm({ materialId: material.id, orderId: '', supplier: material.supplier, quantity: 1, note: '' });
  };

  const openShortage = (materialId: string, orderId: string, shortageQty: number) => {
    const material = materials.find(item => item.id === materialId);
    if (!material) return;
    const recommended = Math.max(shortageQty, material.reorderLevel - material.currentStock, 1);
    setForm({
      materialId,
      orderId,
      supplier: material.supplier,
      quantity: Math.ceil(recommended * 100) / 100,
      note: `Material shortage for ${orderId}`,
    });
    setOpen(true);
  };

  return (
    <div className="page-shell">
      <PageHeader title="Purchase / Restock" subtitle="Resolve material shortages, track supplier requests and receive stock into inventory."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Purchase / Restock' }]}
        actions={<button type="button" onClick={() => setOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Restock Request
        </button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Open Requests', stats.open, <ShoppingBag className="h-5 w-5 text-blue-600" />],
          ['Requested', stats.requested, <AlertTriangle className="h-5 w-5 text-amber-600" />],
          ['Ordered', stats.ordered, <Truck className="h-5 w-5 text-violet-600" />],
          ['Received', stats.received, <PackageCheck className="h-5 w-5 text-emerald-600" />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-500">{label}</span>{icon}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {shortageRows.length > 0 && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-3 flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" /><div><h2 className="text-sm font-bold text-rose-900">Unresolved order shortages</h2><p className="text-xs text-rose-700">Create a restock request from any shortage below.</p></div></div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {shortageRows.map(({ requirement, line, material, order }) => (
              <div key={requirement.id + line.materialId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-white p-3">
                <div className="min-w-0"><div className="text-sm font-semibold text-slate-900">{material?.name || line.materialId}</div><div className="text-xs text-slate-500">{order?.orderNumber || requirement.orderId} · shortage {line.shortageQty} {material?.unit}</div></div>
                <button type="button" onClick={() => openShortage(line.materialId, requirement.orderId, line.shortageQty)}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700">Create Restock</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50"><tr>
              {['Request', 'Material', 'Order', 'Supplier', 'Qty', 'Status', 'Requested', 'Actions'].map(label => <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseRequests.map(request => {
                const material = materials.find(item => item.id === request.materialId);
                return <tr key={request.id}>
                  <td className="px-4 py-3 text-sm font-semibold text-blue-700">{request.requestNumber}</td>
                  <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-900">{material?.name || request.materialId}</div><div className="text-xs text-slate-500">{material?.code}</div></td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{request.orderId || 'General restock'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{request.supplier}</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-slate-900">{request.quantity} {material?.unit}</td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{new Date(request.requestedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {request.status === 'Requested' && <button type="button" onClick={() => { setPurchaseRequestStatus(request.id, 'Ordered'); toast.success('Purchase request marked ordered.'); }}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100">Mark Ordered</button>}
                      {['Requested', 'Ordered'].includes(request.status) && <button type="button" onClick={() => {
                        if (receivePurchaseRequest(request.id)) toast.success('Material received. Inventory and order reservations updated.');
                        else toast.error('This request cannot be received.');
                      }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Receive Material</button>}
                      {['Requested', 'Ordered'].includes(request.status) && <button type="button" aria-label={'Cancel ' + request.requestNumber}
                        onClick={() => { if (setPurchaseRequestStatus(request.id, 'Cancelled')) toast.success('Purchase request cancelled.'); }}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><XCircle className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="New Restock Request" subtitle="Frontend demo purchase request; receiving it updates stock immediately." size="lg"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={create} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create Request</button>
        </div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700">Material</label>
            <PremiumSelect label="Purchase material" value={form.materialId} onChange={value => {
              const material = materials.find(item => item.id === value);
              setForm(current => ({ ...current, materialId: value, supplier: material?.supplier || current.supplier }));
            }} options={materials.filter(material => material.status === 'active').map(material => ({ value: material.id, label: `${material.code} — ${material.name}` }))} /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Linked Order (optional)</label>
            <PremiumSelect label="Linked purchase order" value={form.orderId} onChange={value => setForm(current => ({ ...current, orderId: value }))}
              options={[{ value: '', label: 'General restock' }, ...orders.filter(order => !['Completed', 'Cancelled'].includes(order.status)).map(order => ({ value: order.id, label: `${order.orderNumber} — ${order.product}` }))]} /></div>
          <label className="text-sm font-medium text-slate-700">Quantity<input type="number" min={0.01} step={0.01} value={form.quantity} onChange={event => setForm(current => ({ ...current, quantity: Number(event.target.value) }))} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Supplier<input value={form.supplier} onChange={event => setForm(current => ({ ...current, supplier: event.target.value }))} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Note<textarea rows={3} value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} className={inputClass} /></label>
        </div>
      </Modal>
    </div>
  );
};
