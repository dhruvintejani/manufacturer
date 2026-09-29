import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, FileText, ShoppingCart, Factory,
  DollarSign, Clock, ArrowRight, Package
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDate, formatCurrency, formatRelativeTime } from '../utils/formatters';

const monthlyData = [
  { month: 'Jan', enquiries: 12, quotations: 8, orders: 5, completed: 3 },
  { month: 'Feb', enquiries: 15, quotations: 10, orders: 7, completed: 5 },
  { month: 'Mar', enquiries: 18, quotations: 12, orders: 9, completed: 7 },
  { month: 'Apr', enquiries: 22, quotations: 16, orders: 11, completed: 8 },
  { month: 'May', enquiries: 19, quotations: 14, orders: 10, completed: 9 },
  { month: 'Jun', enquiries: 25, quotations: 18, orders: 14, completed: 11 },
  { month: 'Jul', enquiries: 28, quotations: 20, orders: 15, completed: 12 },
  { month: 'Aug', enquiries: 24, quotations: 17, orders: 13, completed: 10 },
  { month: 'Sep', enquiries: 30, quotations: 22, orders: 17, completed: 14 },
  { month: 'Oct', enquiries: 26, quotations: 19, orders: 15, completed: 13 },
  { month: 'Nov', enquiries: 32, quotations: 24, orders: 18, completed: 15 },
  { month: 'Dec', enquiries: 35, quotations: 26, orders: 20, completed: 17 },
];



const activityTypeConfig: Record<string, { bg: string; icon: React.ReactNode; color: string }> = {
  enquiry: { bg: 'bg-blue-100', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'text-blue-600' },
  quotation: { bg: 'bg-amber-100', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  order: { bg: 'bg-emerald-100', icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  production: { bg: 'bg-violet-100', icon: <Factory className="w-3.5 h-3.5" />, color: 'text-violet-600' },
  customer: { bg: 'bg-purple-100', icon: <Package className="w-3.5 h-3.5" />, color: 'text-purple-600' },
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
  const { enquiries, quotations, orders, productionJobs, activities, customers } = useAppStore();

  // KPI calculations
  const totalEnquiries = enquiries.length;
  const pendingQuotations = quotations.filter(q => ['Draft', 'Sent', 'Negotiation'].includes(q.status)).length;
  const activeOrders = orders.filter(o => o.status !== 'Completed').length;
  const activeJobs = productionJobs.filter(j => j.status !== 'Completed').length;
  const pendingPayments = orders
    .filter(o => ['Pending', 'Partial', 'Overdue'].includes(o.paymentStatus))
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Recent data
  const recentEnquiries = [...enquiries].sort((a, b) =>
    new Date(b.enquiryDate).getTime() - new Date(a.enquiryDate).getTime()
  ).slice(0, 5);

  const recentOrders = [...orders].sort((a, b) =>
    new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  ).slice(0, 5);

  const getCustomer = (id: string) => customers.find(c => c.id === id);

  const prodStats = productionJobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const productionStatusData = [
    { label: 'Planning', count: prodStats['Planning'] || 0, color: '#94A3B8', pct: 10 },
    { label: 'In Production', count: prodStats['In Production'] || 0, color: '#3B82F6', pct: 55 },
    { label: 'Quality Check', count: prodStats['Quality Check'] || 0, color: '#F59E0B', pct: 75 },
    { label: 'Ready', count: prodStats['Ready'] || 0, color: '#06B6D4', pct: 90 },
    { label: 'Completed', count: prodStats['Completed'] || 0, color: '#10B981', pct: 100 },
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
            Good morning, Alex 👋
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
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          title="Pending Payments"
          value={formatCurrency(pendingPayments)}
          icon={<DollarSign className="w-5 h-5 text-rose-600" />}
          iconBg="bg-rose-50"
          onClick={() => navigate('/orders?payment=pending')}
          index={4}
        />
      </div>

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
              <h2 className="text-base font-semibold text-slate-900">Production Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Monthly enquiries, quotations & orders</p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View Reports <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
                    animate={{ width: `${(item.count / productionJobs.length) * 100}%` }}
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
                  className="flex items-start gap-3"
                >
                  <div className={`w-7 h-7 rounded-lg ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{activity.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{activity.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(activity.timestamp)}</p>
                  </div>
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
