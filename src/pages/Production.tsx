import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Factory, Plus, Eye, Trash2,
  Users, CheckCircle, AlertTriangle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { ProductionJob } from '../types';
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
import { Modal } from '../components/ui/Modal';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { formatDate } from '../utils/formatters';

const ITEMS_PER_PAGE = 8;
const PRODUCTION_STATUSES = ['Planning', 'In Production', 'Quality Check', 'Ready', 'Completed', 'Delayed'];
const TEAMS = ['Fabrication Team A', 'Fabrication Team B', 'Specialized Equipment Team', 'Boiler Team', 'Assembly Team'];
const PRODUCTS = ['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Industrial Dryer', 'Reactor', 'Column', 'Boiler System'];

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
  const { productionJobs, orders, customers, updateProductionJob, deleteProductionJob, addProductionJob } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewingJob, setViewingJob] = useState<ProductionJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionJob | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({
    orderId: '', product: PRODUCTS[0], quantity: 1,
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
      const matchStatus = statusFilter === 'all' || j.status === statusFilter;
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

  const handleUpdateProgress = (job: ProductionJob, progress: number) => {
    let status = job.status;
    if (progress >= 100) status = 'Completed';
    else if (progress >= 85) status = 'Quality Check';
    else if (progress >= 10) status = 'In Production';
    const stages = withStageProgress(job, progress);
    updateProductionJob(job.id, { progress, stages, status: status as any });
    setViewingJob(prev => prev ? { ...prev, progress, stages, status: status as any } : null);
  };

  const handleStatusChange = (job: ProductionJob, status: string) => {
    const milestone: Record<string, number> = { Planning: 0, 'In Production': 20, 'Quality Check': 85, Ready: 95, Completed: 100 };
    const progress = status === 'Delayed' ? job.progress : Math.max(job.progress, milestone[status] || 0);
    const stages = withStageProgress(job, progress);
    updateProductionJob(job.id, { status: status as any, progress, stages });
    toast.success(`Job ${job.jobNumber} status updated to ${status}`);
    setViewingJob(prev => prev ? { ...prev, status: status as any, progress, stages } : null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProductionJob(deleteTarget.id);
    toast.success('Production job deleted.');
    setDeleteTarget(null);
    setViewingJob(null);
  };

  const handleAddJob = () => {
    if (!newJobForm.product || !newJobForm.orderId) {
      toast.error('Please fill all required fields.');
      return;
    }
    const job = addProductionJob({
      jobNumber: '',
      ...newJobForm,
      status: 'Planning',
      progress: 0,
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
    toast.success(`Production job ${job.jobNumber} created!`);
    setAddModalOpen(false);
    setNewJobForm({
      orderId: '', product: PRODUCTS[0], quantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      expectedCompletion: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      assignedTeam: TEAMS[0], notes: '',
    });
  };



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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Active Jobs" value={stats.active} icon={<Factory className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="In Production" value={stats.inProduction} icon={<Clock className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" index={1} />
        <StatCard title="Quality Check" value={stats.qualityCheck} icon={<CheckCircle className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" index={2} />
        <StatCard title="Delayed" value={stats.delayed} change={stats.delayed > 0 ? -20 : 0} icon={<AlertTriangle className="w-5 h-5 text-red-600" />} iconBg="bg-red-50" index={3} />
        <StatCard title="Completed" value={stats.completed} change={25} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={4} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by job no., product or order..." className="flex-1 max-w-md" />
        <PremiumSelect label="Production status filter" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Status' }, ...PRODUCTION_STATUSES.map(value => ({ value, label: value, color: statusColorMap[value] }))]} className="w-full sm:w-56" />
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
  { label: 'Delete job', onClick: () => setDeleteTarget(job), icon: <Trash2 className="h-4 w-4" />, danger: true },
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
                min={0}
                max={100}
                step={5}
                value={viewingJob.progress}
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
              <PremiumSelect label="Update production status" value={viewingJob.status} onChange={value => handleStatusChange(viewingJob, value)}
                options={PRODUCTION_STATUSES.map(value => ({ value, label: value, color: statusColorMap[value] }))} />
            </div>

            {/* Team */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Team</label>
              <select
                value={viewingJob.assignedTeam}
                onChange={e => {
                  updateProductionJob(viewingJob.id, { assignedTeam: e.target.value });
                  setViewingJob(prev => prev ? { ...prev, assignedTeam: e.target.value } : null);
                }}
                className={inputClass}
              >
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                rows={3}
                defaultValue={viewingJob.notes}
                onBlur={e => {
                  updateProductionJob(viewingJob.id, { notes: e.target.value });
                  setViewingJob(prev => prev ? { ...prev, notes: e.target.value } : null);
                }}
                className={inputClass}
                placeholder="Add production notes..."
              />
            </div>

            {/* Mark Complete */}
            {viewingJob.status !== 'Completed' && (
              <button
                onClick={() => {
                  handleUpdateProgress(viewingJob, 100);
                  handleStatusChange({ ...viewingJob, progress: 100 }, 'Completed');
                  toast.success(`Job ${viewingJob.jobNumber} marked as completed!`);
                }}
                className="w-full py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
              >
                Mark as Completed
              </button>
            )}

            <button
              onClick={() => { setDeleteTarget(viewingJob); setViewingJob(null); }}
              className="w-full py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              Delete Job
            </button>
          </div>
        </Drawer>
      )}

      {/* Add Job Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Create Production Job" size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddJob} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Create Job</button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Linked Order <span className="text-red-500">*</span></label>
            <select value={newJobForm.orderId} onChange={e => setNewJobForm(f => ({ ...f, orderId: e.target.value }))} className={inputClass}>
              <option value="">Select order...</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.product}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product</label>
            <select value={newJobForm.product} onChange={e => setNewJobForm(f => ({ ...f, product: e.target.value }))} className={inputClass}>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
            <input type="number" min={1} value={newJobForm.quantity} onChange={e => setNewJobForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
            <input type="date" value={newJobForm.startDate} onChange={e => setNewJobForm(f => ({ ...f, startDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected Completion</label>
            <input type="date" value={newJobForm.expectedCompletion} onChange={e => setNewJobForm(f => ({ ...f, expectedCompletion: e.target.value }))} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assigned Team</label>
            <select value={newJobForm.assignedTeam} onChange={e => setNewJobForm(f => ({ ...f, assignedTeam: e.target.value }))} className={inputClass}>
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={newJobForm.notes} onChange={e => setNewJobForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Production notes..." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Production Job"
        description={`Delete job ${deleteTarget?.jobNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
