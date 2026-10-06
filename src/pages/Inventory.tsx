import React, { useMemo, useState } from 'react';
import { Archive, AlertTriangle, CheckCircle2, RefreshCw, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Material } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { availableForMaterial, materialStockStatus, reservedForMaterial } from '../utils/inventory';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const Inventory: React.FC = () => {
  const { materials, materialRequirements, inventoryTransactions, adjustMaterialStock } = useAppStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Material | null>(null);
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');

  const filtered = useMemo(() => materials.filter(material => {
    const term = search.trim().toLowerCase();
    return !term || [material.name, material.code, material.category, material.supplier].some(value => value.toLowerCase().includes(term));
  }), [materials, search]);

  const low = materials.filter(material => material.currentStock < material.minimumStock).length;
  const out = materials.filter(material => material.currentStock <= 0).length;
  const reservedTotal = materialRequirements
    .filter(requirement => ['Ready', 'Shortage'].includes(requirement.status))
    .flatMap(requirement => requirement.lines)
    .reduce((sum, line) => sum + line.reservedQty, 0);

  const applyAdjustment = () => {
    if (!selected || !Number.isFinite(delta) || delta === 0) {
      toast.error('Enter a non-zero adjustment quantity.');
      return;
    }
    if (!adjustMaterialStock(selected.id, delta, note)) {
      toast.error('Adjustment would make stock negative or is invalid.');
      return;
    }
    toast.success(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta} ${selected.unit}.`);
    setSelected(useAppStore.getState().materials.find(material => material.id === selected.id) || null);
    setDelta(0);
    setNote('');
  };

  const transactions = selected
    ? inventoryTransactions.filter(transaction => transaction.materialId === selected.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  return (
    <div className="page-shell">
      <PageHeader title="Inventory / Stock" subtitle="Live physical, reserved and available material quantities with a complete stock ledger."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Inventory / Stock' }]} />

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {[
          ['Materials', materials.length, <Archive className="h-5 w-5 text-blue-600" />],
          ['Low Stock', low, <AlertTriangle className="h-5 w-5 text-rose-600" />],
          ['Out of Stock', out, <AlertTriangle className="h-5 w-5 text-red-700" />],
          ['Reserved Qty', Math.round(reservedTotal * 100) / 100, <CheckCircle2 className="h-5 w-5 text-emerald-600" />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-500">{label}</span>{icon}</div>
            <div className="mt-2 break-words text-2xl font-bold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {low > 0 && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-sm font-bold text-rose-900">Low stock alerts</h2>
              <div className="mt-2 space-y-1 text-sm text-rose-800">
                {materials.filter(material => material.currentStock < material.minimumStock).map(material => (
                  <p key={material.id}><strong>{material.name}</strong>: {material.currentStock} {material.unit} on hand; minimum {material.minimumStock} {material.unit}.</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Search inventory..." className="w-full max-w-md" />

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50"><tr>
              {['Material', 'Physical', 'Reserved', 'Available', 'Minimum', 'Reorder', 'Unit', 'Status', 'Ledger'].map(label =>
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(material => {
                const reserved = reservedForMaterial(material.id, materialRequirements);
                const available = availableForMaterial(material, materialRequirements);
                return <tr key={material.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-900">{material.name}</div><div className="text-xs text-slate-500">{material.code}</div></td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-slate-900">{material.currentStock}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-violet-700">{reserved}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-blue-700">{available}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.minimumStock}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.reorderLevel}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{material.unit}</td>
                  <td className="px-4 py-3"><StatusBadge status={materialStockStatus(material)} /></td>
                  <td className="px-4 py-3"><button type="button" onClick={() => { setSelected(material); setDelta(0); setNote(''); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <History className="h-4 w-4" /> View / Adjust
                  </button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name} subtitle="Inventory ledger and controlled stock adjustment" size="xl">
        {selected && <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Physical', selected.currentStock],
              ['Reserved', reservedForMaterial(selected.id, materialRequirements)],
              ['Available', availableForMaterial(selected, materialRequirements)],
              ['Minimum', selected.minimumStock],
            ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value} <span className="text-xs font-medium text-slate-500">{selected.unit}</span></div>
            </div>)}
          </div>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Manual stock adjustment</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use positive values for stock-in and negative values for corrections/stock-out. Every adjustment is logged.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_auto]">
              <input type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} aria-label="Stock adjustment quantity" className={inputClass} />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason / note" aria-label="Stock adjustment note" className={inputClass} />
              <button type="button" onClick={applyAdjustment} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <RefreshCw className="h-4 w-4" /> Apply
              </button>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-900">Transaction history</h3>
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[680px] w-full">
                <thead className="bg-slate-50"><tr>{['Date', 'Type', 'Qty', 'Balance', 'Reference', 'Note'].map(label => <th key={label} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(transaction => <tr key={transaction.id}>
                    <td className="px-3 py-2 text-xs text-slate-600">{new Date(transaction.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">{transaction.type.replace(/_/g, ' ')}</td>
                    <td className={`px-3 py-2 text-sm font-semibold tabular-nums ${transaction.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{transaction.quantity > 0 ? '+' : ''}{transaction.quantity}</td>
                    <td className="px-3 py-2 text-sm font-semibold tabular-nums text-slate-900">{transaction.balanceAfter}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{transaction.reference || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{transaction.note || '—'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </div>}
      </Modal>
    </div>
  );
};
