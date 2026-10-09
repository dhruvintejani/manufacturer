import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, FileText, ShoppingCart, Factory,
  DollarSign, Clock, ArrowRight, Package, Boxes, AlertTriangle, ShoppingBag
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { StatCard } from '../components/ui/StatCard';
import { ChartAlternative, AccessibleBars } from '../components/ui/AccessibleCharts';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDate, formatCurrency, formatRelativeTime } from '../utils/formatters';
import { buildOperationalAlerts, countOperationalAlerts } from '../utils/operationalAlerts';


const activityTypeConfig: Record<string, { bg: string; icon: React.ReactNode; color: string }> = {
  enquiry: { bg: 'bg-blue-100', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'text-blue-600' },
  quotation: { bg: 'bg-amber-100', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  order: { bg: 'bg-emerald-100', icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  production: { bg: 'bg-violet-100', icon: <Factory className="w-3.5 h-3.5" />, color: 'text-violet-600' },
  customer: { bg: 'bg-purple-100', icon: <Package className="w-3.5 h-3.5" />, color: 'text-purple-600' },
  inventory: { bg: 'bg-cyan-100', icon: <Boxes className="w-3.5 h-3.5" />, color: 'text-cyan-700' },
  purchase: { bg: 'bg-rose-100', icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-rose-700' },
  product: { bg: 'bg-indigo-100', icon: <Package className="w-3.5 h-3.5" />, color: 'text-indigo-700' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-xl p-3">
        <p className="text-xs font-semibold text-slate-900 mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-semibold text-slate-900">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { enquiries, quotations, orders, productionJobs, activities, customers, materials, materialRequirements, purchaseRequests, profile } = useAppStore();
  const chartYear = new Date().getFullYear();
  const monthlyData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => {
    const isMonth = (iso: string) => {
      const date = new Date(iso);
      return date.getFullYear() === chartYear && date.getMonth() === index;
    };
    return {
      month,
      enquiries: enquiries.filter(e => isMonth(e.enquiryDate)).length,
      quotations: quotations.filter(q => isMonth(q.date)).length,
      orders: orders.filter(o => isMonth(o.orderDate)).length,
    };
  });

  // KPI calculations
  const totalEnquiries = enquiries.length;
  const pendingQuotations = quotations.filter(q => ['Draft', 'Sent', 'Negotiation'].includes(q.status)).length;
  const activeOrders = orders.filter(o => !['Completed', 'Cancelled'].includes(o.status)).length;
  const activeJobs = productionJobs.filter(j => j.status !== 'Completed').length;
  const pendingPayments = orders
    .filter(o => ['Pending', 'Partial', 'Overdue'].includes(o.paymentStatus)).length;
  const lowStockCount = materials.filter(material => material.currentStock < material.minimumStock).length;
  const openRestock = purchaseRequests.filter(request => !['Received', 'Cancelled'].includes(request.status)).length;
  const operationalAlerts = buildOperationalAlerts({
    materials,
    materialRequirements,
    orders,
    productionJobs,
    purchaseRequests,
  });
  const operationalAlertCounts = countOperationalAlerts(operationalAlerts);
  const alertStyles = {
    danger: {
      border: 'border-rose-200',
      bg: 'bg-rose-50',
      dot: 'bg-rose-500',
      badge: 'bg-rose-100 text-rose-700',
      action: 'text-rose-700 hover:bg-rose-100',
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      dot: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-700',
      action: 'text-amber-700 hover:bg-amber-100',
    },
    info: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      dot: 'bg-blue-500',
      badge: 'bg-blue-100 text-blue-700',
      action: 'text-blue-700 hover:bg-blue-100',
    },
  } as const;

  // Recent data
  const recentEnquiries = [...enquiries].sort((a, b) =>
    new Date(b.enquiryDate).getTime() - new Date(a.enquiryDate).getTime()
  ).slice(0, 5);

  const recentOrders = [...orders].sort((a, b) =>
    new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  ).slice(0, 5);

  const activityPath: Record<string, string> = {
    enquiry: '/enquiries', quotation: '/quotations', order: '/orders',
    production: '/production', customer: '/customers', inventory: '/inventory', purchase: '/purchases', product: '/bom',
  };
  const getCustomer = (id: string) => customers.find(c => c.id === id);

  const prodStats = productionJobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const productionStatusData = [
    { label: 'Planning', count: prodStats['Planning'] || 0, color: '#94A3B8' },
    { label: 'In Production', count: prodStats['In Production'] || 0, color: '#3B82F6' },
    { label: 'Quality Check', count: prodStats['Quality Check'] || 0, color: '#F59E0B' },
    { label: 'Ready', count: prodStats['Ready'] || 0, color: '#06B6D4' },
    { label: 'Completed', count: prodStats['Completed'] || 0, color: '#10B981' },
    { label: 'Delayed', count: prodStats['Delayed'] || 0, color: '#dc2626' },
  ];

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-slate-900"
          >
            Hello, {profile.name.split(' ')[0]} 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="text-slate-500 mt-1 text-sm"
          >
            Here's what's happening with your manufacturing operations today.
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm"
        >
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </motion.div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard
          title="Total Enquiries"
          value={totalEnquiries}
          icon={<ClipboardList className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50"
          onClick={() => navigate('/enquiries')}
          index={0}
        />
        <StatCard
          title="Pending Quotations"
          value={pendingQuotations}
          icon={<FileText className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50"
          onClick={() => navigate('/quotations?status=pending')}
          index={1}
        />
        <StatCard
          title="Active Orders"
          value={activeOrders}
          icon={<ShoppingCart className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          onClick={() => navigate('/orders?status=active')}
          index={2}
        />
        <StatCard
          title="Production Jobs"
          value={activeJobs}
          icon={<Factory className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50"
          onClick={() => navigate('/production?status=active')}
          index={3}
        />
        <StatCard
          title="Orders Awaiting Payment"
          value={pendingPayments}
          icon={<DollarSign className="w-5 h-5 text-rose-600" />}
          iconBg="bg-rose-50"
          onClick={() => navigate('/orders?payment=pending')}
          index={4}
        />
        <StatCard
          title="Low Stock Materials"
          value={lowStockCount}
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          iconBg="bg-rose-50"
          onClick={() => navigate('/inventory')}
          index={5}
        />
        <StatCard
          title="Open Restock"
          value={openRestock}
          icon={<ShoppingBag className="w-5 h-5 text-cyan-700" />}
          iconBg="bg-cyan-50"
          onClick={() => navigate('/purchases')}
          index={6}
        />
      </div>

      <section aria-label="Operations attention center" className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${operationalAlerts.length ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Operations Attention</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {operationalAlerts.length
                  ? `${operationalAlerts.length} live condition${operationalAlerts.length === 1 ? '' : 's'} need review. Alerts disappear automatically when the underlying state is resolved.`
                  : 'No active material, production or restock conditions need attention.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {operationalAlertCounts.danger > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{operationalAlertCounts.danger} critical</span>}
            {operationalAlertCounts.warning > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{operationalAlertCounts.warning} warning</span>}
            {operationalAlertCounts.info > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{operationalAlertCounts.info} tracking</span>}
          </div>
        </div>

        {operationalAlerts.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:p-6 lg:grid-cols-2">
            {operationalAlerts.slice(0, 6).map(alert => {
              const style = alertStyles[alert.severity];
              return (
                <article key={alert.key} className={`min-w-0 rounded-xl border p-4 ${style.border} ${style.bg}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <h3 className="break-words text-sm font-bold text-slate-900">{alert.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>
                          {alert.category.replace('-', ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{alert.message}</p>
                      <button type="button"
                        aria-label={`Open alert: ${alert.title}`}
                        onClick={() => navigate(alert.path)}
                        className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${style.action}`}>
                        {alert.actionLabel} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-emerald-700 sm:px-6">
            Inventory thresholds, material reservations, production delays and open restocks are all clear.
          </div>
        )}

        <div className="flex min-w-0 flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => navigate('/inventory')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Inventory</button>
          <button type="button" onClick={() => navigate('/purchases')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Purchase / Restock</button>
          <button type="button" onClick={() => navigate('/production')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Production</button>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Production Overview Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Activity Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Recorded enquiries, quotations & orders in {chartYear}</p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View Reports <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <ChartAlternative title="Dashboard Activity Overview"
            fallback={<AccessibleBars title="Activity Overview" data={monthlyData.map(row => ({ ...row, label: row.month }))}
              series={[{ key: 'enquiries', label: 'Enquiries', color: '#2563eb' }, { key: 'quotations', label: 'Quotations', color: '#8b5cf6' }, { key: 'orders', label: 'Orders', color: '#059669' }]} />}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gEnquiries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gQuotations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                formatter={(v) => <span className="text-slate-600">{v}</span>}
              />
              <Area type="monotone" dataKey="enquiries" name="Enquiries" stroke="#3B82F6" strokeWidth={2} fill="url(#gEnquiries)" dot={false} />
              <Area type="monotone" dataKey="quotations" name="Quotations" stroke="#8B5CF6" strokeWidth={2} fill="url(#gQuotations)" dot={false} />
              <Area type="monotone" dataKey="orders" name="Orders" stroke="#10B981" strokeWidth={2} fill="url(#gOrders)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          </ChartAlternative>
        </motion.div>

        {/* Production Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Production Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">Active job distribution</p>
            </div>
            <button
              onClick={() => navigate('/production')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {productionStatusData.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <span className="text-xs font-bold text-slate-900">{item.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${productionJobs.length ? (item.count / productionJobs.length) * 100 : 0}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">{productionJobs.length}</div>
                <div className="text-xs text-slate-500">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">{prodStats['Completed'] || 0}</div>
                <div className="text-xs text-slate-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-500">{prodStats['Delayed'] || 0}</div>
                <div className="text-xs text-slate-500">Delayed</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Enquiries */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Recent Enquiries</h2>
            <button
              onClick={() => navigate('/enquiries')}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-6 py-3">Enquiry ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Product</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEnquiries.map((enq, i) => {
                  const customer = getCustomer(enq.customerId);
                  return (
                    <motion.tr
                      key={enq.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      onClick={() => navigate('/enquiries')}
                      className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-mono font-semibold text-blue-600">{enq.id}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-sm font-medium text-slate-900">{customer?.companyName || 'Unknown'}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-sm text-slate-600">{enq.product}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-xs text-slate-500">{formatDate(enq.enquiryDate)}</span>
                      </td>
                      <td className="px-3 py-3.5 pr-6">
                        <StatusBadge status={enq.status} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="space-y-4">
            {activities.slice(0, 6).map((activity, i) => {
              const config = activityTypeConfig[activity.type] || activityTypeConfig.enquiry;
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                >
                  <button type="button"
                    onClick={() => navigate((activityPath[activity.type] || '/dashboard') +
                      (activity.relatedId ? `?open=${encodeURIComponent(activity.relatedId)}` : ''))}
                    aria-label={`Open activity: ${activity.title}`}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-blue-50 focus-visible:bg-blue-50">
                    <div className={`w-7 h-7 rounded-lg ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{activity.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{activity.description}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(activity.timestamp)}</p>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                {['Order ID', 'Customer', 'Product', 'Qty', 'Amount', 'Order Status', 'Payment'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3 first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order, i) => {
                const customer = getCustomer(order.customerId);
                return (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    onClick={() => navigate('/orders')}
                    className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-mono font-semibold text-blue-600">{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-medium text-slate-900">{customer?.companyName || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm text-slate-600">{order.product}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm text-slate-600">{order.quantity}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};
