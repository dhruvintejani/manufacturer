import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Factory, Plus, Eye,
  Users, CheckCircle, AlertTriangle, Clock, Boxes, LockKeyhole, PackageCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { ProductionJob, ProductionStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RowActions } from '../components/ui/RowActions';
import { Drawer } from '../components/ui/Drawer';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { WorkflowStepper } from '../components/ui/WorkflowStepper';
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { formatDate } from '../utils/formatters';

const ITEMS_PER_PAGE = 8;
const PRODUCTION_FLOW: ProductionStatus[] = ['Planning', 'In Production', 'Quality Check', 'Ready', 'Completed'];
const PRODUCTION_STATUSES: ProductionStatus[] = [...PRODUCTION_FLOW, 'Delayed'];
const TEAMS = ['Fabrication Team A', 'Fabrication Team B', 'Specialized Equipment Team', 'Boiler Team', 'Assembly Team'];
const FALLBACK_PRODUCTS = ['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Industrial Dryer', 'Reactor', 'Column', 'Boiler System'];

const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

const statusColorMap: Record<string, string> = {
  'Planning': '#94A3B8',
  'In Production': '#3B82F6',
  'Quality Check': '#F59E0B',
  'Ready': '#06B6D4',
  'Completed': '#10B981',
  'Delayed': '#EF4444',
};

const stageForProgress = (progress: number) => progress >= 100 ? 7 : progress >= 95 ? 5 : progress >= 85 ? 4 : progress >= 65 ? 3 : progress >= 20 ? 2 : progress >= 1 ? 1 : 0;
const withStageProgress = (job: ProductionJob, progress: number) => {
  const current = stageForProgress(progress);
  return job.stages.map((stage, index) => ({ ...stage,
    status: (index < current ? 'completed' : index === current ? 'in-progress' : 'pending') as 'completed' | 'in-progress' | 'pending',
    date: index < current ? stage.date || new Date().toISOString() : stage.date,
  }));
};

export const Production: React.FC = () => {
  const location = useLocation();
  const {
    productionJobs, orders, customers, products, materials, materialRequirements, inventoryTransactions,
    updateProductionJob, addProductionJob,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(new URLSearchParams(location.search).get('status') === 'active' ? 'active' : 'all');
  const [page, setPage] = useState(1);
  const [viewingJob, setViewingJob] = useState<ProductionJob | null>(null);

  // ?open=ID is a deep link from customer records, notifications and dashboard activity.
  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('open');
    if (!openId) return;
    const record = productionJobs.find(job => job.id === openId);
    if (record) setViewingJob(record);
  }, [location.search, productionJobs]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({
    orderId: '', product: products.find(product => product.active)?.name || FALLBACK_PRODUCTS[0], quantity: 1,
    startDate: new Date().toISOString().split('T')[0],
    expectedCompletion: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    assignedTeam: TEAMS[0], notes: '',
  });

  const filtered = useMemo(() => {
    return productionJobs.filter(j => {
      const matchSearch = !search ||
        j.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        j.product.toLowerCase().includes(search.toLowerCase()) ||
        j.orderId.toLowerCase().includes(search.toLowerCase()) ||
        customers.find(c => c.id === orders.find(o => o.id === j.orderId)?.customerId)?.companyName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? j.status !== 'Completed' : j.status === statusFilter);
      return matchSearch && matchStatus;
    });
  }, [productionJobs, customers, orders, search, statusFilter]);

  const sorted = [...filtered].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = {
    active: productionJobs.filter(j => !['Completed'].includes(j.status)).length,
    inProduction: productionJobs.filter(j => j.status === 'In Production').length,
    qualityCheck: productionJobs.filter(j => j.status === 'Quality Check').length,
    delayed: productionJobs.filter(j => j.status === 'Delayed').length,
    completed: productionJobs.filter(j => j.status === 'Completed').length,
  };

  const canChangeProduction = (job: ProductionJob) => {
    const linked = orders.find(order => order.id === job.orderId);
    if (linked && ['On Hold', 'Cancelled'].includes(linked.status)) {
      toast.error(`Order ${linked.orderNumber} is ${linked.status.toLowerCase()}. Resume or resolve the order first.`);
      return false;
    }
    if (job.status === 'Completed') {
      toast.error('Completed production jobs cannot be reopened through the demo workflow.');
      return false;
    }
    return true;
  };

  const eligibleOrders = orders.filter(order =>
    order.status === 'Confirmed' &&
    !order.productionJobId &&
    !productionJobs.some(job => job.orderId === order.id) &&
    materialRequirements.some(requirement =>
      requirement.orderId === order.id &&
      requirement.status === 'Ready' &&
      requirement.lines.length > 0 &&
      requirement.lines.every(line => line.reservedQty + 1e-9 >= line.requiredQty))
  );
  const blockedConfirmedOrders = orders.filter(order =>
    order.status === 'Confirmed' &&
    !order.productionJobId &&
    !productionJobs.some(job => job.orderId === order.id) &&
    !materialRequirements.some(requirement => requirement.orderId === order.id && requirement.status === 'Ready')
  ).length;

  const refreshViewingJob = (id: string) => {
    const current = useAppStore.getState().productionJobs.find(job => job.id === id) || null;
    setViewingJob(current);
  };

  const allowedStatuses = (job: ProductionJob): ProductionStatus[] => {
    if (job.status === 'Completed') return ['Completed'];
    const base = job.status === 'Delayed'
      ? (job.progress >= 95 ? 'Ready' : job.progress >= 85 ? 'Quality Check' : job.progress >= 20 ? 'In Production' : 'Planning')
      : job.status;
    const index = Math.max(0, PRODUCTION_FLOW.indexOf(base as ProductionStatus));
    const current = PRODUCTION_FLOW[index];
    const next = PRODUCTION_FLOW[index + 1];
    const options: ProductionStatus[] = job.status === 'Delayed' ? ['Delayed', current] : [current];
    if (next) options.push(next);
    if (job.status !== 'Delayed') options.push('Delayed');
    return Array.from(new Set(options));
  };

  const maxProgressForJob = (job: ProductionJob) => {
    if (job.status === 'Delayed') return job.progress;
    if (job.status === 'Planning') return 84;
    if (job.status === 'In Production') return 94;
    if (job.status === 'Quality Check') return 99;
    return 100;
  };

  const handleUpdateProgress = (job: ProductionJob, progress: number) => {
    if (!canChangeProduction(job)) return;
    if (job.status === 'Delayed') {
      toast.error('Resume the delayed job before changing production progress.');
      return;
    }
    if (progress < job.progress) {
      toast.error('Production progress cannot move backward.');
      return;
    }

    let status: ProductionStatus = job.status;
    if (progress >= 100) status = 'Completed';
    else if (progress >= 95) status = 'Ready';
    else if (progress >= 85) status = 'Quality Check';
    else if (progress >= 20 && ['Planning', 'In Production'].includes(job.status)) status = 'In Production';
    const stages = withStageProgress(job, progress);
    if (!updateProductionJob(job.id, { progress, stages, status })) {
      toast.error('Production update was rejected to protect the linked order workflow.');
      return;
    }
    refreshViewingJob(job.id);
  };

  const handleStatusChange = (job: ProductionJob, status: string) => {
    if (!canChangeProduction(job)) return;
    const nextStatus = status as ProductionStatus;
    const milestone: Record<string, number> = { Planning: 0, 'In Production': 20, 'Quality Check': 85, Ready: 95, Completed: 100 };
    const progress = nextStatus === 'Delayed' ? job.progress : Math.max(job.progress, milestone[nextStatus] || 0);
    const stages = withStageProgress(job, progress);
    if (!updateProductionJob(job.id, { status: nextStatus, progress, stages })) {
      toast.error('Production stages can move forward only. Resume delayed work at the current stage.');
      return;
    }
    toast.success(`Job ${job.jobNumber} status updated to ${nextStatus}`);
    refreshViewingJob(job.id);
  };

  const handleAddJob = () => {
    if (!newJobForm.orderId) {
      toast.error('Select a material-ready confirmed order.');
      return;
    }
    const linkedOrder = orders.find(order => order.id === newJobForm.orderId);
    if (!linkedOrder || linkedOrder.status !== 'Confirmed') {
      toast.error('Production can start only from a confirmed order.');
      return;
    }
    if (productionJobs.some(job => job.orderId === linkedOrder.id) || linkedOrder.productionJobId) {
      toast.error('A production job already exists for that order.');
      return;
    }
    const requirement = materialRequirements.find(item => item.orderId === linkedOrder.id);
    if (!requirement || requirement.status !== 'Ready' ||
        requirement.lines.some(line => line.reservedQty + 1e-9 < line.requiredQty)) {
      toast.error('Material check is not ready. Resolve shortages before starting production.');
      return;
    }
    if (new Date(newJobForm.expectedCompletion).getTime() < new Date(newJobForm.startDate).getTime()) {
      toast.error('Expected completion cannot be before the production start date.');
      return;
    }

    const job = addProductionJob({
      jobNumber: '',
      ...newJobForm,
      product: linkedOrder.product,
      quantity: linkedOrder.quantity,
      status: 'Planning',
      progress: 0,
      stages: [],
    });
    if (!job) {
      toast.error('Production could not start because the order or material reservation changed. Recheck the order.');
      return;
    }
    toast.success(`Production job ${job.jobNumber} created. Reserved BOM materials were consumed exactly once.`);
    setAddModalOpen(false);
    setNewJobForm({
      orderId: '',
      product: products.find(product => product.active)?.name || FALLBACK_PRODUCTS[0],
      quantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      expectedCompletion: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      assignedTeam: TEAMS[0],
      notes: '',
    });
  };

  const viewingRequirement = viewingJob
    ? materialRequirements.find(requirement => requirement.orderId === viewingJob.orderId)
    : undefined;
  const viewingConsumptionTransactions = viewingJob
    ? inventoryTransactions.filter(transaction =>
        transaction.type === 'production_consumption' &&
        transaction.reference === viewingJob.orderId)
    : [];
  const selectedNewOrder = newJobForm.orderId
    ? orders.find(order => order.id === newJobForm.orderId)
    : undefined;
  const selectedNewRequirement = selectedNewOrder
    ? materialRequirements.find(requirement => requirement.orderId === selectedNewOrder.id)
    : undefined;

  return (
    <div className="page-shell">
      <PageHeader
        title="Production"
        subtitle="Track manufacturing jobs and production progress."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Production' }]}
        actions={
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> New Job
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard title="Active Jobs" value={stats.active} icon={<Factory className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="In Production" value={stats.inProduction} icon={<Clock className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" index={1} />
        <StatCard title="Quality Check" value={stats.qualityCheck} icon={<CheckCircle className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" index={2} />
        <StatCard title="Delayed" value={stats.delayed} icon={<AlertTriangle className="w-5 h-5 text-red-600" />} iconBg="bg-red-50" index={3} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={4} />
        <StatCard title="Ready to Start" value={eligibleOrders.length} icon={<PackageCheck className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={5} />
        <StatCard title="Material Blocked" value={blockedConfirmedOrders} icon={<LockKeyhole className="w-5 h-5 text-rose-600" />} iconBg="bg-rose-50" index={6} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by job no., product or order..." className="flex-1 max-w-md" />
        <PremiumSelect label="Production status filter" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active Jobs', color: '#2563eb' }, ...PRODUCTION_STATUSES.map(value => ({ value, label: value, color: statusColorMap[value] }))]} className="w-full sm:w-56" />
      </div>

      {/* Jobs Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState
            icon={<Factory className="w-8 h-8" />}
            title="No production jobs yet"
            description="Production jobs created from orders will appear here."
            action={<button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Create Production Job</button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Job ID', 'Order', 'Customer', 'Product', 'Qty', 'Start Date', 'Expected Completion', 'Team', 'Progress', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((job, i) => (
                    <motion.tr key={job.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <button onClick={() => setViewingJob(job)} className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700">{job.jobNumber}</button>
                      </td>
                      <td className="px-6 py-4"><span className="text-xs font-mono text-slate-500">{job.orderId}</span></td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{customers.find(c => c.id === orders.find(o => o.id === job.orderId)?.customerId)?.companyName || "—"}</td>
                      <td className="px-6 py-4"><span className="text-sm font-medium text-slate-900">{job.product}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-slate-700">{job.quantity}</span></td>
                      <td className="px-6 py-4"><span className="text-xs text-slate-500">{formatDate(job.startDate)}</span></td>
                      <td className="px-6 py-4"><span className="text-xs text-slate-500">{formatDate(job.expectedCompletion)}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-700">{job.assignedTeam}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-24">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${job.progress}%`, background: statusColorMap[job.status] || '#3B82F6' }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-8">{job.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                      <td className="px-6 py-4">
                        <RowActions label={`Actions for ${job.jobNumber}`} actions={[
  { label: 'View details', onClick: () => setViewingJob(job), icon: <Eye className="h-4 w-4" /> },
]} />
                      </td>
                    </motion.tr>
                  ))}
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
      {viewingJob && (
        <Drawer open={!!viewingJob} onClose={() => setViewingJob(null)} title={viewingJob.jobNumber} subtitle="Production Job Details">
          <div className="p-6 space-y-6">
            {/* Production Stages */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Production Stages</h4>
              <WorkflowStepper
                steps={viewingJob.stages.map(s => ({
                  label: s.name,
                  status: (s.status === 'in-progress' ? 'current' : s.status) as 'current' | 'pending' | 'completed',
                  date: s.date,
                }))}
                orientation="vertical"
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Job Number', value: viewingJob.jobNumber },
                { label: 'Order', value: viewingJob.orderId },
                { label: 'Customer', value: customers.find(c => c.id === orders.find(o => o.id === viewingJob.orderId)?.customerId)?.companyName || "—" },
                { label: 'Product', value: viewingJob.product },
                { label: 'Quantity', value: `${viewingJob.quantity} units` },
                { label: 'Start Date', value: formatDate(viewingJob.startDate) },
                { label: 'Expected Completion', value: formatDate(viewingJob.expectedCompletion) },
                { label: 'Assigned Team', value: viewingJob.assignedTeam },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{item.value}</div>
                </div>
              ))}
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1"><StatusBadge status={viewingJob.status} /></div>
              </div>
            </div>

            {/* Material Consumption */}
            <section aria-label="Production material consumption" className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Material Consumption</h4>
                      <p className="mt-0.5 text-xs text-slate-600">Inventory deducted when this production job was created.</p>
                    </div>
                    <StatusBadge status={viewingRequirement?.status || 'Legacy'} />
                  </div>
                  {viewingRequirement?.status === 'Consumed' ? (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {viewingRequirement.lines.map(line => {
                          const material = materials.find(item => item.id === line.materialId);
                          return (
                            <div key={line.materialId} className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                              <div className="text-xs font-semibold text-slate-900">{material?.name || line.materialId}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Consumed <strong className="text-blue-700">{line.consumedQty} {material?.unit || ''}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>Consumed: <strong>{viewingRequirement.consumedAt ? new Date(viewingRequirement.consumedAt).toLocaleString() : 'Recorded'}</strong></span>
                        <span>Ledger entries: <strong>{viewingConsumptionTransactions.length}</strong></span>
                        <span>BOM: <strong>v{viewingRequirement.bomVersion || '1.0'}</strong></span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-slate-600">
                      This legacy demo job does not have a linked consumed-material record. New production jobs always require a Ready BOM reservation and create inventory consumption entries automatically.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Progress Control */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-900">Production Progress</h4>
                <span className="text-2xl font-bold" style={{ color: statusColorMap[viewingJob.status] || '#3B82F6' }}>
                  {viewingJob.progress}%
                </span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${viewingJob.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: statusColorMap[viewingJob.status] || '#3B82F6' }}
                />
              </div>
              <input
                type="range"
                min={viewingJob.progress}
                max={maxProgressForJob(viewingJob)}
                step={5}
                value={viewingJob.progress}
                disabled={viewingJob.status === 'Completed' || viewingJob.status === 'Delayed' || orders.some(order => order.id === viewingJob.orderId && ['On Hold', 'Cancelled'].includes(order.status))}
                aria-label="Production progress percentage"
                onChange={e => handleUpdateProgress(viewingJob, parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Status Change */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Update Status</label>
              <PremiumSelect label="Update production status" value={viewingJob.status}
                disabled={viewingJob.status === 'Completed' || orders.some(order => order.id === viewingJob.orderId && ['On Hold', 'Cancelled'].includes(order.status))}
                onChange={value => handleStatusChange(viewingJob, value)}
                options={allowedStatuses(viewingJob).map(value => ({ value, label: value, color: statusColorMap[value] }))} />
            </div>

            {/* Team */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Team</label>
              <PremiumSelect label="Assigned team" value={viewingJob.assignedTeam}
                disabled={viewingJob.status === 'Completed' || orders.some(order => order.id === viewingJob.orderId && ['On Hold', 'Cancelled'].includes(order.status))}
                onChange={value => {
                  if (!updateProductionJob(viewingJob.id, { assignedTeam: value })) {
                    toast.error('Assigned team cannot be changed while the linked order is blocked or completed.');
                    return;
                  }
                  refreshViewingJob(viewingJob.id);
                  toast.success('Assigned team updated.');
                }} options={TEAMS.map(value => ({ value, label: value }))} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                rows={3}
                defaultValue={viewingJob.notes}
                disabled={viewingJob.status === 'Completed' || orders.some(order => order.id === viewingJob.orderId && ['On Hold', 'Cancelled'].includes(order.status))}
                onBlur={e => {
                  if (updateProductionJob(viewingJob.id, { notes: e.target.value })) {
                    refreshViewingJob(viewingJob.id);
                  }
                }}
                className={inputClass}
                placeholder="Add production notes..."
              />
            </div>

            {/* Mark Complete */}
            {viewingJob.status === 'Ready' && !orders.some(order => order.id === viewingJob.orderId && ['On Hold', 'Cancelled'].includes(order.status)) && (
              <button
                onClick={() => handleStatusChange(viewingJob, 'Completed')}
                className="w-full py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
              >
                Mark as Completed
              </button>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              Production jobs are retained as audit records because starting production consumes BOM materials and links inventory transactions to the order.
            </div>
          </div>
        </Drawer>
      )}

      {/* Add Job Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Create Production Job" size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button
              onClick={handleAddJob}
              disabled={!selectedNewOrder || selectedNewRequirement?.status !== 'Ready'}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 rounded-lg shadow-sm"
            >
              Start Production & Consume Materials
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Linked Order <span className="text-red-500">*</span></label>
            <PremiumSelect label="Linked order" value={newJobForm.orderId}
              onChange={value => {
                const selected = eligibleOrders.find(order => order.id === value);
                setNewJobForm(current => {
                  const deliveryDate = selected?.deliveryDate;
                  const expectedCompletion = deliveryDate && deliveryDate >= current.startDate
                    ? deliveryDate
                    : current.expectedCompletion;
                  return {
                    ...current,
                    orderId: value,
                    product: selected?.product || current.product,
                    quantity: selected?.quantity || current.quantity,
                    expectedCompletion,
                  };
                });
              }}
              options={[{ value: '', label: eligibleOrders.length ? 'Select material-ready order...' : 'No material-ready confirmed orders' }, ...eligibleOrders.map(order => ({
                value: order.id,
                label: `${order.orderNumber} — ${order.quantity} × ${order.product}`,
              }))]} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product</label>
            <div className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
              {selectedNewOrder?.product || 'Select an order'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
            <div className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800">
              {selectedNewOrder?.quantity ?? '—'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
            <input type="date" value={newJobForm.startDate} onChange={e => setNewJobForm(f => ({ ...f, startDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected Completion</label>
            <input type="date" value={newJobForm.expectedCompletion} onChange={e => setNewJobForm(f => ({ ...f, expectedCompletion: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assigned Team</label>
            <PremiumSelect label="Assigned team" value={newJobForm.assignedTeam} onChange={value => setNewJobForm(f => ({ ...f, assignedTeam: value }))}
              options={TEAMS.map(value => ({ value, label: value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={newJobForm.notes} onChange={e => setNewJobForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Production notes..." />
          </div>

          <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-blue-950">Production start is the inventory-consumption boundary</h4>
                {selectedNewRequirement?.status === 'Ready' ? (
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    All {selectedNewRequirement.lines.length} BOM material lines are reserved. Creating this job will deduct those reserved quantities exactly once and record inventory transactions against {selectedNewOrder?.orderNumber}.
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Select a confirmed order with a Ready material requirement. {blockedConfirmedOrders > 0 ? `${blockedConfirmedOrders} confirmed order${blockedConfirmedOrders === 1 ? '' : 's'} are currently blocked by material readiness.` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};
