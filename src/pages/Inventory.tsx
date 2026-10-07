import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Archive, AlertTriangle, CheckCircle2, RefreshCw, History,
  LockKeyhole, PackageCheck, SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Material } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  inventoryPosition,
  inventorySummary,
  inventoryTransactionLabel,
  InventoryStockStatus,
} from '../utils/inventory';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const filters: Array<'All' | InventoryStockStatus> = ['All', 'Out of Stock', 'Low Stock', 'Reorder Soon', 'Healthy'];

export const Inventory: React.FC = () => {
  const location = useLocation();
  const {
    materials, materialRequirements, inventoryTransactions, adjustMaterialStock,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InventoryStockStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');

  const selected = selectedId ? materials.find(material => material.id === selectedId) || null : null;
  const summary = useMemo(
    () => inventorySummary(materials, materialRequirements),
    [materials, materialRequirements],
  );

  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('open');
    if (!openId) return;
    if (materials.some(material => material.id === openId)) setSelectedId(openId);
  }, [location.search, materials]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return summary.positions.filter(item => {
      const matchesSearch = !term || [
        item.material.name,
        item.material.code,
        item.material.category,
        item.material.supplier,
      ].some(value => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [summary.positions, search, statusFilter]);

  const lowStockMaterials = summary.positions.filter(item =>
    ['Low Stock', 'Out of Stock'].includes(item.status));

  const openMaterial = (material: Material) => {
    setSelectedId(material.id);
    setDelta(0);
    setNote('');
  };

  const selectedPosition = selected
    ? inventoryPosition(selected, materialRequirements)
    : null;

  const selectedReservations = selected
    ? materialRequirements
        .filter(requirement =>
          ['Ready', 'Shortage'].includes(requirement.status) &&
          requirement.lines.some(line => line.materialId === selected.id && line.reservedQty > 0))
        .map(requirement => ({
          requirement,
          line: requirement.lines.find(line => line.materialId === selected.id)!,
        }))
    : [];

  const transactions = selected
    ? inventoryTransactions
        .filter(transaction => transaction.materialId === selected.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  const applyAdjustment = () => {
    if (!selected || !selectedPosition) return;
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Enter a non-zero adjustment quantity.');
      return;
    }
    if (!note.trim()) {
      toast.error('Add a reason so the stock adjustment is auditable.');
      return;
    }

    const resultingBalance = Math.round((selected.currentStock + delta + Number.EPSILON) * 100) / 100;
    if (resultingBalance < selectedPosition.reserved) {
      toast.error(`Cannot reduce physical stock below ${selectedPosition.reserved} ${selected.unit} already reserved for open orders.`);
      return;
    }

    if (!adjustMaterialStock(selected.id, delta, note)) {
      toast.error('Stock adjustment is invalid. Check the quantity, reserved stock and reason.');
      return;
    }

    toast.success(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta} ${selected.unit}.`);
    setDelta(0);
    setNote('');
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Inventory / Stock"
        subtitle="Track physical stock, open-order reservations, available quantity and an auditable transaction ledger."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Inventory / Stock' }]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Materials', summary.materialCount, <Archive className="h-5 w-5 text-blue-600" />],
          ['Below Minimum', summary.lowStockCount, <AlertTriangle className="h-5 w-5 text-rose-600" />],
          ['Out of Stock', summary.outOfStockCount, <AlertTriangle className="h-5 w-5 text-red-700" />],
          ['Materials Reserved', summary.reservedMaterialCount, <LockKeyhole className="h-5 w-5 text-violet-600" />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="min-w-0 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-medium text-slate-500">{label}</span>
              {icon}
            </div>
            <div className="mt-2 break-words text-2xl font-bold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {lowStockMaterials.length > 0 && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4" aria-label="Low stock alerts">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-rose-900">Low stock alerts</h2>
              <p className="mt-1 text-xs leading-5 text-rose-700">Current stock is below the configured minimum level.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                {lowStockMaterials.map(({ material, status }) => (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => openMaterial(material)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-left hover:bg-rose-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{material.name}</span>
                      <span className="block text-xs text-slate-500">
                        {material.currentStock} {material.unit} on hand · minimum {material.minimumStock} {material.unit}
                      </span>
                    </span>
                    <StatusBadge status={status} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search material, code, category or supplier..."
          className="w-full max-w-md"
        />
        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Inventory status filter">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
          {filters.map(filter => (
            <button
              key={filter}
              type="button"
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === filter
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Stock Position</h2>
            <span className="text-xs text-slate-500">{filtered.length} material{filtered.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map(({ material, physical, reserved, available, status }) => (
            <button
              key={material.id}
              type="button"
              aria-label={'Open inventory ' + material.name}
              onClick={() => openMaterial(material)}
              className="block w-full min-w-0 p-4 text-left hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{material.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{material.code} · {material.category}</div>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Physical', physical],
                  ['Reserved', reserved],
                  ['Available', available],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0 rounded-lg bg-slate-50 p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-1 break-words text-sm font-bold tabular-nums text-slate-900">{value} <span className="text-[10px] font-medium text-slate-500">{material.unit}</span></div>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50">
              <tr>
                {['Material', 'Physical', 'Reserved', 'Available', 'Minimum', 'Reorder', 'Unit', 'Status', 'Ledger'].map(label => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(({ material, physical, reserved, available, status }) => (
                <tr key={material.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{material.name}</div>
                    <div className="text-xs text-slate-500">{material.code} · {material.category}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-slate-900">{physical}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-violet-700">{reserved}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-blue-700">{available}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.minimumStock}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{material.reorderLevel}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{material.unit}</td>
                  <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openMaterial(material)}
                      aria-label={'View ledger ' + material.name}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <History className="h-4 w-4" /> View / Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="p-8 text-center">
            <Archive className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No inventory matches these filters.</p>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter('All'); }}
              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>
          </div>
        )}
      </section>

      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name}
        subtitle={selected ? `${selected.code} · ${selected.category} · Inventory ledger and controlled stock adjustment` : undefined}
        size="xl"
      >
        {selected && selectedPosition && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Physical', selectedPosition.physical],
                ['Reserved', selectedPosition.reserved],
                ['Available', selectedPosition.available],
                ['Minimum', selected.minimumStock],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0 rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className="mt-1 break-words text-lg font-bold tabular-nums text-slate-900">
                    {value} <span className="text-xs font-medium text-slate-500">{selected.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedReservations.length > 0 && (
              <section className="rounded-xl border border-violet-200 bg-violet-50 p-4" aria-label="Open stock reservations">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-violet-900">Open stock reservations</h3>
                    <p className="mt-1 text-xs leading-5 text-violet-700">Reserved quantities are protected from manual stock-out adjustments.</p>
                    <div className="mt-3 space-y-2">
                      {selectedReservations.map(({ requirement, line }) => (
                        <div key={requirement.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{requirement.orderId}</div>
                            <div className="text-xs text-slate-500">{requirement.quantity} × {requirement.productName}</div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <div>Required <strong>{line.requiredQty} {selected.unit}</strong></div>
                            <div>Reserved <strong className="text-violet-700">{line.reservedQty} {selected.unit}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manual stock adjustment</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Use a positive quantity for stock-in or a negative quantity for correction/stock-out. A reason is required and every change is recorded.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                <label className="text-xs font-semibold text-slate-600">
                  Quantity change
                  <input
                    type="number"
                    step="0.01"
                    value={delta}
                    onChange={event => setDelta(Number(event.target.value))}
                    aria-label="Stock adjustment quantity"
                    className={inputClass}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Reason
                  <input
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="e.g. physical count correction"
                    aria-label="Stock adjustment note"
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  onClick={applyAdjustment}
                  className="inline-flex min-h-10 self-end items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" /> Apply
                </button>
              </div>
              {selectedPosition.reserved > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-violet-700">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stock-out cannot reduce physical stock below {selectedPosition.reserved} {selected.unit} reserved for open orders.
                </p>
              )}
            </section>

            <section>
              <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Transaction history</h3>
                <span className="text-xs text-slate-500">{transactions.length} transaction{transactions.length === 1 ? '' : 's'}</span>
              </div>
              <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200" role="region" aria-label="Inventory transaction ledger" tabIndex={0}>
                <table className="min-w-[720px] w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Date', 'Type', 'Qty', 'Balance', 'Reference', 'Reason / Note'].map(label => (
                        <th key={label} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-2 text-xs text-slate-600">{new Date(transaction.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-700">{inventoryTransactionLabel(transaction.type)}</td>
                        <td className={`px-3 py-2 text-sm font-semibold tabular-nums ${transaction.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold tabular-nums text-slate-900">{transaction.balanceAfter}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{transaction.reference || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{transaction.note || '—'}</td>
                      </tr>
                    ))}
                    {!transactions.length && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">No stock transactions recorded for this material.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              <PackageCheck className="mr-1.5 inline h-4 w-4" />
              Available stock is calculated as physical stock minus active reservations. The transaction ledger records every physical stock change.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
