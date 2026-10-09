import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Search, Bell, ChevronDown, User, Settings,
  RefreshCw, LogOut, X, CheckCheck
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatRelativeTime } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const {
    setSidebarMobileOpen,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoData,
    customers, enquiries, quotations, orders, productionJobs, materials, products, materialRequirements, purchaseRequests, profile
  } = useAppStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const activeAlerts = buildOperationalAlerts({
    materials,
    materialRequirements,
    orders,
    productionJobs,
    purchaseRequests,
  });
  const activeRelatedIds = new Set(activeAlerts.map(alert => alert.relatedId));
  const recentNotifications = notifications.filter(notification => !(
    notification.relatedId &&
    activeRelatedIds.has(notification.relatedId) &&
    ['Low Stock Alert', 'Material Shortage', 'Production Delayed'].includes(notification.title)
  ));
  const unreadCount = recentNotifications.filter(n => !n.read).length;
  const attentionCount = activeAlerts.length + unreadCount;

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search the current in-browser records across the whole manufacturing flow.
  // Include customer names and contact details alongside document numbers, so
  // searches such as a company name show its linked quotations and orders too.
  const term = searchQuery.trim().toLocaleLowerCase();
  const matches = (...fields: Array<string | undefined>) =>
    fields.some(field => field?.toLocaleLowerCase().includes(term));
  const companyOf = (id: string) => customers.find(customer => customer.id === id)?.companyName;
  const searchResults = term.length >= 2 ? [
    ...customers.filter(c => matches(c.companyName, c.contactPerson, c.email, c.phone, c.country, c.id))
      .slice(0, 3).map(c => ({ type: 'Customer', label: c.companyName, sub: c.contactPerson, path: '/customers?open=' + encodeURIComponent(c.id) })),
    ...enquiries.filter(e => matches(e.id, e.product, e.requirement, companyOf(e.customerId)))
      .slice(0, 3).map(e => ({ type: 'Enquiry', label: e.id, sub: e.product, path: '/enquiries?open=' + encodeURIComponent(e.id) })),
    ...quotations.filter(q => matches(q.quotationNumber, companyOf(q.customerId), q.status, ...q.items.map(item => item.product)))
      .slice(0, 3).map(q => ({ type: 'Quotation', label: q.quotationNumber, sub: companyOf(q.customerId) || q.status, path: '/quotations?open=' + encodeURIComponent(q.id) })),
    ...orders.filter(o => matches(o.orderNumber, o.product, companyOf(o.customerId)))
      .slice(0, 3).map(o => ({ type: 'Order', label: o.orderNumber, sub: companyOf(o.customerId) || o.product, path: '/orders?open=' + encodeURIComponent(o.id) })),
    ...productionJobs.filter(p => matches(p.jobNumber, p.product,
      companyOf(orders.find(order => order.id === p.orderId)?.customerId || '')))
      .slice(0, 3).map(p => ({ type: 'Production', label: p.jobNumber, sub: p.product, path: '/production?open=' + encodeURIComponent(p.id) })),
    ...materials.filter(m => matches(
      m.name, m.code, m.category, m.supplier,
      m.currentStock < m.minimumStock ? 'low stock' : 'healthy stock'
    ))
      .slice(0, 3).map(m => ({
        type: 'Material',
        label: m.name,
        sub: `${m.code} · ${m.currentStock} ${m.unit}${m.currentStock < m.minimumStock ? ' · Low stock' : ''}`,
        path: '/inventory?open=' + encodeURIComponent(m.id),
      })),
    ...products.filter(p => matches(p.name, p.code, p.description))
      .slice(0, 3).map(p => ({ type: 'BOM', label: p.name, sub: `${p.code} · BOM v${p.bomVersion}`, path: '/bom?open=' + encodeURIComponent(p.id) })),
    ...purchaseRequests.filter(p => matches(
      p.requestNumber,
      p.supplier,
      p.status,
      p.orderId,
      materials.find(m => m.id === p.materialId)?.name,
      materials.find(m => m.id === p.materialId)?.code
    ))
      .slice(0, 3).map(p => ({
        type: 'Purchase',
        label: p.requestNumber,
        sub: `${materials.find(m => m.id === p.materialId)?.name || p.materialId} · ${p.status}`,
        path: '/purchases?open=' + encodeURIComponent(p.id),
      })),
  ] : [];

  const openSearchResult = (path: string) => {
    setSearchQuery('');
    setSearchOpen(false);
    navigate(path);
  };

  const typeColors: Record<string, string> = {
    Customer: 'bg-purple-100 text-purple-700',
    Enquiry: 'bg-blue-100 text-blue-700',
    Quotation: 'bg-amber-100 text-amber-700',
    Order: 'bg-emerald-100 text-emerald-700',
    Production: 'bg-violet-100 text-violet-700',
    Material: 'bg-cyan-100 text-cyan-700',
    BOM: 'bg-indigo-100 text-indigo-700',
    Purchase: 'bg-rose-100 text-rose-700',
  };


  const notificationPath = (relatedType?: string, relatedId?: string) => {
    if (!relatedType) return '/dashboard';
    const page = ({
      enquiry: 'enquiries',
      quotation: 'quotations',
      order: 'orders',
      production: 'production',
      customer: 'customers',
      inventory: 'inventory',
      purchase: 'purchases',
      product: 'bom',
    } as Record<string, string>)[relatedType] || 'dashboard';
    return '/' + page + (relatedId ? '?open=' + encodeURIComponent(relatedId) : '');
  };

  const alertDot: Record<string, string> = {
    danger: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };


  return (
    <>
      <header className="relative z-20 flex h-16 min-w-0 shrink-0 items-center gap-1.5 border-b border-slate-100 bg-white px-2 shadow-sm sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
        {/* Mobile menu */}
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search */}
        <div className="min-w-0 flex-1 max-w-lg" ref={searchRef}>
          <div className="relative" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              aria-label="Search manufacturing records"
              aria-expanded={searchOpen && searchResults.length > 0}
              aria-controls="global-search-results"
              autoComplete="off"
              inputMode="search"
              enterKeyHint="go"
              onKeyDown={event => {
                if (event.key === 'Escape') { setSearchOpen(false); }
                if (event.key === 'Enter' && searchResults[0]) {
                  event.preventDefault();
                  openSearchResult(searchResults[0].path);
                }
              }}
              placeholder="Search customers, orders, materials..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {searchOpen && term.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                id="global-search-results"
                role="region"
                aria-label="Search results"
                className="fixed inset-x-2 top-[4.25rem] z-50 max-h-[65dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-0 sm:top-14 sm:max-h-80 sm:w-full"
              >
                {searchResults.length === 0 && <p role="status" className="px-4 py-4 text-sm text-slate-600">
                  No matching records for &ldquo;{searchQuery.trim()}&rdquo;.
                </p>}
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => openSearchResult(result.path)}
                    className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-blue-50"
                  >
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', typeColors[result.type])}>
                      {result.type}
                    </span>
                    <div>
                      <div className="break-words text-sm font-medium text-slate-900">{result.label}</div>
                      <div className="text-xs text-slate-500">{result.sub}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <span className="hidden lg:inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800" title="ForgeFlow demo data is stored in this browser">
            Demo Environment
          </span>
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {attentionCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {attentionCount > 9 ? '9+' : attentionCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-x-2 top-[4.25rem] z-50 max-h-[75dvh] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                      <p className="mt-0.5 text-[10px] text-slate-500">{activeAlerts.length} active operations alert{activeAlerts.length === 1 ? '' : 's'}</p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark events read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[62dvh] overflow-y-auto sm:max-h-96">
                    {activeAlerts.length > 0 && (
                      <section aria-label="Active operational alerts" className="border-b border-slate-100">
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Needs attention</span>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{activeAlerts.length}</span>
                        </div>
                        {activeAlerts.slice(0, 6).map(alert => (
                          <button
                            key={alert.key}
                            type="button"
                            aria-label={`Open alert: ${alert.title}`}
                            onClick={() => { setNotifOpen(false); navigate(alert.path); }}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-blue-50"
                          >
                            <div className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', alertDot[alert.severity])} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-900">{alert.title}</div>
                              <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{alert.message}</div>
                              <div className="mt-1 text-[10px] font-semibold text-blue-600">{alert.actionLabel}</div>
                            </div>
                          </button>
                        ))}
                        {activeAlerts.length > 6 && (
                          <button type="button" onClick={() => { setNotifOpen(false); navigate('/dashboard'); }}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50">
                            View all {activeAlerts.length} on Dashboard
                          </button>
                        )}
                      </section>
                    )}

                    {recentNotifications.length > 0 && (
                      <section aria-label="Recent notifications">
                        <div className="bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent events</div>
                        {recentNotifications.slice(0, 8).map(n => (
                          <button
                            key={n.id}
                            onClick={() => {
                              markNotificationRead(n.id);
                              setNotifOpen(false);
                              navigate(notificationPath(n.relatedType, n.relatedId));
                            }}
                            className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50', !n.read && 'bg-blue-50/50')}
                          >
                            <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', !n.read ? 'bg-blue-500' : 'bg-transparent')} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-900">{n.title}</div>
                              <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</div>
                              <div className="mt-1 text-[10px] text-slate-400">{formatRelativeTime(n.timestamp)}</div>
                            </div>
                          </button>
                        ))}
                      </section>
                    )}

                    {activeAlerts.length === 0 && recentNotifications.length === 0 && (
                      <div className="py-8 text-center text-sm text-slate-400">No notifications or active alerts</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{profile.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-slate-900 leading-none" >{profile.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{profile.role || 'Demo User'}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 w-[min(14rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-slate-100 bg-white py-2 shadow-2xl"
                >
                  <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                    <div className="text-sm font-semibold text-slate-900" >{profile.name}</div>
                    <div className="text-xs text-slate-500">{profile.role || 'Demo User'}</div>
                  </div>
                  {[
                    { icon: <User className="w-4 h-4" />, label: 'Profile', action: () => { setProfileOpen(false); navigate('/settings'); } },
                    { icon: <Settings className="w-4 h-4" />, label: 'Preferences', action: () => { setProfileOpen(false); navigate('/settings'); } },
                    { icon: <RefreshCw className="w-4 h-4" />, label: 'Reset Demo Data', action: () => { setProfileOpen(false); setResetDialogOpen(true); } },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="text-slate-400">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => toast('This is a demo — no authentication required!', { icon: '👋' })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out (Demo)
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={resetDialogOpen}
        title="Reset Demo Data"
        description="This will restore all data to the original demo state. Any changes you've made will be lost."
        confirmLabel="Reset Data"
        variant="warning"
        onConfirm={() => {
          resetDemoData();
          setResetDialogOpen(false);
          toast.success('Demo data has been reset successfully.');
        }}
        onCancel={() => setResetDialogOpen(false)}
      />
    </>
  );
};
