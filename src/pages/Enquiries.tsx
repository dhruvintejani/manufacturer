import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, Plus, Eye, Edit2, Trash2,
  FileText, ArrowRight, User, Mail, Phone, Archive
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Enquiry } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RowActions } from '../components/ui/RowActions';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { WorkflowStepper } from '../components/ui/WorkflowStepper';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { formatDate } from '../utils/formatters';

const enquirySchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  product: z.string().min(2, 'Product required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  requirement: z.string().min(5, 'Requirement description required'),
  expectedDeliveryDate: z.string().min(1, 'Expected delivery date required'),
  assignedTo: z.string().default('Alex Morgan'),
  status: z.string().default('New'),
  notes: z.string().default(''),
});

type EnquiryFormData = z.infer<typeof enquirySchema>;

const ITEMS_PER_PAGE = 8;
const PRODUCTS = ['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Industrial Dryer', 'Reactor', 'Column', 'Boiler System'];
const TEAM_MEMBERS = ['Alex Morgan', 'Sarah Johnson', 'Mike Davis', 'Lisa Chen', 'David Kumar'];
const STATUSES = ['New', 'Contacted', 'Quotation Sent', 'Negotiation', 'Converted', 'Closed/Lost'];

const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";
const FormField = ({ label, error, children, required }: { label: string; error?: string; children: React.ReactNode; required?: boolean }) => {
  const id = React.useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span aria-hidden="true" className="text-red-500 ml-1">*</span>}
      </label>
      {control}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const workflowSteps = (status: string) => {
  const steps = ['New', 'Contacted', 'Quotation Sent', 'Negotiation', 'Converted'];
  const currentIdx = steps.indexOf(status);
  return steps.map((s, i) => ({
    label: s,
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'pending' as any,
  }));
};

export const Enquiries: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { enquiries, customers, addEnquiry, updateEnquiry, deleteEnquiry, quotations } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);

  // ?open=ID is a deep link from customer records, notifications and dashboard activity.
  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('open');
    if (!openId) return;
    const record = enquiries.find(e => e.id === openId);
    if (record) setViewingEnquiry(record);
  }, [location.search, enquiries]);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);


  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<EnquiryFormData>({
    resolver: zodResolver(enquirySchema) as any,
  });

  const openAdd = () => {
    reset({ status: 'New', assignedTo: 'Alex Morgan', quantity: 1 });
    setEditingEnquiry(null);
    setModalOpen(true);
  };

  const openEdit = (enq: Enquiry) => {
    setEditingEnquiry(enq);
    reset({ ...enq });
    setModalOpen(true);
  };

  const onSubmit = (data: EnquiryFormData) => {
    if (editingEnquiry) {
      updateEnquiry(editingEnquiry.id, data as any);
      toast.success('Enquiry updated successfully.');
    } else {
      addEnquiry(data as any);
      toast.success('New enquiry created successfully.');
    }
    setModalOpen(false);
    reset();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (!deleteEnquiry(deleteTarget.id)) {
      toast.error('Cannot delete an enquiry while it has linked quotations.');
      setDeleteTarget(null);
      return;
    }
    toast.success('Enquiry deleted.');
    setDeleteTarget(null);
    setViewingEnquiry(null);
  };

  const filtered = useMemo(() => {
    return enquiries.filter(e => {
      const customer = customers.find(c => c.id === e.customerId);
      const matchSearch = !search ||
        e.id.toLowerCase().includes(search.toLowerCase()) ||
        e.product.toLowerCase().includes(search.toLowerCase()) ||
        customer?.companyName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [enquiries, customers, search, statusFilter]);

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.enquiryDate).getTime() - new Date(a.enquiryDate).getTime()
  );

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getCustomer = (id: string) => customers.find(c => c.id === id);

  // Stats
  const stats = {
    total: enquiries.length,
    new: enquiries.filter(e => e.status === 'New').length,
    inProgress: enquiries.filter(e => ['Contacted', 'Negotiation'].includes(e.status)).length,
    quotationSent: enquiries.filter(e => e.status === 'Quotation Sent').length,
    converted: enquiries.filter(e => e.status === 'Converted').length,
  };

  const handleCreateQuotation = (enq: Enquiry) => {
    setViewingEnquiry(null);
    // Navigate to quotations with pre-filled data
    navigate('/quotations', { state: { createFromEnquiry: enq } });
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Enquiries"
        subtitle="Manage and track customer requirements from first contact to conversion."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Enquiries' }]}
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> New Enquiry
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Enquiries" value={stats.total} icon={<ClipboardList className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="New" value={stats.new} icon={<Plus className="w-5 h-5 text-slate-600" />} iconBg="bg-slate-100" index={1} />
        <StatCard title="In Progress" value={stats.inProgress} icon={<User className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" index={2} />
        <StatCard title="Quotation Sent" value={stats.quotationSent} icon={<FileText className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" index={3} />
        <StatCard title="Converted" value={stats.converted} icon={<ArrowRight className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={4} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1); }}
          placeholder="Search by enquiry ID, customer or product..."
          className="flex-1 max-w-md"
        />
        <PremiumSelect label="Enquiry status filter" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Status' }, ...STATUSES.map(value => ({ value, label: value,
            color: value === 'Converted' ? '#059669' : value === 'Closed/Lost' ? '#64748b' : value === 'New' ? '#2563eb' : '#d97706' }))]} className="w-full sm:w-56" />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      >
        {paginated.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title="No enquiries found"
            description="No enquiries match your filters. Try adjusting your search or create a new enquiry."
            action={
              <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> New Enquiry
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Enquiry ID', 'Customer', 'Product', 'Qty', 'Date', 'Assigned To', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((enq, i) => {
                    const customer = getCustomer(enq.customerId);
                    return (
                      <motion.tr
                        key={enq.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setViewingEnquiry(enq)}
                            className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {enq.id}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{customer?.companyName || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{customer?.country}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-800 font-medium">{enq.product}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{enq.quantity}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500">{formatDate(enq.enquiryDate)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-700">{enq.assignedTo}</span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={enq.status} />
                        </td>
                        <td className="px-6 py-4">
                          <RowActions label={`Actions for ${enq.id}`} actions={[
  { label: 'View details', onClick: () => setViewingEnquiry(enq), icon: <Eye className="h-4 w-4" /> },
  { label: 'Edit enquiry', onClick: () => openEdit(enq), icon: <Edit2 className="h-4 w-4" /> },
  { label: 'Delete enquiry', onClick: () => setDeleteTarget(enq), icon: <Trash2 className="h-4 w-4" />, danger: true },
]} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={sorted.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); reset(); }}
        title={editingEnquiry ? 'Edit Enquiry' : 'New Enquiry'}
        subtitle={editingEnquiry ? `Editing ${editingEnquiry.id}` : 'Create a new customer enquiry.'}
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => { setModalOpen(false); reset(); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit(onSubmit as any)} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
              {editingEnquiry ? 'Save Changes' : 'Create Enquiry'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Customer" error={errors.customerId?.message} required>
            <Controller name="customerId" control={control} render={({ field }) =>
 <PremiumSelect label="Customer" value={field.value || ''} onChange={field.onChange}
  options={[{ value: '', label: 'Select customer...' }, ...customers.map(c => ({ value: c.id, label: c.companyName }))]} />} />
          </FormField>
          <FormField label="Product" error={errors.product?.message} required>
            <Controller name="product" control={control} render={({ field }) =>
 <PremiumSelect label="Product" value={field.value || ''} onChange={field.onChange}
  options={[{ value: '', label: 'Select product...' }, ...PRODUCTS.map(value => ({ value, label: value }))]} />} />
          </FormField>
          <FormField label="Quantity" error={errors.quantity?.message} required>
            <input {...register('quantity', { valueAsNumber: true })} type="number" min={1} className={inputClass} placeholder="1" />
          </FormField>
          <FormField label="Expected Delivery Date" error={errors.expectedDeliveryDate?.message} required>
            <input {...register('expectedDeliveryDate')} type="date" className={inputClass} />
          </FormField>
          <FormField label="Assigned To">
            <Controller name="assignedTo" control={control} render={({ field }) =>
 <PremiumSelect label="Assigned employee" value={field.value || TEAM_MEMBERS[0]} onChange={field.onChange}
  options={TEAM_MEMBERS.map(value => ({ value, label: value }))} />} />
          </FormField>
          <FormField label="Status">
            <Controller name="status" control={control} render={({ field }) =>
 <PremiumSelect label="Enquiry status" value={field.value || 'New'} onChange={field.onChange}
  options={STATUSES.map(value => ({ value, label: value,
   color: value === 'Converted' ? '#059669' : value === 'Closed/Lost' ? '#64748b' : value === 'New' ? '#2563eb' : '#d97706' }))} />} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Requirement / Description" error={errors.requirement?.message} required>
              <textarea {...register('requirement')} rows={3} className={inputClass} placeholder="Describe the technical requirements, specifications, certifications needed..." />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Notes">
              <textarea {...register('notes')} rows={2} className={inputClass} placeholder="Additional notes..." />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Detail Drawer */}
      {viewingEnquiry && (
        <Drawer
          open={!!viewingEnquiry}
          onClose={() => setViewingEnquiry(null)}
          title={viewingEnquiry.id}
          subtitle="Enquiry Details"
        >
          <div className="p-6 space-y-6">
            {(() => {
              const customer = getCustomer(viewingEnquiry.customerId);
              const linkedQuotation = viewingEnquiry.quotationId ? quotations.find(q => q.id === viewingEnquiry.quotationId) : null;
              const steps = workflowSteps(viewingEnquiry.status);
              return (
                <>
                  {/* Workflow */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflow Status</h4>
                    <WorkflowStepper steps={steps} />
                  </div>

                  {/* Customer Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Customer Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">Company</div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">{customer?.companyName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Contact Person</div>
                        <div className="text-sm text-slate-900 mt-0.5">{customer?.contactPerson}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Email</div>
                        <a className="mt-0.5 block break-all text-sm text-blue-700 hover:underline" href={customer?.email ? `mailto:${customer.email}` : undefined}>{customer?.email || '—'}</a>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Phone</div>
                        <a className="mt-0.5 block text-sm text-blue-700 hover:underline" href={customer?.phone ? `tel:${customer.phone.replace(/[^+\d]/g, '')}` : undefined}>{customer?.phone || '—'}</a>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Country</div>
                        <div className="text-sm text-slate-900 mt-0.5">{customer?.country}</div>
                      </div>
                    </div>
                  </div>

                  {/* Enquiry Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Enquiry Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">Product</div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">{viewingEnquiry.product}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Quantity</div>
                        <div className="text-sm text-slate-900 mt-0.5">{viewingEnquiry.quantity} units</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Enquiry Date</div>
                        <div className="text-sm text-slate-900 mt-0.5">{formatDate(viewingEnquiry.enquiryDate)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Expected Delivery</div>
                        <div className="text-sm text-slate-900 mt-0.5">{formatDate(viewingEnquiry.expectedDeliveryDate)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Assigned To</div>
                        <div className="text-sm text-slate-900 mt-0.5">{viewingEnquiry.assignedTo}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Status</div>
                        <div className="mt-0.5"><StatusBadge status={viewingEnquiry.status} /></div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs text-slate-500">Requirement</div>
                      <div className="text-sm text-slate-900 mt-1 leading-relaxed bg-slate-50 rounded-lg p-3">{viewingEnquiry.requirement}</div>
                    </div>
                    {viewingEnquiry.notes && (
                      <div className="mt-3">
                        <div className="text-xs text-slate-500">Notes</div>
                        <div className="text-sm text-slate-900 mt-1 leading-relaxed">{viewingEnquiry.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Linked Quotation */}
                  {linkedQuotation && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Linked Quotation</div>
                          <div className="text-sm font-bold text-blue-900 mt-1">{linkedQuotation.quotationNumber}</div>
                          <StatusBadge status={linkedQuotation.status} />
                        </div>
                        <button
                          onClick={() => { setViewingEnquiry(null); navigate('/quotations'); }}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {customer?.email && <a href={`mailto:${customer.email}?subject=${encodeURIComponent('Regarding enquiry ' + viewingEnquiry.id)}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                      <Mail className="h-4 w-4" /> Contact Customer
                    </a>}
                    {customer?.phone && <a href={`tel:${customer.phone.replace(/[^+\d]/g, '')}`} title="Call customer"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Phone className="h-4 w-4" /> Call
                    </a>}
                    {!viewingEnquiry.quotationId && viewingEnquiry.status !== 'Converted' && viewingEnquiry.status !== 'Closed/Lost' && (
                      <button
                        onClick={() => handleCreateQuotation(viewingEnquiry)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex-1"
                      >
                        <FileText className="w-4 h-4" />
                        Create Quotation
                      </button>
                    )}
                    <button
                      onClick={() => { setViewingEnquiry(null); openEdit(viewingEnquiry); }}
                      className="flex items-center gap-2 text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {viewingEnquiry.status !== 'Closed/Lost' && viewingEnquiry.status !== 'Converted' && (
                      <button type="button" onClick={() => {
                        updateEnquiry(viewingEnquiry.id, { status: 'Closed/Lost' });
                        setViewingEnquiry(prev => prev ? { ...prev, status: 'Closed/Lost' } : null);
                        toast.success('Enquiry closed.');
                      }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Archive className="h-4 w-4" /> Close
                      </button>
                    )}
                    <button
                      onClick={() => { setDeleteTarget(viewingEnquiry); setViewingEnquiry(null); }}
                      className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Drawer>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Enquiry"
        description={`Delete ${deleteTarget?.id}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
