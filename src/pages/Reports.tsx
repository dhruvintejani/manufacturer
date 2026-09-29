import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { PageHeader } from '../components/ui/PageHeader';
import { ChartAlternative, AccessibleBars, AccessibleDonut, AccessibleHorizontalBars } from '../components/ui/AccessibleCharts';
import { formatCurrency } from '../utils/formatters';

const TABS = ['Sales', 'Production', 'Customers', 'Enquiries'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-xl p-3 text-xs">
        <p className="font-semibold text-slate-900 mb-1.5">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.stroke }} />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-semibold text-slate-900">{p.dataKey === 'revenue' ? formatCurrency(Number(p.value)) : p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const KpiBox = ({ label, value, sub, positive }: { label: string; value: string | number; sub?: string; positive?: boolean }) => (
  <div className="min-w-0 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5">
    <div className="text-sm text-slate-500 font-medium mb-1">{label}</div>
    <div className="break-words text-xl font-bold leading-tight tabular-nums text-slate-900 sm:text-2xl xl:text-3xl">{value}</div>
    {sub && (
      <div className={`flex min-w-0 flex-wrap items-center gap-1 mt-1.5 text-xs font-semibold ${positive === true ? 'text-emerald-600' : positive === false ? 'text-red-500' : 'text-slate-500'}`}>
        {positive === true && <ArrowUpRight className="w-3.5 h-3.5" />}
        {positive === false && <ArrowDownRight className="w-3.5 h-3.5" />}
        {sub}
      </div>
    )}
  </div>
);

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Sales');
  const { enquiries, quotations, orders, productionJobs, customers } = useAppStore();
  const reportingYear = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const inReportingYear = (date: string) => new Date(date).getFullYear() === reportingYear;

  // Sales data
  const salesData = useMemo(() => {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => {
      const monthOrders = orders.filter(o => inReportingYear(o.orderDate) && new Date(o.orderDate).getMonth() === idx);
      const monthQuotes = quotations.filter(q => inReportingYear(q.date) && new Date(q.date).getMonth() === idx);
      return {
        month,
        revenue: monthOrders.reduce((s, o) => s + o.totalAmount, 0),
        quotations: monthQuotes.length,
        orders: monthOrders.length,
      };
    });
  }, [orders, quotations, reportingYear]);

  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const approvedOrders = orders.length;
  const avgOrderValue = approvedOrders > 0 ? totalRevenue / approvedOrders : 0;
  const convertedQuotations = quotations.filter(q => orders.some(o => o.quotationId === q.id) || Boolean(q.orderId)).length;
  const conversionRate = quotations.length > 0 ? ((convertedQuotations / quotations.length) * 100).toFixed(1) : '0';

  const quoteVsOrderData = [
    { name: 'Open', value: quotations.filter(q => ['Draft','Sent','Negotiation'].includes(q.status)).length, fill: '#8B5CF6' },
    { name: 'Approved', value: quotations.filter(q => q.status === 'Approved').length, fill: '#10B981' },
    { name: 'Lost', value: quotations.filter(q => ['Rejected','Expired'].includes(q.status)).length, fill: '#EF4444' },
  ];

  // Production data
  const prodStatusData = [
    { name: 'Planning', value: productionJobs.filter(j => j.status === 'Planning').length, fill: '#94A3B8' },
    { name: 'In Production', value: productionJobs.filter(j => j.status === 'In Production').length, fill: '#3B82F6' },
    { name: 'Quality Check', value: productionJobs.filter(j => j.status === 'Quality Check').length, fill: '#F59E0B' },
    { name: 'Ready', value: productionJobs.filter(j => j.status === 'Ready').length, fill: '#06B6D4' },
    { name: 'Completed', value: productionJobs.filter(j => j.status === 'Completed').length, fill: '#10B981' },
    { name: 'Delayed', value: productionJobs.filter(j => j.status === 'Delayed').length, fill: '#EF4444' },
  ].filter(d => d.value > 0);

  const avgProgress = productionJobs.length > 0
    ? Math.round(productionJobs.reduce((s, j) => s + j.progress, 0) / productionJobs.length)
    : 0;

  const prodMonthly = months.map((month, idx) => ({
    month,
    completed: productionJobs.filter(j => j.status === 'Completed' && inReportingYear(j.expectedCompletion) && new Date(j.expectedCompletion).getMonth() === idx).length,
    started: productionJobs.filter(j => inReportingYear(j.startDate) && new Date(j.startDate).getMonth() === idx).length,
  }));

  // Customer data
  const newCustomers = customers.filter(c => inReportingYear(c.createdAt)).length;
  const repeatCustomers = customers.filter(c => orders.filter(o => o.customerId === c.id).length > 1).length;
  const topCustomers = customers.map(c => ({
    name: c.companyName.split(' ')[0] + '...',
    fullName: c.companyName,
    orders: orders.filter(o => o.customerId === c.id).length,
    revenue: orders.filter(o => o.customerId === c.id).reduce((s, o) => s + o.totalAmount, 0),
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const countryData = customers.reduce((acc, c) => {
    acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const countryChartData = Object.entries(countryData).map(([name, value]) => ({ name, value }));

  // Enquiry data
  const enqStatusData = [
    { name: 'New', value: enquiries.filter(e => e.status === 'New').length, fill: '#3B82F6' },
    { name: 'Contacted', value: enquiries.filter(e => e.status === 'Contacted').length, fill: '#8B5CF6' },
    { name: 'Negotiation', value: enquiries.filter(e => e.status === 'Negotiation').length, fill: '#C084FC' },
    { name: 'Quotation Sent', value: enquiries.filter(e => e.status === 'Quotation Sent').length, fill: '#F59E0B' },
    { name: 'Converted', value: enquiries.filter(e => e.status === 'Converted').length, fill: '#10B981' },
    { name: 'Closed/Lost', value: enquiries.filter(e => e.status === 'Closed/Lost').length, fill: '#EF4444' },
  ].filter(d => d.value > 0);

  const enqConversionRate = enquiries.length > 0
    ? ((enquiries.filter(e => e.status === 'Converted').length / enquiries.length) * 100).toFixed(1)
    : '0';

  const enqMonthly = months.map((month, idx) => {
    const received = enquiries.filter(e => inReportingYear(e.enquiryDate) && new Date(e.enquiryDate).getMonth() === idx);
    return {
      month,
      new: received.length,
      converted: received.filter(e => e.status === 'Converted').length,
    };
  });

  const enqProductData = Object.entries(enquiries.reduce((acc, enquiry) => {
    acc[enquiry.product] = (acc[enquiry.product] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)).map(([label, value]) => ({ label, value }));

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

  return (
    <div className="page-shell">
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Records shown are demo data. Monthly charts use ${reportingYear}; order values assume a common reporting currency (no FX conversion).`}
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Reports' }]}
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Report categories"
        className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto sm:max-w-full sm:flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`min-w-0 cursor-pointer rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 sm:text-sm ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {activeTab === 'Sales' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <KpiBox label="Total Order Value" value={formatCurrency(totalRevenue)} sub="All recorded orders" />
            <KpiBox label="Total Orders" value={approvedOrders} />
            <KpiBox label="Avg. Order Value" value={formatCurrency(avgOrderValue)} sub="Per recorded order" />
            <KpiBox label="Quote Conversion" value={`${conversionRate}%`} sub="Quotations linked to orders" />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6 xl:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Order Value ({reportingYear})</h3>
              <ChartAlternative title="Monthly Order Value" fallback={<AccessibleBars title="Monthly Order Value" data={salesData.map(row => ({ ...row, label: row.month }))} series={[{ key: 'revenue', label: 'Order value', color: '#2563eb' }]} valueLabel={value => formatCurrency(value)} />}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={salesData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${(v/1000).toFixed(0)}k` : '0'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Order value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Quotation Status Breakdown</h3>
              <ChartAlternative title="Quotation Status Breakdown" fallback={<AccessibleDonut title="Quotation Status Breakdown" data={quoteVsOrderData} />}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={quoteVsOrderData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {quoteVsOrderData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Orders vs Quotations Trend</h3>
            <ChartAlternative title="Orders vs Quotations Trend" fallback={<AccessibleBars title="Orders vs Quotations Trend" data={salesData.map(row => ({ ...row, label: row.month }))} series={[{ key: 'quotations', label: 'Quotations', color: '#8b5cf6' }, { key: 'orders', label: 'Orders', color: '#059669' }]} />}>
              <ResponsiveContainer width="100%" height={200}>
              <LineChart data={salesData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="quotations" name="Quotations" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="orders" name="Orders" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
              </ChartAlternative>
          </div>
        </motion.div>
      )}

      {/* Production Tab */}
      {activeTab === 'Production' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <KpiBox label="Total Jobs" value={productionJobs.length} />
            <KpiBox label="Completed" value={productionJobs.filter(j => j.status === 'Completed').length} sub="Marked completed" />
            <KpiBox label="Delayed" value={productionJobs.filter(j => j.status === 'Delayed').length} sub="Currently flagged delayed" />
            <KpiBox label="Avg. Progress" value={`${avgProgress}%`} sub="Across all jobs" />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Jobs by Status</h3>
              <ChartAlternative title="Jobs by Status" fallback={<AccessibleDonut title="Jobs by Status" data={prodStatusData} />}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={prodStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {prodStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6 xl:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Production Activity ({reportingYear})</h3>
              <ChartAlternative title="Monthly Production Activity" fallback={<AccessibleBars title="Monthly Production Activity" data={prodMonthly.map(row => ({ ...row, label: row.month }))} series={[{ key: 'started', label: 'Started', color: '#2563eb' }, { key: 'completed', label: 'Completed', color: '#059669' }]} />}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={prodMonthly} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="started" name="Started" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Individual Job Progress</h3>
            <div className="space-y-4">
              {productionJobs.map(job => (
                <div key={job.id} className="min-w-0">
                  <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 break-words">
                      <span className="text-sm font-medium text-slate-900">{job.jobNumber}</span>
                      <span className="text-xs text-slate-500 ml-2">{job.product}</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        job.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        job.status === 'Delayed' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{job.status}</span>
                      <span className="text-sm font-bold text-slate-900 w-10 text-right">{job.progress}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: job.status === 'Completed' ? '#10B981' : job.status === 'Delayed' ? '#EF4444' : '#3B82F6' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Customers Tab */}
      {activeTab === 'Customers' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <KpiBox label="Total Customers" value={customers.length} sub="Recorded customers" />
            <KpiBox label="New Customers" value={newCustomers} sub={`Joined in ${reportingYear}`} />
            <KpiBox label="Repeat Customers" value={repeatCustomers} sub="Multiple orders" />
            <KpiBox label="Active Rate" value={`${Math.round((customers.length ? customers.filter(c=>c.status==='active').length/customers.length : 0)*100)}%`} sub="Currently active" />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Customers by Revenue</h3>
              <ChartAlternative title="Top Customers by Revenue" fallback={<AccessibleHorizontalBars title="Top Customers by Revenue" data={topCustomers.map(row => ({ label: row.fullName, value: row.revenue }))} valueLabel={value => formatCurrency(value)} />}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Customers by Country</h3>
              <ChartAlternative title="Customers by Country" fallback={<AccessibleDonut title="Customers by Country" data={countryChartData.map((row, index) => ({ ...row, fill: COLORS[index % COLORS.length] }))} />}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={countryChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                    {countryChartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              </ChartAlternative>
              <div className="mt-3 grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2" aria-label="Customers per country">
                {countryChartData.map((item, index) => (
                  <div key={item.name} className="flex min-w-0 items-start gap-2 text-xs text-slate-700">
                    <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="min-w-0 flex-1 break-words">{item.name}</span>
                    <span className="shrink-0 font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Customer Leaderboard</h3>
            </div>
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Scrollable customer leaderboard" tabIndex={0}>
              <table className="min-w-[650px] w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Rank', 'Company', 'Country', 'Orders', 'Revenue'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-100 text-slate-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-50 text-slate-500'
                      }`}>{i + 1}</div>
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-900">{c.fullName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{customers.find(cu => cu.companyName === c.fullName)?.country || '—'}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-900 font-semibold">{c.orders}</td>
                    <td className="px-6 py-3.5 text-sm font-bold text-blue-700">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Enquiries Tab */}
      {activeTab === 'Enquiries' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <KpiBox label="Total Enquiries" value={enquiries.length} sub="All recorded enquiries" />
            <KpiBox label="Converted" value={enquiries.filter(e => e.status === 'Converted').length} sub="Successfully converted" />
            <KpiBox label="Closed/Lost" value={enquiries.filter(e => e.status === 'Closed/Lost').length} sub="Did not convert" />
            <KpiBox label="Conversion Rate" value={`${enqConversionRate}%`} sub="Recorded conversion" />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Enquiry Status Distribution</h3>
              <ChartAlternative title="Enquiry Status Distribution" fallback={<AccessibleDonut title="Enquiry Status Distribution" data={enqStatusData} />}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={enqStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {enqStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Enquiry Trend</h3>
              <ChartAlternative title="Monthly Enquiry Trend" fallback={<AccessibleBars title="Monthly Enquiry Trend" data={enqMonthly.map(row => ({ ...row, label: row.month }))} series={[{ key: 'new', label: 'New enquiries', color: '#2563eb' }, { key: 'converted', label: 'Converted', color: '#059669' }]} />}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={enqMonthly} margin={{ left: -20 }}>
                  <defs>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gConverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="new" name="New Enquiries" stroke="#3B82F6" strokeWidth={2} fill="url(#gNew)" />
                  <Area type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2} fill="url(#gConverted)" />
                </AreaChart>
              </ResponsiveContainer>
              </ChartAlternative>
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Enquiries by Product</h3>
            <ChartAlternative title="Enquiries by Product" fallback={<AccessibleHorizontalBars title="Enquiries by Product" data={enqProductData} color="#8b5cf6" />}>
              <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={Object.entries(
                  enquiries.reduce((acc, e) => { acc[e.product] = (acc[e.product] || 0) + 1; return acc; }, {} as Record<string, number>)
                ).map(([name, value]) => ({ name, value }))}
                margin={{ left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Enquiries" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
              </ChartAlternative>
          </div>
        </motion.div>
      )}
    </div>
  );
};
