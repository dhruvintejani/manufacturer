import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, Eye, MapPin, Mail, Phone, Building2, Globe } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Customer } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PremiumSelect } from '../components/ui/PremiumSelect';
import { RowActions } from '../components/ui/RowActions';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, formatCurrency } from '../utils/formatters';

const customerSchema = z.object({
  companyName: z.string().min(2, 'Company name required'),
  contactPerson: z.string().min(2, 'Contact person required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(5, 'Phone required'),
  country: z.string().min(2, 'Country required'),
  address: z.string().default(''),
  taxNumber: z.string().default(''),
  notes: z.string().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const ITEMS_PER_PAGE = 8;

const FormField = ({ label, error, children, required }: { label: string; error?: string; children: React.ReactNode; required?: boolean }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

export const Customers: React.FC = () => {
  const { customers, enquiries, quotations, orders, addCustomer, updateCustomer, deleteCustomer } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema) as any,
  });

  const openAdd = () => {
    reset({ status: 'active' });
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset(customer);
    setModalOpen(true);
  };

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data);
      toast.success(`${data.companyName} updated successfully.`);
    } else {
      addCustomer(data);
      toast.success(`${data.companyName} added as a new customer.`);
    }
    setModalOpen(false);
    reset();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCustomer(deleteTarget.id);
    toast.success(`${deleteTarget.companyName} has been deleted.`);
    setDeleteTarget(null);
    if (viewingCustomer?.id === deleteTarget.id) setViewingCustomer(null);
  };

  const filtered = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = !search ||
        c.companyName.toLowerCase().includes(search.toLowerCase()) ||
        c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customers, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalActive = customers.filter(c => c.status === 'active').length;
  const today = new Date();
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const newThisQuarter = customers.filter(c => { const created = new Date(c.createdAt); return created >= quarterStart && created <= today; }).length;
  const repeat = customers.filter(c => orders.filter(o => o.customerId === c.id).length > 1).length;

  const getCustomerStats = (customerId: string) => ({
    enquiries: enquiries.filter(e => e.customerId === customerId).length,
    quotations: quotations.filter(q => q.customerId === customerId).length,
    orders: orders.filter(o => o.customerId === customerId).length,
    revenue: orders.filter(o => o.customerId === customerId).reduce((s, o) => s + o.totalAmount, 0),
  });

  return (
    <div className="page-shell">
      <PageHeader
        title="Customers"
        subtitle="Manage your customers and their business information."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Customers' }]}
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={customers.length} icon={<Users className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="Active Customers" value={totalActive} icon={<Building2 className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={1} />
        <StatCard title="New This Quarter" value={newThisQuarter} icon={<Plus className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" index={2} />
        <StatCard title="Repeat Customers" value={repeat} icon={<Globe className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" index={3} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1); }}
          placeholder="Search by company, contact, email or country..."
          className="flex-1 max-w-md"
        />
        <PremiumSelect label="Customer status filter" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }}
           options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active', color: '#059669' }, { value: 'inactive', label: 'Inactive', color: '#94a3b8' }]}
           className="w-full sm:w-48" />
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
            icon={<Users className="w-8 h-8" />}
            title="No customers found"
            description="No customers match your search criteria. Try adjusting your filters or add a new customer."
            action={
              <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Company', 'Contact Person', 'Country', 'Active Orders', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((customer, i) => {
                    const stats = getCustomerStats(customer.id);
                    return (
                      <motion.tr
                        key={customer.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">
                                {customer.companyName.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <button
                                onClick={() => setViewingCustomer(customer)}
                                className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left"
                              >
                                {customer.companyName}
                              </button>
                              <div className="text-xs text-slate-500">{customer.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{customer.contactPerson}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {customer.country}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-900">{stats.orders}</span>
                          <span className="text-xs text-slate-400 ml-1">orders</span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={customer.status} />
                        </td>
                        <td className="px-6 py-4">
                          <RowActions label={`Actions for ${customer.companyName}`} actions={[
  { label: 'View details', onClick: () => setViewingCustomer(customer), icon: <Eye className="h-4 w-4" /> },
  { label: 'Edit customer', onClick: () => openEdit(customer), icon: <Edit2 className="h-4 w-4" /> },
  { label: 'Delete customer', onClick: () => setDeleteTarget(customer), icon: <Trash2 className="h-4 w-4" />, danger: true },
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
                totalItems={filtered.length}
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
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        subtitle={editingCustomer ? `Editing ${editingCustomer.companyName}` : 'Fill in the details to add a new customer.'}
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setModalOpen(false); reset(); }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmit as any)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Company Name" error={errors.companyName?.message} required>
            <input {...register('companyName')} className={inputClass} placeholder="e.g. Global Traders Pvt. Ltd." />
          </FormField>
          <FormField label="Contact Person" error={errors.contactPerson?.message} required>
            <input {...register('contactPerson')} className={inputClass} placeholder="e.g. John Smith" />
          </FormField>
          <FormField label="Email Address" error={errors.email?.message} required>
            <input {...register('email')} type="email" className={inputClass} placeholder="email@company.com" />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message} required>
            <input {...register('phone')} className={inputClass} placeholder="+1 212 555 0000" />
          </FormField>
          <FormField label="Country" error={errors.country?.message} required>
            <input {...register('country')} className={inputClass} placeholder="e.g. India" />
          </FormField>
          <FormField label="Status">
            <Controller name="status" control={control} render={({ field }) =>
  <PremiumSelect label="Customer status" value={field.value || 'active'} onChange={field.onChange}
   options={[{ value: 'active', label: 'Active', color: '#059669' },
             { value: 'inactive', label: 'Inactive', color: '#94a3b8' }]} />} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Address">
              <input {...register('address')} className={inputClass} placeholder="Full address" />
            </FormField>
          </div>
          <FormField label="GST / VAT / Tax Number">
            <input {...register('taxNumber')} className={inputClass} placeholder="Tax identification number" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes">
              <textarea {...register('notes')} rows={3} className={inputClass} placeholder="Additional notes about this customer..." />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* View Drawer */}
      {viewingCustomer && (
        <Drawer
          open={!!viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          title={viewingCustomer.companyName}
          subtitle="Customer Profile"
        >
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">
                  {viewingCustomer.companyName.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{viewingCustomer.companyName}</h3>
                  <StatusBadge status={viewingCustomer.status} />
                </div>
                <div className="flex flex-wrap gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {viewingCustomer.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {viewingCustomer.phone}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            {(() => {
              const stats = getCustomerStats(viewingCustomer.id);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Enquiries', value: stats.enquiries, color: 'text-blue-600' },
                    { label: 'Quotations', value: stats.quotations, color: 'text-amber-600' },
                    { label: 'Orders', value: stats.orders, color: 'text-emerald-600' },
                    { label: 'Revenue', value: formatCurrency(stats.revenue), color: 'text-violet-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Contact Person', value: viewingCustomer.contactPerson },
                  { label: 'Email', value: viewingCustomer.email },
                  { label: 'Phone', value: viewingCustomer.phone },
                  { label: 'Country', value: viewingCustomer.country },
                  { label: 'Tax Number', value: viewingCustomer.taxNumber || '—' },
                  { label: 'Member Since', value: formatDate(viewingCustomer.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-xs text-slate-500 font-medium">{label}</div>
                    <div className="text-sm text-slate-900 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
              {viewingCustomer.address && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Address</div>
                  <div className="text-sm text-slate-900 mt-0.5">{viewingCustomer.address}</div>
                </div>
              )}
              {viewingCustomer.notes && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Notes</div>
                  <div className="text-sm text-slate-900 mt-0.5 leading-relaxed">{viewingCustomer.notes}</div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setViewingCustomer(null); openEdit(viewingCustomer); }}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                Edit Customer
              </button>
              <button
                onClick={() => { setDeleteTarget(viewingCustomer); setViewingCustomer(null); }}
                className="flex-1 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Drawer>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Customer"
        description={`Are you sure you want to delete "${deleteTarget?.companyName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
