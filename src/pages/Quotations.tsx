import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Eye, Edit2, Trash2,
  CheckCircle, Send, ShoppingCart, Download,
  X, Package, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { Quotation, QuotationLineItem } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { WorkflowStepper } from '../components/ui/WorkflowStepper';
import { formatDate, formatCurrency } from '../utils/formatters';
import { calculateQuotationTotals } from '../utils/calculations';

const ITEMS_PER_PAGE = 8;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'SAR', 'SGD'];
const PRODUCTS = ['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Industrial Dryer', 'Reactor', 'Column', 'Boiler System'];
const inputClass = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

const blankLineItem = (): QuotationLineItem => ({
  id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax: 0,
  total: 0,
});

const calcItemTotal = (item: QuotationLineItem): number => {
  const gross = item.quantity * item.unitPrice;
  const afterDiscount = gross * (1 - item.discount / 100);
  return afterDiscount * (1 + item.tax / 100);
};

interface QuotationFormState {
  customerId: string;
  enquiryId: string;
  date: string;
  validity: string;
  currency: string;
  items: QuotationLineItem[];
  deliveryLeadTime: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
  status: string;
}

const defaultForm = (): QuotationFormState => ({
  customerId: '',
  enquiryId: '',
  date: new Date().toISOString().split('T')[0],
  validity: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  currency: 'USD',
  items: [blankLineItem()],
  deliveryLeadTime: '16 weeks from PO',
  paymentTerms: '30% Advance, 40% on FAT, 30% before dispatch',
  warranty: '12 months from commissioning',
  notes: '',
  status: 'Draft',
});

export const Quotations: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { quotations, enquiries, customers, orders, addQuotation, updateQuotation, deleteQuotation, addOrder } = useAppStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [_sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [convertOrderOpen, setConvertOrderOpen] = useState(false);
  const [form, setForm] = useState<QuotationFormState>(defaultForm());

  // Handle "Create from enquiry" navigation
  useEffect(() => {
    if (location.state?.createFromEnquiry) {
      const enq = location.state.createFromEnquiry;
      const newForm = defaultForm();
      newForm.customerId = enq.customerId;
      newForm.enquiryId = enq.id;
      newForm.items = [{
        ...blankLineItem(),
        product: enq.product,
        description: `${enq.product} — ${enq.requirement?.slice(0, 60) || ''}`,
        quantity: enq.quantity,
      }];
      setForm(newForm);
      setEditingQuotation(null);
      setModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openAdd = () => {
    setForm(defaultForm());
    setEditingQuotation(null);
    setModalOpen(true);
  };

  const openEdit = (q: Quotation) => {
    setEditingQuotation(q);
    setForm({
      customerId: q.customerId,
      enquiryId: q.enquiryId || '',
      date: q.date,
      validity: q.validity,
      currency: q.currency,
      items: q.items,
      deliveryLeadTime: q.deliveryLeadTime,
      paymentTerms: q.paymentTerms,
      warranty: q.warranty,
      notes: q.notes,
      status: q.status,
    });
    setModalOpen(true);
  };

  const updateItem = (index: number, field: keyof QuotationLineItem, value: any) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm(f => ({ ...f, items: newItems }));
  };

  const totals = useMemo(() => {
    return calculateQuotationTotals(form.items);
  }, [form.items]);

  const handleSave = (status = form.status) => {
    if (!form.customerId) { toast.error('Please select a customer.'); return; }
    if (form.items.length === 0) { toast.error('Add at least one line item.'); return; }

    // Recalculate item totals before saving
    const itemsWithTotals = form.items.map(item => ({
      ...item,
      total: calcItemTotal(item),
    }));

    const data = {
      ...form,
      items: itemsWithTotals,
      status: status as any,
      ...totals,
      quotationNumber: editingQuotation?.quotationNumber || '',
    };

    if (editingQuotation) {
      updateQuotation(editingQuotation.id, data);
      toast.success('Quotation updated successfully.');
    } else {
      addQuotation(data as any);
      toast.success('Quotation created successfully.');
    }
    setModalOpen(false);
  };

  const handleSend = (q: Quotation) => {
    const cust = customers.find(c => c.id === q.customerId);
    updateQuotation(q.id, { status: 'Sent' });
    toast.success(`Quotation sent to ${cust?.email || 'customer'}.`);
    setSendConfirmOpen(false);
    setViewingQuotation(null);
  };

  const handleApprove = (q: Quotation) => {
    updateQuotation(q.id, { status: 'Approved' });
    toast.success('Quotation approved.');
    setViewingQuotation(prev => prev ? { ...prev, status: 'Approved' } : null);
  };

  const handleConvertToOrder = (q: Quotation) => {
    const mainItem = q.items[0];
    const order = addOrder({
      orderNumber: '',
      quotationId: q.id,
      customerId: q.customerId,
      product: mainItem?.product || 'Product',
      quantity: mainItem?.quantity || 1,
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
      totalAmount: q.total,
      paymentStatus: 'Pending',
      status: 'Confirmed',
      notes: '',
    });
    toast.success(`Order ${order.orderNumber} created from quotation!`);
    setConvertOrderOpen(false);
    setViewingQuotation(null);
    navigate('/orders');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteQuotation(deleteTarget.id);
    toast.success('Quotation deleted.');
    setDeleteTarget(null);
  };

  const handlePDF = (q: Quotation) => {
    const customer = customers.find(c => c.id === q.customerId);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${q.quotationNumber}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #0F172A; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
        .brand { font-size: 22px; font-weight: 800; color: #2563EB; }
        .brand-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
        .title { font-size: 28px; font-weight: 700; color: #0F172A; margin-bottom: 24px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #F1F5F9; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; }
        td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
        .total-section { margin-left: auto; width: 260px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .grand-total { font-size: 16px; font-weight: 800; color: #2563EB; padding-top: 8px; border-top: 2px solid #2563EB; margin-top: 8px; }
        .terms { margin-top: 24px; }
        .term-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; padding: 4px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-line { border-top: 1px solid #0F172A; padding-top: 8px; margin-top: 40px; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
      <div class="header">
        <div>
          <div class="brand">⚡ ForgeFlow</div>
          <div class="brand-sub">Manufacturing Operations Platform</div>
        </div>
        <div style="text-align:right; font-size: 12px; color: #64748B;">
          <div><strong>Quotation #</strong>${q.quotationNumber}</div>
          <div><strong>Date:</strong> ${formatDate(q.date)}</div>
          <div><strong>Valid Until:</strong> ${formatDate(q.validity)}</div>
        </div>
      </div>
      <div class="title">QUOTATION</div>
      <div class="meta">
        <div>
          <div class="section-title">Bill To</div>
          <div style="font-weight: 700; font-size: 14px;">${customer?.companyName || 'Customer'}</div>
          <div>${customer?.contactPerson || ''}</div>
          <div>${customer?.email || ''}</div>
          <div>${customer?.phone || ''}</div>
          <div>${customer?.address || ''}</div>
          ${customer?.taxNumber ? `<div>Tax: ${customer.taxNumber}</div>` : ''}
        </div>
        <div>
          <div class="section-title">From</div>
          <div style="font-weight: 700; font-size: 14px;">ForgeFlow Manufacturing</div>
          <div>operations@forgeflow.com</div>
          <div>+1 (555) 000-0000</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Product / Description</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Discount</th>
          <th style="text-align:right">Tax</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>
          ${q.items.map(item => `<tr>
            <td><strong>${item.product}</strong><br><span style="color:#64748B;font-size:11px">${item.description}</span></td>
            <td style="text-align:right">${item.quantity}</td>
            <td style="text-align:right">${formatCurrency(item.unitPrice, q.currency)}</td>
            <td style="text-align:right">${item.discount}%</td>
            <td style="text-align:right">${item.tax}%</td>
            <td style="text-align:right"><strong>${formatCurrency(item.total, q.currency)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex; justify-content:flex-end;">
        <div class="total-section">
          <div class="total-row"><span>Subtotal</span><span>${formatCurrency(q.subtotal, q.currency)}</span></div>
          <div class="total-row"><span>Discount</span><span>− ${formatCurrency(q.discountAmount, q.currency)}</span></div>
          <div class="total-row"><span>Tax</span><span>${formatCurrency(q.taxAmount, q.currency)}</span></div>
          <div class="total-row grand-total"><span>Grand Total</span><span>${formatCurrency(q.total, q.currency)}</span></div>
        </div>
      </div>
      <div class="terms">
        <div class="section-title">Terms & Conditions</div>
        <div class="term-row"><span style="color:#64748B;font-size:12px">Delivery Lead Time</span><span>${q.deliveryLeadTime}</span></div>
        <div class="term-row"><span style="color:#64748B;font-size:12px">Payment Terms</span><span>${q.paymentTerms}</span></div>
        <div class="term-row"><span style="color:#64748B;font-size:12px">Warranty</span><span>${q.warranty}</span></div>
        ${q.notes ? `<div class="term-row"><span style="color:#64748B;font-size:12px">Notes</span><span>${q.notes}</span></div>` : ''}
      </div>
      <div class="footer">
        <div>
          <div class="section-title">Authorized By</div>
          <div class="sig-line">Alex Morgan<br><span style="color:#64748B">Operations Manager</span></div>
        </div>
        <div>
          <div class="section-title">Customer Acceptance</div>
          <div class="sig-line"><span style="color:#64748B">Signature / Stamp</span></div>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  };

  const filtered = useMemo(() => {
    return quotations.filter(q => {
      const customer = customers.find(c => c.id === q.customerId);
      const matchSearch = !search ||
        q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
        customer?.companyName.toLowerCase().includes(search.toLowerCase()) ||
        q.items.some(i => i.product.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotations, customers, search, statusFilter]);

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === 'Draft').length,
    sent: quotations.filter(q => q.status === 'Sent').length,
    approved: quotations.filter(q => q.status === 'Approved').length,
    rejected: quotations.filter(q => q.status === 'Rejected').length,
  };

  const getCustomer = (id: string) => customers.find(c => c.id === id);

  // Check if quotation already has an order
  const hasOrder = (q: Quotation) => !!q.orderId || orders.some(o => o.quotationId === q.id);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Create, manage and track customer quotations."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Quotations' }]}
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Create Quotation
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Quotations" value={stats.total} icon={<FileText className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={0} />
        <StatCard title="Draft" value={stats.draft} icon={<Package className="w-5 h-5 text-slate-600" />} iconBg="bg-slate-100" index={1} />
        <StatCard title="Sent" value={stats.sent} icon={<Send className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" index={2} />
        <StatCard title="Approved" value={stats.approved} change={stats.approved > 0 ? 20 : 0} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" index={3} />
        <StatCard title="Rejected" value={stats.rejected} change={stats.rejected > 0 ? -10 : 0} icon={<X className="w-5 h-5 text-red-600" />} iconBg="bg-red-50" index={4} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by quotation no., customer or product..." className="flex-1 max-w-md" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All Status</option>
          {['Draft','Sent','Negotiation','Approved','Rejected','Expired'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={<FileText className="w-8 h-8" />} title="No quotations found" description="Create your first quotation or adjust your search filters." action={<button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Create Quotation</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Quotation No.', 'Enquiry', 'Customer', 'Product', 'Amount', 'Date', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((q, i) => {
                    const customer = getCustomer(q.customerId);
                    const mainProduct = q.items[0]?.product || '—';
                    return (
                      <motion.tr key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <button onClick={() => setViewingQuotation(q)} className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700">{q.quotationNumber}</button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500 font-mono">{q.enquiryId || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{customer?.companyName || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-700">{mainProduct}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-900">{formatCurrency(q.total, q.currency)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500">{formatDate(q.date)}</span>
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={q.status} /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewingQuotation(q)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => openEdit(q)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handlePDF(q)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="PDF"><Download className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteTarget(q)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
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

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.2 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col z-10">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{editingQuotation ? `Edit ${editingQuotation.quotationNumber}` : 'Create Quotation'}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Complete all sections for a professional quotation</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Customer & Meta */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer <span className="text-red-500">*</span></label>
                    <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} className={inputClass}>
                      <option value="">Select customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Linked Enquiry</label>
                    <select value={form.enquiryId} onChange={e => setForm(f => ({ ...f, enquiryId: e.target.value }))} className={inputClass}>
                      <option value="">None</option>
                      {enquiries.filter(e => e.customerId === form.customerId || !form.customerId).map(e => <option key={e.id} value={e.id}>{e.id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inputClass}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Valid Until</label>
                    <input type="date" value={form.validity} onChange={e => setForm(f => ({ ...f, validity: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                      {['Draft','Sent','Negotiation','Approved','Rejected','Expired'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Line Items</h3>
                    <button
                      onClick={() => setForm(f => ({ ...f, items: [...f.items, blankLineItem()] }))}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Line Item
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            {['Product', 'Description', 'Qty', 'Unit Price', 'Discount %', 'Tax %', 'Total', ''].map(h => (
                              <th key={h} className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((item, idx) => {
                            const lineTotal = calcItemTotal(item);
                            return (
                              <tr key={item.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <select value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)} className={`${inputClass} w-40`}>
                                    <option value="">Product...</option>
                                    {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className={`${inputClass} w-48`} placeholder="Description" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className={`${inputClass} w-16`} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className={`${inputClass} w-28`} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min={0} max={100} value={item.discount} onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} className={`${inputClass} w-16`} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min={0} max={100} value={item.tax} onChange={e => updateItem(idx, 'tax', parseFloat(e.target.value) || 0)} className={`${inputClass} w-16`} />
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(lineTotal, form.currency)}</span>
                                </td>
                                <td className="px-3 py-2">
                                  {form.items.length > 1 && (
                                    <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Totals */}
                    <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="space-y-1.5 w-56">
                        <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span className="font-medium">{formatCurrency(totals.subtotal, form.currency)}</span></div>
                        <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="text-red-500">−{formatCurrency(totals.discountAmount, form.currency)}</span></div>
                        <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{formatCurrency(totals.taxAmount, form.currency)}</span></div>
                        <div className="flex justify-between text-base font-bold text-blue-700 pt-2 border-t border-slate-200"><span>Grand Total</span><span>{formatCurrency(totals.total, form.currency)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Delivery / Lead Time', key: 'deliveryLeadTime', placeholder: 'e.g. 16 weeks from PO' },
                    { label: 'Payment Terms', key: 'paymentTerms', placeholder: 'e.g. 30% Advance, 70% on delivery' },
                    { label: 'Warranty', key: 'warranty', placeholder: 'e.g. 12 months from commissioning' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                      <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputClass} placeholder={f.placeholder} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Additional Notes</label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputClass} placeholder="Any additional terms or notes..." />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-slate-100 p-6 flex flex-wrap items-center justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={() => handleSave('Draft')} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Save Draft</button>
                <button onClick={() => { handleSave('Sent'); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                  <Send className="w-4 h-4" /> {editingQuotation ? 'Update & Send' : 'Save & Send'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Drawer */}
      {viewingQuotation && (
        <Drawer open={!!viewingQuotation} onClose={() => setViewingQuotation(null)} title={viewingQuotation.quotationNumber} subtitle="Quotation Details" width="max-w-3xl">
          <div className="p-6 space-y-6">
            {/* Workflow */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Workflow</h4>
              <WorkflowStepper steps={[
                { label: 'Enquiry', status: viewingQuotation.enquiryId ? 'completed' : 'completed' },
                { label: 'Quotation', status: 'completed' },
                { label: 'Approval', status: viewingQuotation.status === 'Approved' ? 'completed' : 'current' },
                { label: 'Order', status: hasOrder(viewingQuotation) ? 'completed' : 'pending' },
              ]} />
            </div>

            {/* Status & Meta */}
            <div className="flex items-center gap-3">
              <StatusBadge status={viewingQuotation.status} />
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">Dated {formatDate(viewingQuotation.date)}</span>
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">Valid until {formatDate(viewingQuotation.validity)}</span>
            </div>

            {/* Customer */}
            {(() => {
              const customer = getCustomer(viewingQuotation.customerId);
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-4 col-span-2">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Customer</div>
                    <div className="text-base font-bold text-slate-900">{customer?.companyName}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{customer?.contactPerson} • {customer?.email}</div>
                  </div>
                </div>
              );
            })()}

            {/* Items */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Line Items</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Product', 'Qty', 'Unit Price', 'Disc.', 'Tax', 'Total'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewingQuotation.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{item.product}</div>
                          <div className="text-xs text-slate-500">{item.description}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(item.unitPrice, viewingQuotation.currency)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.discount}%</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.tax}%</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(item.total || calcItemTotal(item), viewingQuotation.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end bg-slate-50 border-t border-slate-200 px-4 py-4">
                  <div className="space-y-1 w-52">
                    <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatCurrency(viewingQuotation.subtotal, viewingQuotation.currency)}</span></div>
                    <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="text-red-500">−{formatCurrency(viewingQuotation.discountAmount, viewingQuotation.currency)}</span></div>
                    <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{formatCurrency(viewingQuotation.taxAmount, viewingQuotation.currency)}</span></div>
                    <div className="flex justify-between text-base font-bold text-blue-700 border-t border-slate-200 pt-2"><span>Total</span><span>{formatCurrency(viewingQuotation.total, viewingQuotation.currency)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              {[
                { label: 'Delivery Lead Time', value: viewingQuotation.deliveryLeadTime },
                { label: 'Payment Terms', value: viewingQuotation.paymentTerms },
                { label: 'Warranty', value: viewingQuotation.warranty },
                viewingQuotation.notes ? { label: 'Notes', value: viewingQuotation.notes } : null,
              ].filter(Boolean).map((t: any) => (
                <div key={t.label} className="flex gap-3">
                  <span className="text-slate-500 font-medium w-36 flex-shrink-0">{t.label}</span>
                  <span className="text-slate-900">{t.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
              {viewingQuotation.status === 'Draft' && (
                <button onClick={() => handleSend(viewingQuotation)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1">
                  <Send className="w-4 h-4" /> Send to Customer
                </button>
              )}
              {(viewingQuotation.status === 'Sent' || viewingQuotation.status === 'Negotiation') && !hasOrder(viewingQuotation) && (
                <button onClick={() => handleApprove(viewingQuotation)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1">
                  <CheckCircle className="w-4 h-4" /> Mark Approved
                </button>
              )}
              {viewingQuotation.status === 'Approved' && !hasOrder(viewingQuotation) && (
                <button onClick={() => setConvertOrderOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1">
                  <ShoppingCart className="w-4 h-4" /> Convert to Order
                </button>
              )}
              <button onClick={() => handlePDF(viewingQuotation)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => { setViewingQuotation(null); openEdit(viewingQuotation); }} className="flex items-center gap-2 text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        </Drawer>
      )}

      <ConfirmDialog
        open={convertOrderOpen}
        title="Convert to Order"
        description={`Convert quotation ${viewingQuotation?.quotationNumber} to an order? This will create a new order and mark the quotation as converted.`}
        confirmLabel="Convert to Order"
        variant="info"
        onConfirm={() => viewingQuotation && handleConvertToOrder(viewingQuotation)}
        onCancel={() => setConvertOrderOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Quotation"
        description={`Delete ${deleteTarget?.quotationNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
