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

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const {
    setSidebarMobileOpen,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoData,
    customers, enquiries, quotations, orders, productionJobs, profile
  } = useAppStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

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

  // Global search results
  const searchResults = searchQuery.trim().length > 1 ? [
    ...customers.filter(c =>
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3).map(c => ({ type: 'Customer', label: c.companyName, sub: c.contactPerson, path: '/customers' })),
    ...enquiries.filter(e =>
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.product.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3).map(e => ({ type: 'Enquiry', label: e.id, sub: e.product, path: '/enquiries' })),
    ...quotations.filter(q =>
      q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 2).map(q => ({ type: 'Quotation', label: q.quotationNumber, sub: q.status, path: '/quotations' })),
    ...orders.filter(o =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.product.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 2).map(o => ({ type: 'Order', label: o.orderNumber, sub: o.product, path: '/orders' })),
    ...productionJobs.filter(p =>
      p.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 2).map(p => ({ type: 'Production', label: p.jobNumber, sub: p.product, path: '/production' })),
  ] : [];

  const typeColors: Record<string, string> = {
    Customer: 'bg-purple-100 text-purple-700',
    Enquiry: 'bg-blue-100 text-blue-700',
    Quotation: 'bg-amber-100 text-amber-700',
    Order: 'bg-emerald-100 text-emerald-700',
    Production: 'bg-violet-100 text-violet-700',
  };



  return (
    <>
      <header className="h-16 bg-white border-b border-slate-100 flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-20 shadow-sm">
        {/* Mobile menu */}
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search */}
        <div className="flex-1 max-w-lg" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search customers, enquiries, orders..."
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
            {searchOpen && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-14 left-4 right-4 sm:left-auto sm:right-auto sm:w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
              >
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(result.path); setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', typeColors[result.type])}>
                      {result.type}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{result.label}</div>
                      <div className="text-xs text-slate-500">{result.sub}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
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
                  className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.slice(0, 8).map(n => (
                      <button
                        key={n.id}
                        onClick={() => { markNotificationRead(n.id); setNotifOpen(false); if (n.relatedType) navigate(`/${n.relatedType === 'enquiry' ? 'enquiries' : n.relatedType === 'quotation' ? 'quotations' : n.relatedType === 'order' ? 'orders' : n.relatedType}`); }}
                        className={cn('w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50', !n.read && 'bg-blue-50/50')}
                      >
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', !n.read ? 'bg-blue-500' : 'bg-transparent')} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900">{n.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(n.timestamp)}</div>
                        </div>
                      </button>
                    ))}
                    {notifications.length === 0 && (
                      <div className="py-8 text-center text-sm text-slate-400">No notifications</div>
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
                  className="absolute right-0 top-12 w-56 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden py-2"
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
