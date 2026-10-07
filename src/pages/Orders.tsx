import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Plus, Eye, Edit2, Trash2, PauseCircle, PlayCircle, Ban,
  Factory, CheckCircle, ArrowRight, DollarSign, ArrowDownUp, Boxes, AlertTriangle, ShoppingBag, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Order } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RowActions } from '../components/ui/RowActions';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { WorkflowStepper } from '../components/ui/WorkflowStepper';
import { formatDate, formatCurrency } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';

const ITEMS_PER_PAGE = 8;
const ORDER_STATUSES = ['Confirmed', 'Production', 'Quality Check', 'Ready', 'Dispatched', 'Completed'];
const ORDER_EXCEPTION_STATUSES = ['On Hold', 'Cancelled'];
const PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid', 'Overdue'];
const STATUS_COLORS: Record<string, string> = {
  Confirmed: '#2563eb', Production: '#7c3aed', 'Quality Check': '#d97706',
  Ready: '#0d9488', Dispatched: '#0891b2', Completed: '#059669',
  'On Hold': '#c2410c', Cancelled: '#be123c',
};
const FALLBACK_PRODUCTS = ['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Industrial Dryer', 'Reactor', 'Column', 'Boiler System'];
const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

const getWorkflowSteps = (order: Order) => {
  const steps = ['Confirmed', 'Production', 'Quality Check', 'Ready', 'Dispatched', 'Completed'];
  const lastException = [...(order.statusHistory || [])].reverse().find(event => event.to === order.status);
  const previousStage = lastException?.from === 'On Hold'
    ? [...(order.statusHistory || [])].reverse().find(event => event.to === 'On Hold')?.from
    : lastException?.from;
  const effectiveStatus = ['On Hold', 'Cancelled'].includes(order.status) ? previousStage || 'Confirmed' : order.status;
  const idx = steps.indexOf(effectiveStatus);
  return steps.map((s, i) => ({
    label: s,
    status: i < idx ? 'completed' : i === idx ? 'current' : 'pending' as any,
  }));
};

export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    orders, customers, productionJobs, products, materials, materialRequirements, purchaseRequests,
    addOrder, updateOrder, deleteOrder, addProductionJob, advanceOrderStatus, changeOrderException,
    createPurchaseRequest, calculateMaterialRequirement, profile,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') === 'active' ? 'active' : 'all');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') === 'pending' ? 'pending' : 'all');
  const [newestFirst, setNewestFirst] = useState(true);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [exceptionAction, setExceptionAction] = useState<'hold' | 'resume' | 'cancel' | null>(null);
  const [exceptionNote, setExceptionNote] = useState('');
  const [page, setPage] = useState(1);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // ?open=ID is a deep link from customer records, notifications and dashboard activity.
  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('open');
    if (!openId) return;
    const record = orders.find(o => o.id === openId);
    if (record) setViewingOrder(record);
  }, [location.search, orders]);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [editModal, setEditModal] = useState<Order | null>(null);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customerId: '', quotationId: '', product: products.find(product => product.active)?.name || FALLBACK_PRODUCTS[0],
    quantity: 1, orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
    totalAmount: 0, paymentStatus: 'Pending', status: 'Confirmed', notes: '',
  });

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const customer = customers.find(c => c.id === o.customerId);
      const matchSearch = !search ||
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        o.product.toLowerCase().includes(search.toLowerCase()) ||
        customer?.companyName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !['Completed','Cancelled'].includes(o.status) : o.status === statusFilter);
      const matchPayment = paymentFilter === 'all' || (paymentFilter === 'pending' ? ['Pending', 'Partial', 'Overdue'].includes(o.paymentStatus) : o.paymentStatus === paymentFilter);
      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, customers, search, statusFilter, paymentFilter]);

  const sorted = [...filtered].sort((a, b) => (newestFirst ? 1 : -1) * (new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const getCustomer = (id: string) => customers.find(c => c.id === id);
  const getJob = (orderId: string) => productionJobs.find(j => j.orderId === orderId);

  const stats = {
    total: orders.length,
    active: orders.filter(o => !['Completed','Cancelled'].includes(o.status)).length,
    inProduction: orders.filter(o => o.status === 'Production').length,
    completed: orders.filter(o => o.status === 'Completed').length,
    pendingPayment: orders.filter(o => ['Pending', 'Partial', 'Overdue'].includes(o.paymentStatus)).length,
    materialShortage: materialRequirements.filter(requirement => requirement.status === 'Shortage').length,
  };

  const handleCreateJob = (order: Order) => {
    const newJob = addProductionJob({
      jobNumber: '',
      orderId: order.id,
      product: order.product,
      quantity: order.quantity,
      startDate: new Date().toISOString().split('T')[0],
      expectedCompletion: order.deliveryDate,
      assignedTeam: 'Fabrication Team A',
      status: 'Planning',
      progress: 0,
      notes: '',
      stages: [
        { name: 'Planning', status: 'in-progress' },
        { name: 'Material Preparation', status: 'pending' },
        { name: 'Fabrication', status: 'pending' },
        { name: 'Assembly', status: 'pending' },
        { name: 'Quality Check', status: 'pending' },
        { name: 'Ready', status: 'pending' },
        { name: 'Completed', status: 'pending' },
      ],
    });
    if (!newJob) {
      toast.error('Production is blocked until the order BOM is fully reserved. Resolve material shortages first.');
      setCreateJobOpen(false);
      return;
    }
    toast.success(`Production job ${newJob.jobNumber} created. Reserved materials were consumed from inventory.`);
    setCreateJobOpen(false);
    setViewingOrder(null);
    navigate('/production');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (!deleteOrder(deleteTarget.id)) {
      toast.error('Cannot delete an order while production jobs are linked.');
      setDeleteTarget(null);
      return;
    }
    toast.success('Order deleted.');
    setDeleteTarget(null);
    setViewingOrder(null);
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    const original = orders.find(order => order.id === editModal.id);
    const materialDefinitionChanged = !!original &&
      (original.product !== editModal.product || original.quantity !== editModal.quantity);
    const { status: _status, statusHistory: _history, ...changes } = editModal;
    updateOrder(editModal.id, changes);
    const updated = useAppStore.getState().orders.find(order => order.id === editModal.id) || editModal;
    toast.success(materialDefinitionChanged
      ? 'Order updated. Material requirements and reservations recalculated.'
      : 'Order updated.');
    setEditModal(null);
    if (viewingOrder?.id === editModal.id) setViewingOrder(updated);
  };

  const currentOrder = viewingOrder ? orders.find(o => o.id === viewingOrder.id) || viewingOrder : null;
  const currentMaterialRequirement = currentOrder ? materialRequirements.find(requirement => requirement.orderId === currentOrder.id) : undefined;
  const currentProduct = currentOrder ? products.find(product => product.name === currentOrder.product) : undefined;
  const readyMaterialLines = currentMaterialRequirement
    ? currentMaterialRequirement.lines.filter(line => line.reservedQty + 1e-9 >= line.requiredQty).length
    : 0;
  const editRequirement = editModal ? materialRequirements.find(requirement => requirement.orderId === editModal.id) : undefined;
  const editMaterialsLocked = !!editModal && (
    !!editModal.productionJobId ||
    editRequirement?.status === 'Consumed' ||
    ['Production', 'Quality Check', 'Ready', 'Dispatched', 'Completed'].includes(editModal.status)
  );

  const handleRestockShortage = (materialId: string, shortageQty: number) => {
    if (!currentOrder) return;
    const material = materials.find(item => item.id === materialId);
    if (!material) return;
    const existing = purchaseRequests.find(request =>
      request.orderId === currentOrder.id && request.materialId === materialId &&
      !['Received', 'Cancelled'].includes(request.status));
    if (existing) {
      toast(`${existing.requestNumber} is already open for this shortage.`, { icon: 'ℹ️' });
      return;
    }
    const quantity = Math.max(shortageQty, material.reorderLevel - material.currentStock, 1);
    const request = createPurchaseRequest({
      materialId,
      orderId: currentOrder.id,
      supplier: material.supplier,
      quantity: Math.ceil(quantity * 100) / 100,
      note: `Material shortage for ${currentOrder.orderNumber}`,
    });
    if (!request) {
      toast.error('A valid open shortage is required and duplicate open restock requests are blocked.');
      return;
    }
    toast.success(`${request.requestNumber} created for ${material.name}.`);
  };

  const handleRecheckMaterials = () => {
    if (!currentOrder) return;
    const result = calculateMaterialRequirement(currentOrder.id);
    if (!result) {
      toast.error(`${currentOrder.product} does not have a configured BOM yet.`);
      return;
    }
    toast.success(`Material check updated: ${result.status}.`);
  };

  const currentIndex = currentOrder ? ORDER_STATUSES.indexOf(currentOrder.status) : -1;
  const nextOrderStatus = currentIndex >= 0 ? ORDER_STATUSES[currentIndex + 1] : undefined;

  const handleAdvanceStatus = () => {
    if (!currentOrder || !nextOrderStatus) return;
    if (!advanceOrderStatus(currentOrder.id, profile.name, statusNote)) {
      toast.error('Order status has changed. Reopen the order and try again.'); return;
    }
    setViewingOrder(useAppStore.getState().orders.find(o => o.id === currentOrder.id) || null);
    setStatusModalOpen(false); setStatusNote('');
    toast.success(`Order moved to ${nextOrderStatus}.`);
  };

  const handleException = () => {
    if (!currentOrder || !exceptionAction) return;
    if (!changeOrderException(currentOrder.id, exceptionAction, profile.name, exceptionNote)) {
      toast.error('The selected status change is unavailable. Refresh the order and try again.');
      setExceptionAction(null);
      return;
    }
    setViewingOrder(useAppStore.getState().orders.find(order => order.id === currentOrder.id) || null);
    toast.success(exceptionAction === 'hold' ? 'Order put on hold.' :
      exceptionAction === 'resume' ? 'Order resumed at its previous stage.' : 'Order cancelled.');
    setExceptionAction(null);
    setExceptionNote('');
  };

  const handleAddOrder = () => {
    if (!newOrderForm.customerId || !newOrderForm.product) { toast.error('Please fill required fields.'); return; }
    const order = addOrder({ ...newOrderForm as any, orderNumber: '' });
    toast.success(`Order ${order.orderNumber} created.`);
    setAddModalOpen(false);
    setNewOrderForm({
      customerId: '', quotationId: '', product: products.find(product => product.active)?.name || FALLBACK_PRODUCTS[0],
      quantity: 1, orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
      totalAmount: 0, paymentStatus: 'Pending', status: 'Confirmed', notes: '',
    });
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Orders"
        subtitle="Track customer orders from confirmation to completion."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Orders' }]}
        actions={
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Orders" value={stats.total} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="Active Orders" value={stats.active} icon={<ArrowRight className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" index={1} />
        <StatCard title="In Production" value={stats.inProduction} icon={<Factory className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" index={2} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={3} />
        <StatCard title="Pending Payment" value={stats.pendingPayment} icon={<DollarSign className="w-5 h-5 text-rose-600" />} iconBg="bg-rose-50" index={4} />
        <StatCard title="Material Shortage" value={stats.materialShortage} icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} iconBg="bg-rose-50" index={5} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by order no., customer or product..." className="flex-1 max-w-md" />
        <PremiumSelect label="Order status filter" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active Orders' }, ...[...ORDER_STATUSES, ...ORDER_EXCEPTION_STATUSES].map(value => ({ value, label: value, color: STATUS_COLORS[value] }))]} className="w-full sm:w-48" />
        <PremiumSelect label="Payment status filter" value={paymentFilter} onChange={value => { setPaymentFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Payments' }, { value: 'pending', label: 'Pending / Partial / Overdue', color: '#d97706' },
            ...PAYMENT_STATUSES.map(value => ({ value, label: value, color: value === 'Paid' ? '#059669' : '#d97706' }))]} className="w-full sm:w-60" />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-8 h-8" />} title="No orders found" description="Orders created from approved quotations will appear here." action={<button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> New Order</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Order ID', 'Customer', 'Product', 'Qty', 'Order Date', 'Delivery', 'Amount', 'Materials', 'Status', 'Payment', 'Actions'].map(h => (
                      <th key={h} scope="col" className="text-left text-xs font-semibold text-slate-500 px-6 py-3.5">
                        {h === 'Order Date' ? <button type="button" onClick={() => { setNewestFirst(v => !v); setPage(1); }}
                          className="inline-flex items-center gap-1 hover:text-blue-700" title="Toggle order date sorting"
                          aria-label="Sort orders by date">Order Date <ArrowDownUp className="h-3.5 w-3.5" /></button> : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((order, i) => {
                    const customer = getCustomer(order.customerId);
                    const materialRequirement = materialRequirements.find(requirement => requirement.orderId === order.id);
                    const materialStatus = materialRequirement?.status || 'Not Calculated';
                    return (
                      <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <button onClick={() => setViewingOrder(order)} className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700">{order.orderNumber}</button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{customer?.companyName || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm text-slate-700">{order.product}</span></td>
                        <td className="px-6 py-4"><span className="text-sm text-slate-700">{order.quantity}</span></td>
                        <td className="px-6 py-4"><span className="text-xs text-slate-500">{formatDate(order.orderDate)}</span></td>
                        <td className="px-6 py-4"><span className="text-xs text-slate-500">{formatDate(order.deliveryDate)}</span></td>
                        <td className="px-6 py-4"><span className="text-sm font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</span></td>
                        <td className="px-6 py-4"><StatusBadge status={materialStatus} /></td>
                        <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                        <td className="px-6 py-4"><StatusBadge status={order.paymentStatus} /></td>
                        <td className="px-6 py-4">
                          <RowActions label={`Actions for ${order.orderNumber}`} actions={[
  { label: 'View details', onClick: () => setViewingOrder(order), icon: <Eye className="h-4 w-4" /> },
  { label: 'Edit order', onClick: () => setEditModal({ ...order }), icon: <Edit2 className="h-4 w-4" /> },
  { label: 'Delete order', onClick: () => setDeleteTarget(order), icon: <Trash2 className="h-4 w-4" />, danger: true },
]} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <Pagination currentPage={page} totalPages={totalPages} totalItems={sorted.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
            </div>
          </>
        )}
      </motion.div>

      {/* View Drawer */}
      {viewingOrder && (
        <Drawer open={!!viewingOrder} onClose={() => setViewingOrder(null)} title={viewingOrder.orderNumber} subtitle="Order Details">
          <div className="p-6 space-y-6">
            {/* Workflow */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Order Progress</h4>
              <WorkflowStepper steps={getWorkflowSteps(viewingOrder)} />
               {ORDER_EXCEPTION_STATUSES.includes(viewingOrder.status) && (
                 <div className={`mt-4 rounded-lg border p-3 text-sm ${viewingOrder.status === 'On Hold' ? 'border-orange-200 bg-orange-50 text-orange-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                   <StatusBadge status={viewingOrder.status} />
                   <p className="mt-2">{viewingOrder.status === 'On Hold'
                     ? 'Progression is paused. Resume to return to the last active stage.'
                     : 'This order is cancelled and its workflow is closed.'}</p>
                 </div>
               )}
              {nextOrderStatus && (
                <button type="button" onClick={() => setStatusModalOpen(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 active:bg-blue-800">
                  Update Status <ArrowRight className="h-4 w-4" /> {nextOrderStatus}
                </button>
              )}
            </div>

            <section
              aria-label="Material readiness"
              className={`rounded-xl border p-4 ${
                currentMaterialRequirement?.status === 'Shortage'
                  ? 'border-rose-200 bg-rose-50'
                  : currentMaterialRequirement?.status === 'Ready'
                    ? 'border-emerald-200 bg-emerald-50'
                    : currentMaterialRequirement?.status === 'Consumed'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Material Readiness</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentMaterialRequirement
                      ? `BOM v${currentMaterialRequirement.bomVersion || currentProduct?.bomVersion || '—'} · ${readyMaterialLines}/${currentMaterialRequirement.lines.length} material lines covered`
                      : `${currentProduct?.name || currentOrder?.product || 'Product'} BOM has not been calculated for this order.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={currentMaterialRequirement?.status || 'Not Calculated'} />
                  {currentOrder && !currentOrder.productionJobId && !['Completed', 'Cancelled'].includes(currentOrder.status) && currentMaterialRequirement?.status !== 'Consumed' && (
                    <button
                      type="button"
                      onClick={handleRecheckMaterials}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Recheck
                    </button>
                  )}
                </div>
              </div>

              {!currentMaterialRequirement ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">BOM requirement is not available.</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Configure a BOM for {currentOrder?.product || 'this product'} before production can start.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setViewingOrder(null); navigate('/bom'); }}
                    className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Open Product BOM
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {currentMaterialRequirement.lines.map(line => {
                    const material = materials.find(item => item.id === line.materialId);
                    const shortage = Math.max(0, line.requiredQty - line.reservedQty);
                    const isShortage = currentMaterialRequirement.status === 'Shortage' && shortage > 0;
                    return (
                      <div key={line.materialId} className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{material?.name || line.materialId}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{material?.code || line.materialId} · stock on hand {material?.currentStock ?? 0} {material?.unit || ''}</div>
                          </div>
                          {isShortage ? (
                            <button
                              type="button"
                              onClick={() => handleRestockShortage(line.materialId, shortage)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" /> Restock {shortage} {material?.unit}
                            </button>
                          ) : currentMaterialRequirement.status === 'Consumed' ? (
                            <span className="text-xs font-semibold text-blue-700">Consumed {line.consumedQty} {material?.unit}</span>
                          ) : currentMaterialRequirement.status === 'Released' ? (
                            <span className="text-xs font-semibold text-slate-600">Reservation released</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle className="h-4 w-4" /> Covered</span>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md bg-slate-50 p-2"><span className="block text-slate-500">Required</span><strong className="mt-0.5 block tabular-nums text-slate-900">{line.requiredQty} {material?.unit}</strong></div>
                          <div className="rounded-md bg-violet-50 p-2"><span className="block text-violet-600">Reserved</span><strong className="mt-0.5 block tabular-nums text-violet-900">{line.reservedQty} {material?.unit}</strong></div>
                          <div className={`rounded-md p-2 ${shortage > 0 && currentMaterialRequirement.status === 'Shortage' ? 'bg-rose-100' : 'bg-emerald-50'}`}>
                            <span className={shortage > 0 && currentMaterialRequirement.status === 'Shortage' ? 'text-rose-600' : 'text-emerald-600'}>
                              {currentMaterialRequirement.status === 'Consumed' ? 'Consumed' : 'Shortage'}
                            </span>
                            <strong className={`mt-0.5 block tabular-nums ${shortage > 0 && currentMaterialRequirement.status === 'Shortage' ? 'text-rose-900' : 'text-emerald-900'}`}>
                              {currentMaterialRequirement.status === 'Consumed' ? line.consumedQty : shortage} {material?.unit}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {currentMaterialRequirement.status === 'Shortage' && (
                    <p className="flex items-start gap-2 text-xs leading-5 text-rose-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      Production is locked until every BOM line is fully reserved. Earlier open orders keep reservation priority.
                    </p>
                  )}
                  {currentMaterialRequirement.status === 'Ready' && (
                    <p className="text-xs leading-5 text-emerald-800">All BOM materials are reserved for this order. Production can start.</p>
                  )}
                  {currentMaterialRequirement.status === 'Consumed' && (
                    <p className="text-xs leading-5 text-blue-800">Materials were consumed once when production started; the requirement is now locked.</p>
                  )}
                  {currentMaterialRequirement.status === 'Released' && (
                    <p className="text-xs leading-5 text-slate-700">This order no longer holds inventory reservations. Released stock is available to later open orders.</p>
                  )}
                </div>
              )}
            </section>

            <section aria-label="Order status audit trail" className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Status History</h4>
              {viewingOrder.statusHistory?.length ? (
                <ol className="space-y-4 border-l-2 border-slate-100 pl-4">
                  {[...viewingOrder.statusHistory].reverse().map((entry, index) => (
                    <li key={index} className="relative">
                      <span aria-hidden="true" className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" />
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        <StatusBadge status={entry.from} size="sm" />
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <StatusBadge status={entry.to} size="sm" />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Updated by {entry.changedBy} · {new Date(entry.changedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      {entry.note && <p className="mt-1 break-words text-sm text-slate-700">{entry.note}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-slate-500">No status changes recorded yet for this order.</p>}
            </section>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Customer', value: getCustomer(viewingOrder.customerId)?.companyName || 'Unknown', span: true },
                { label: 'Quotation', value: viewingOrder.quotationId },
                { label: 'Product', value: viewingOrder.product },
                { label: 'Quantity', value: `${viewingOrder.quantity} units` },
                { label: 'Order Date', value: formatDate(viewingOrder.orderDate) },
                { label: 'Delivery Date', value: formatDate(viewingOrder.deliveryDate) },
                { label: 'Total Amount', value: formatCurrency(viewingOrder.totalAmount) },
              ].map((item: any) => (
                <div key={item.label} className={item.span ? 'col-span-2' : ''}>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{item.value}</div>
                </div>
              ))}
              <div>
                <div className="text-xs text-slate-500">Order Status</div>
                <div className="mt-1"><StatusBadge status={viewingOrder.status} /></div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Payment Status</div>
                <div className="mt-1"><StatusBadge status={viewingOrder.paymentStatus} /></div>
              </div>
            </div>

            {viewingOrder.notes && (
              <div>
                <div className="text-xs text-slate-500">Notes</div>
                <div className="text-sm text-slate-900 mt-1 leading-relaxed bg-slate-50 rounded-lg p-3">{viewingOrder.notes}</div>
              </div>
            )}

            {/* Production Job */}
            {(() => {
              const job = getJob(viewingOrder.id);
              if (job) {
                return (
                  <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-violet-600 font-semibold uppercase tracking-wider">Production Job</div>
                        <div className="text-sm font-bold text-slate-900 mt-1">{job.jobNumber}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={job.status} />
                          <span className="text-xs text-slate-600">{job.progress}% complete</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-violet-200 rounded-full overflow-hidden w-48">
                          <div className="h-full bg-violet-600 rounded-full" style={{ width: `${job.progress}%` }} />
                        </div>
                      </div>
                      <button onClick={() => { setViewingOrder(null); navigate('/production?open=' + encodeURIComponent(job.id)); }} aria-label={`Open production job ${job.jobNumber}`} title="View production job" className="text-violet-600 hover:text-violet-700 p-2 rounded-lg hover:bg-violet-100 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
              {!getJob(viewingOrder.id) && ['Confirmed', 'Production'].includes(viewingOrder.status) && (
                <button disabled={currentMaterialRequirement?.status !== 'Ready'} onClick={() => setCreateJobOpen(true)}
                  title={currentMaterialRequirement?.status === 'Ready' ? 'Create production job and consume reserved materials' : 'Resolve material shortages before production'}
                  className="flex flex-1 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  <Factory className="w-4 h-4" /> Create Production Job
                </button>
              )}
              {/* Exceptional statuses are separate from normal order progression. */}
               {!['Completed','Cancelled'].includes(viewingOrder.status) && (
                 <div className="flex w-full flex-wrap gap-2">
                   {viewingOrder.status === 'On Hold' ? (
                     <button type="button" onClick={() => setExceptionAction('resume')}
                       className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100">
                       <PlayCircle className="h-4 w-4" /> Resume Order
                     </button>
                   ) : (
                     <button type="button" onClick={() => setExceptionAction('hold')}
                       className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
                       <PauseCircle className="h-4 w-4" /> Put On Hold
                     </button>
                   )}
                   <button type="button" onClick={() => setExceptionAction('cancel')}
                     className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">
                     <Ban className="h-4 w-4" /> Cancel Order
                   </button>
                 </div>
               )}
               <button onClick={() => { setViewingOrder(null); setEditModal({ ...viewingOrder }); }} className="flex items-center gap-2 text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1">
                <Edit2 className="w-4 h-4" /> Edit Order
              </button>
              <button onClick={() => { setDeleteTarget(viewingOrder); setViewingOrder(null); }} className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Audited next-step status transition */}
      <Modal open={statusModalOpen && !!currentOrder && !!nextOrderStatus}
        onClose={() => { setStatusModalOpen(false); setStatusNote(''); }}
        title={currentOrder ? `Update ${currentOrder.orderNumber}` : 'Update Order'}
        subtitle="Move the order to the next workflow stage only."
        footer={<div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => { setStatusModalOpen(false); setStatusNote(''); }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleAdvanceStatus} disabled={!nextOrderStatus}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Confirm Update</button>
        </div>}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <StatusBadge status={currentOrder?.status || ''} />
            <ArrowRight className="h-4 w-4 text-blue-600" />
            <StatusBadge status={nextOrderStatus || ''} />
          </div>
          <label htmlFor="order-status-note" className="block text-sm font-medium text-slate-700">Update note (optional)</label>
          <textarea id="order-status-note" rows={3} maxLength={500} value={statusNote}
            onChange={e => setStatusNote(e.target.value)} placeholder="What changed at this stage?"
            className={inputClass} />
          <p className="text-xs text-slate-500">This change will be recorded with your demo operator name and the current time.</p>
        </div>
      </Modal>

      {/* Confirm exceptional and destructive status changes with an audit note. */}
       <Modal open={!!exceptionAction && !!currentOrder}
         onClose={() => { setExceptionAction(null); setExceptionNote(''); }}
         title={exceptionAction === 'hold' ? 'Put Order On Hold' : exceptionAction === 'resume' ? 'Resume Order' : 'Cancel Order'}
         subtitle={currentOrder?.orderNumber}
         footer={<div className="flex flex-wrap justify-end gap-3">
           <button type="button" onClick={() => { setExceptionAction(null); setExceptionNote(''); }}
             className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Back</button>
           <button type="button" onClick={handleException}
             className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white ${exceptionAction === 'cancel' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
             {exceptionAction === 'hold' ? 'Confirm Hold' : exceptionAction === 'resume' ? 'Confirm Resume' : 'Confirm Cancellation'}
           </button>
         </div>}>
         <div className="space-y-3">
           <p className="text-sm leading-6 text-slate-700">{exceptionAction === 'cancel'
             ? 'Cancelling closes this order and cannot be reversed through the demo workflow. It will be recorded in the status history.'
             : exceptionAction === 'hold' ? 'Pauses normal progression until the order is resumed.'
               : 'Returns the order to the stage it was in before being placed on hold.'}</p>
           <label htmlFor="exception-note" className="block text-sm font-medium text-slate-700">Status note (optional)</label>
           <textarea id="exception-note" rows={3} maxLength={500} value={exceptionNote}
             onChange={event => setExceptionNote(event.target.value)} placeholder="Explain the change for the status history..."
             className={inputClass} />
         </div>
       </Modal>
       {/* Edit Modal */}
      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit ${editModal.orderNumber}`} size="lg"
          footer={
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Save Changes</button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">To change an order stage, open Order Details → Update Status. Changes there are recorded in the audit history.</div>

            {editMaterialsLocked ? (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                Product and quantity are locked because production has started or material consumption is already recorded.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Product</label>
                  <PremiumSelect
                    label="Edit order product"
                    value={editModal.product}
                    onChange={value => setEditModal(prev => prev ? { ...prev, product: value } : null)}
                    options={(products.length ? products.filter(product => product.active).map(product => product.name) : FALLBACK_PRODUCTS)
                      .map(value => ({ value, label: value }))}
                  />
                </div>
                <div>
                  <label htmlFor="edit-order-quantity" className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
                  <input
                    id="edit-order-quantity"
                    type="number"
                    min={1}
                    value={editModal.quantity}
                    onChange={e => setEditModal(prev => prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) } : null)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2 rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900">
                  Changing product or quantity recalculates the BOM requirement and redistributes reservations across all open orders by reservation priority.
                </div>
              </>
            )}

            {[
              { label: 'Payment Status', field: 'paymentStatus', type: 'select', options: PAYMENT_STATUSES },
              { label: 'Order Date', field: 'orderDate', type: 'date' },
              { label: 'Delivery Date', field: 'deliveryDate', type: 'date' },
              { label: 'Total Amount', field: 'totalAmount', type: 'number' },
            ].map(f => (
              <div key={f.field}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                {f.type === 'select' ? (
                  <PremiumSelect label={f.label} value={(editModal as any)[f.field]} onChange={value => setEditModal(prev => prev ? { ...prev, [f.field]: value } : null)}
                    options={(f.options || []).map(value => ({ value, label: value, color: value === 'Paid' ? '#059669' : '#d97706' }))} />
                ) : (
                  <input type={f.type} value={(editModal as any)[f.field]} onChange={e => setEditModal(prev => prev ? { ...prev, [f.field]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value } : null)} className={inputClass} />
                )}
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea rows={3} value={editModal.notes} onChange={e => setEditModal(prev => prev ? { ...prev, notes: e.target.value } : null)} className={inputClass} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Order Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="New Order" size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddOrder} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Create Order</button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer <span className="text-red-500">*</span></label>
            <PremiumSelect label="Customer" value={newOrderForm.customerId} onChange={value => setNewOrderForm(f => ({ ...f, customerId: value }))}
              options={[{ value: '', label: 'Select customer...' }, ...customers.map(c => ({ value: c.id, label: c.companyName }))]} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product</label>
            <PremiumSelect label="Product" value={newOrderForm.product} onChange={value => setNewOrderForm(f => ({ ...f, product: value }))}
              options={(products.length ? products.filter(product => product.active).map(product => product.name) : FALLBACK_PRODUCTS).map(value => ({ value, label: value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
            <input type="number" min={1} value={newOrderForm.quantity} onChange={e => setNewOrderForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Order Date</label>
            <input type="date" value={newOrderForm.orderDate} onChange={e => setNewOrderForm(f => ({ ...f, orderDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Delivery Date</label>
            <input type="date" value={newOrderForm.deliveryDate} onChange={e => setNewOrderForm(f => ({ ...f, deliveryDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount</label>
            <input type="number" min={0} value={newOrderForm.totalAmount} onChange={e => setNewOrderForm(f => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Status</label>
            <PremiumSelect label="Payment status" value={newOrderForm.paymentStatus} onChange={value => setNewOrderForm(f => ({ ...f, paymentStatus: value }))}
              options={PAYMENT_STATUSES.map(value => ({ value, label: value, color: value === 'Paid' ? '#059669' : '#d97706' }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={newOrderForm.notes} onChange={e => setNewOrderForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Additional order notes..." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={createJobOpen}
        title="Create Production Job"
        description={`Create a production job for order ${viewingOrder?.orderNumber || ''}? This will move the order status to Production.`}
        confirmLabel="Create Job"
        variant="info"
        onConfirm={() => viewingOrder && handleCreateJob(viewingOrder)}
        onCancel={() => setCreateJobOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Order"
        description={`Delete order ${deleteTarget?.orderNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
